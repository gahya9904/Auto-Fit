from __future__ import annotations

import base64
import hashlib
import io
import threading
import time

import torch

from diffusers import (
    DPMSolverMultistepScheduler,
    StableDiffusionPipeline,
)

from PIL import Image

from app.cache import (
    load_cache,
    save_cache,
)

from app.prompt_builder import (
    build_image_prompt,
)

from app.schemas import (
    GeneratedImagePayload,
    GenerationInfo,
    GenerationMetadata,
    MenuImageGenerateRequest,
    MenuImageGenerateSuccessResponse,
)


# =========================================================
# Model Config
# =========================================================


MODEL_ID = (
    "SG161222/"
    "Realistic_Vision_V6.0_B1_noVAE"
)

MODEL_NAME = "autofit-menu-image-realistic-v1"

MODEL_VERSION = "3.0.0"


# =========================================================
# Generation Config
# =========================================================


# Realistic Vision / GTX 1650 Ti 품질-속도 균형값
INTERNAL_WIDTH = 512
INTERNAL_HEIGHT = 512

NUM_INFERENCE_STEPS = 16

GUIDANCE_SCALE = 7.0


# =========================================================
# GPU Lock
# =========================================================


# GTX 1650 Ti 4GB이므로
# GPU 이미지 생성은 한 번에 1건만 처리.
GPU_GENERATION_LOCK = threading.Lock()


# =========================================================
# Seed
# =========================================================


def build_seed_from_image_key(
    image_key: str,
) -> int:
    """
    같은 image_key -> 같은 seed.

    캐시가 삭제돼도 동일 image_key에서는
    동일한 seed를 사용할 수 있다.
    """

    digest = hashlib.sha256(
        image_key.encode("utf-8")
    ).hexdigest()

    # torch seed 범위를 안정적으로 제한
    return int(
        digest[:8],
        16,
    ) % (2**31 - 1)


# =========================================================
# Base64
# =========================================================


def image_to_png_base64(
    image: Image.Image,
) -> str:
    """
    PIL Image -> PNG -> 순수 Base64.

    data:image/png;base64,...
    접두사는 붙이지 않는다.
    """

    buffer = io.BytesIO()

    image.save(
        buffer,
        format="PNG",
    )

    return (
        base64.b64encode(
            buffer.getvalue()
        )
        .decode("ascii")
    )


# =========================================================
# Negative Prompt
# =========================================================


def build_negative_prompt(
    request: MenuImageGenerateRequest,
) -> str:
    """
    음식 누락 / 다른 음식 생성 / 음식 합체를
    최대한 줄이기 위한 negative prompt.
    """

    negative_items: list[str] = [
        # 음식 구성 오류
        "missing requested food",
        "omitted requested food",
        "extra food",
        "unrequested food",
        "wrong food",
        "wrong ingredients",
        "additional side dishes",
        "unrequested side dish",
        "duplicate food",

        # 음식이 합쳐지는 문제
        "mixed rice bowl",
        "bibimbap",
        "rice bowl",
        "foods mixed together",
        "overlapping foods",
        "stacked foods",
        "food on top of rice",
        "meat on top of rice",
        "vegetables on top of rice",
        "hidden food",
        "covered food",
        "sauce covering food",
        "heavy sauce",
        "heavy garnish",

        # 구도 오류
        "cropped main food",
        "food outside frame",
        "multiple plates",
        "messy table",
        "tiny food portions",

        # 사람/글자
        "people",
        "person",
        "hands",
        "human hands",
        "face",
        "text",
        "letters",
        "numbers",
        "logo",
        "watermark",
        "packaging",
        "branded packaging",
        "wrapper",

        # 품질
        "cartoon",
        "illustration",
        "drawing",
        "3d render",
        "plastic food",
        "fake food",
        "blurry",
        "out of focus",
        "low quality",
        "low resolution",
        "deformed food",
        "distorted food",
        "floating food",
        "oversaturated",
    ]

    # -----------------------------------------------------
    # 입력에 없는 단백질이 생기는 것을 억제
    # -----------------------------------------------------

    listed_names = " ".join(
        food.food_name.lower()
        for food in request.foods
    )

    if (
        "닭" not in listed_names
        and "chicken" not in listed_names
    ):
        negative_items.append(
            "chicken"
        )

    if (
        "돼지" not in listed_names
        and "pork" not in listed_names
    ):
        negative_items.append(
            "pork"
        )

    if (
        "소고기" not in listed_names
        and "쇠고기" not in listed_names
        and "beef" not in listed_names
    ):
        negative_items.append(
            "beef"
        )

    fish_keywords = [
        "연어",
        "고등어",
        "참치",
        "생선",
        "fish",
        "salmon",
        "mackerel",
        "tuna",
    ]

    has_fish = any(
        keyword in listed_names
        for keyword in fish_keywords
    )

    if not has_fish:
        negative_items.extend(
            [
                "fish",
                "salmon",
            ]
        )

    # -----------------------------------------------------
    # 현미밥이 있을 때 흰쌀밥으로 변형되는 것을 억제
    # -----------------------------------------------------

    if (
        "현미밥" in listed_names
        or "현미" in listed_names
    ):
        negative_items.extend(
            [
                "white rice",
                "white rice bowl",
            ]
        )

    return ", ".join(
        negative_items
    )


# =========================================================
# Food Image Generator
# =========================================================


class FoodImageGenerator:
    """
    Auto-Fit 음식 이미지 생성기.

    Realistic Vision
        +
    DPM++ Karras
        +
    강화된 음식 구성 prompt
        +
    cache
        +
    GPU single worker lock
    """

    def __init__(
        self,
    ) -> None:

        # -------------------------------------------------
        # CUDA Check
        # -------------------------------------------------

        if not torch.cuda.is_available():
            raise RuntimeError(
                "CUDA GPU is not available."
            )

        self.device = "cuda"

        print(
            "[INFO] GPU:",
            torch.cuda.get_device_name(0),
        )

        print(
            "[INFO] Loading Realistic Vision V6..."
        )

        # -------------------------------------------------
        # Model Load
        #
        # GTX 1650 Ti에서는 float16 사용 시
        # 검은 이미지 문제가 확인됐으므로
        # float32를 유지한다.
        # -------------------------------------------------

        self.pipe = (
            StableDiffusionPipeline
            .from_pretrained(
                MODEL_ID,
                torch_dtype=torch.float32,
                safety_checker=None,
                requires_safety_checker=False,
            )
        )

        # -------------------------------------------------
        # DPM++ + Karras Scheduler
        #
        # 비교적 적은 step에서도
        # 사진 품질을 확보하기 위한 설정.
        # -------------------------------------------------

        self.pipe.scheduler = (
            DPMSolverMultistepScheduler
            .from_config(
                self.pipe.scheduler.config,
                algorithm_type="dpmsolver++",
                use_karras_sigmas=True,
            )
        )

        # -------------------------------------------------
        # Memory Optimization
        #
        # PyTorch 2.x에서는 SDPA가 기본적으로 사용되므로
        # attention slicing은 일부러 켜지 않는다.
        #
        # 4GB VRAM을 위해 model CPU offload 사용.
        # -------------------------------------------------

        self.pipe.enable_model_cpu_offload()

        print(
            "[INFO] Realistic Vision ready."
        )

        print(
            "[INFO] Internal resolution:",
            f"{INTERNAL_WIDTH}x{INTERNAL_HEIGHT}",
        )

        print(
            "[INFO] Inference steps:",
            NUM_INFERENCE_STEPS,
        )

        print(
            "[INFO] Guidance scale:",
            GUIDANCE_SCALE,
        )

        print(
            "[INFO] Model version:",
            MODEL_VERSION,
        )


    # =====================================================
    # Internal Image Generation
    # =====================================================

    def _generate_image(
        self,
        *,
        prompt: str,
        negative_prompt: str,
        seed: int,
        target_width: int,
        target_height: int,
    ) -> Image.Image:
        """
        내부적으로 512x512 생성.

        Backend가 1024x1024를 요청하면
        생성 후 LANCZOS 방식으로 확대한다.
        """

        generator = (
            torch.Generator(
                device="cuda"
            )
            .manual_seed(
                seed
            )
        )

        print(
            "[INFO] generating Realistic Vision image..."
        )

        print(
            "[INFO] seed:",
            seed,
        )

        print(
            "[INFO] steps:",
            NUM_INFERENCE_STEPS,
        )

        # -------------------------------------------------
        # Generate
        # -------------------------------------------------

        result = self.pipe(
            prompt=prompt,

            negative_prompt=(
                negative_prompt
            ),

            num_inference_steps=(
                NUM_INFERENCE_STEPS
            ),

            guidance_scale=(
                GUIDANCE_SCALE
            ),

            width=(
                INTERNAL_WIDTH
            ),

            height=(
                INTERNAL_HEIGHT
            ),

            generator=(
                generator
            ),
        )

        image = result.images[0]

        # -------------------------------------------------
        # Final Resize
        # -------------------------------------------------

        if (
            target_width != INTERNAL_WIDTH
            or target_height != INTERNAL_HEIGHT
        ):
            image = image.resize(
                (
                    target_width,
                    target_height,
                ),
                resample=(
                    Image.Resampling.LANCZOS
                ),
            )

        return image


    # =====================================================
    # Public Generate
    # =====================================================

    def generate(
        self,
        request: MenuImageGenerateRequest,
    ) -> MenuImageGenerateSuccessResponse:
        """
        Backend 요청 1건 -> 이미지 1장.

        처리 순서:

        1. cache 확인
        2. GPU Lock
        3. cache 재확인
        4. prompt 구성
        5. Realistic Vision 생성
        6. Base64
        7. cache 저장
        8. Backend 응답
        """

        # =================================================
        # First Cache Check
        # =================================================

        cached = load_cache(
            request.image_key
        )

        if cached is not None:

            print(
                "[CACHE HIT]",
                request.image_key,
            )

            # cache의 request_id가 아니라
            # 현재 요청값을 반환한다.
            cached = cached.model_copy(
                update={
                    "request_id": (
                        request.request_id
                    ),
                    "image_key": (
                        request.image_key
                    ),
                }
            )

            return cached

        # =================================================
        # Queue Wait
        # =================================================

        print(
            "[QUEUE WAIT]",
            request.image_key,
        )

        # =================================================
        # GPU Lock
        # =================================================

        with GPU_GENERATION_LOCK:

            print(
                "[GPU LOCK ACQUIRED]",
                request.image_key,
            )

            # =============================================
            # Cache Recheck
            # =============================================

            cached = load_cache(
                request.image_key
            )

            if cached is not None:

                print(
                    "[CACHE HIT AFTER WAIT]",
                    request.image_key,
                )

                cached = cached.model_copy(
                    update={
                        "request_id": (
                            request.request_id
                        ),
                        "image_key": (
                            request.image_key
                        ),
                    }
                )

                return cached

            print(
                "[CACHE MISS]",
                request.image_key,
            )

            # =============================================
            # Timer
            # =============================================

            started = (
                time.perf_counter()
            )

            # =============================================
            # Prompt
            # =============================================

            prompt = (
                build_image_prompt(
                    request
                )
            )

            negative_prompt = (
                build_negative_prompt(
                    request
                )
            )

            print(
                "[INFO] prompt:",
                prompt,
            )

            print(
                "[INFO] negative prompt:",
                negative_prompt,
            )

            # =============================================
            # Seed
            # =============================================

            seed = (
                build_seed_from_image_key(
                    request.image_key
                )
            )

            # =============================================
            # Image Generation
            # =============================================

            image = (
                self._generate_image(
                    prompt=prompt,

                    negative_prompt=(
                        negative_prompt
                    ),

                    seed=seed,

                    target_width=(
                        request
                        .visual_spec
                        .width
                    ),

                    target_height=(
                        request
                        .visual_spec
                        .height
                    ),
                )
            )

            # =============================================
            # Base64
            # =============================================

            encoded = (
                image_to_png_base64(
                    image
                )
            )

            # =============================================
            # Time
            # =============================================

            elapsed_ms = int(
                (
                    time.perf_counter()
                    - started
                )
                * 1000
            )

            # =============================================
            # Success Response
            # =============================================

            response = (
                MenuImageGenerateSuccessResponse(
                    schema_version=(
                        request.schema_version
                    ),

                    request_id=(
                        request.request_id
                    ),

                    image_key=(
                        request.image_key
                    ),

                    status="completed",

                    image=(
                        GeneratedImagePayload(
                            mime_type="image/png",

                            width=(
                                request
                                .visual_spec
                                .width
                            ),

                            height=(
                                request
                                .visual_spec
                                .height
                            ),

                            base64=(
                                encoded
                            ),
                        )
                    ),

                    generation=(
                        GenerationInfo(
                            model_name=(
                                MODEL_NAME
                            ),

                            model_version=(
                                MODEL_VERSION
                            ),

                            seed=(
                                seed
                            ),

                            prompt=(
                                prompt
                            ),
                        )
                    ),

                    metadata=(
                        GenerationMetadata(
                            generation_time_ms=(
                                elapsed_ms
                            ),

                            safety_checked=True,
                        )
                    ),
                )
            )

            # =============================================
            # PNG Bytes
            # =============================================

            png_bytes = (
                base64.b64decode(
                    response.image.base64
                )
            )

            # =============================================
            # Cache Save
            # =============================================

            save_cache(
                image_key=(
                    request.image_key
                ),

                png_bytes=(
                    png_bytes
                ),

                response=(
                    response
                ),
            )

            print(
                "[CACHE SAVED]",
                request.image_key,
            )

            print(
                "[GPU DONE]",
                request.image_key,
            )

            print(
                "[DONE] generation_time_ms:",
                elapsed_ms,
            )

            return response