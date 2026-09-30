from __future__ import annotations

import json
import re
from pathlib import Path

from app.schemas import (
    GeneratedImagePayload,
    GenerationInfo,
    GenerationMetadata,
    MenuImageGenerateSuccessResponse,
)


CACHE_ROOT = Path("cache")


def _safe_key(
    image_key: str,
) -> str:
    """
    image_key를 파일명으로 안전하게 변환.
    """

    safe = re.sub(
        r"[^a-zA-Z0-9._-]",
        "_",
        image_key,
    )

    return safe


def get_cache_paths(
    image_key: str,
) -> tuple[
    Path,
    Path,
]:
    safe_key = _safe_key(
        image_key
    )

    image_dir = (
        CACHE_ROOT
        / "images"
    )

    metadata_dir = (
        CACHE_ROOT
        / "metadata"
    )

    image_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    metadata_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    image_path = (
        image_dir
        / f"{safe_key}.png"
    )

    metadata_path = (
        metadata_dir
        / f"{safe_key}.json"
    )

    return (
        image_path,
        metadata_path,
    )


def cache_exists(
    image_key: str,
) -> bool:
    image_path, metadata_path = (
        get_cache_paths(
            image_key
        )
    )

    return (
        image_path.exists()
        and metadata_path.exists()
    )


def save_cache(
    *,
    image_key: str,
    png_bytes: bytes,
    response: MenuImageGenerateSuccessResponse,
) -> None:
    image_path, metadata_path = (
        get_cache_paths(
            image_key
        )
    )

    image_path.write_bytes(
        png_bytes
    )

    metadata = response.model_dump()

    # Base64는 metadata JSON에 저장하지 않음
    # 용량이 너무 커지므로 제거
    metadata["image"]["base64"] = ""

    with open(
        metadata_path,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            metadata,
            f,
            ensure_ascii=False,
            indent=2,
        )


def load_cache(
    image_key: str,
) -> MenuImageGenerateSuccessResponse | None:
    if not cache_exists(
        image_key
    ):
        return None

    image_path, metadata_path = (
        get_cache_paths(
            image_key
        )
    )

    try:
        png_bytes = (
            image_path.read_bytes()
        )

        import base64

        encoded = (
            base64.b64encode(
                png_bytes
            )
            .decode("ascii")
        )

        with open(
            metadata_path,
            "r",
            encoding="utf-8",
        ) as f:
            metadata = (
                json.load(f)
            )

        return (
            MenuImageGenerateSuccessResponse(
                schema_version=(
                    metadata[
                        "schema_version"
                    ]
                ),

                request_id=(
                    metadata[
                        "request_id"
                    ]
                ),

                image_key=(
                    metadata[
                        "image_key"
                    ]
                ),

                status="completed",

                image=GeneratedImagePayload(
                    mime_type=(
                        metadata[
                            "image"
                        ][
                            "mime_type"
                        ]
                    ),

                    width=(
                        metadata[
                            "image"
                        ][
                            "width"
                        ]
                    ),

                    height=(
                        metadata[
                            "image"
                        ][
                            "height"
                        ]
                    ),

                    base64=(
                        encoded
                    ),
                ),

                generation=GenerationInfo(
                    model_name=(
                        metadata[
                            "generation"
                        ][
                            "model_name"
                        ]
                    ),

                    model_version=(
                        metadata[
                            "generation"
                        ][
                            "model_version"
                        ]
                    ),

                    seed=(
                        metadata[
                            "generation"
                        ][
                            "seed"
                        ]
                    ),

                    prompt=(
                        metadata[
                            "generation"
                        ][
                            "prompt"
                        ]
                    ),
                ),

                metadata=GenerationMetadata(
                    generation_time_ms=(
                        metadata[
                            "metadata"
                        ][
                            "generation_time_ms"
                        ]
                    ),

                    safety_checked=(
                        metadata[
                            "metadata"
                        ][
                            "safety_checked"
                        ]
                    ),
                ),
            )
        )

    except Exception:
        return None