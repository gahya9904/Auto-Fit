import json
from pathlib import Path

from app.schemas import FoodImageLabel


def ensure_output_dirs(base_dir: Path) -> tuple[Path, Path, Path]:
    images_dir = base_dir / "generated" / "images"
    labels_dir = base_dir / "generated" / "labels"
    manifest_path = base_dir / "generated" / "manifest.jsonl"

    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    return images_dir, labels_dir, manifest_path


def save_label_json(label: FoodImageLabel) -> None:
    label_path = Path(label.label_path)
    label_path.parent.mkdir(parents=True, exist_ok=True)

    with open(label_path, "w", encoding="utf-8") as f:
        json.dump(
            label.model_dump(),
            f,
            ensure_ascii=False,
            indent=2,
        )


def append_manifest(
    manifest_path: Path,
    label: FoodImageLabel,
) -> None:
    with open(manifest_path, "a", encoding="utf-8") as f:
        f.write(
            json.dumps(
                label.model_dump(),
                ensure_ascii=False,
            )
            + "\n"
        )