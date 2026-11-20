#!/usr/bin/env python3
"""Validate the locally shipped KayKit CC0 weapon models and texture atlas."""
from pathlib import Path
import json
import struct

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "assets/weapons/kaykit-fantasy-weapons-bits"

def main():
    catalog_path = PACK / "catalog.json"
    license_path = PACK / "LICENSE-KayKit-CC0.txt"
    texture_path = PACK / "weapons_bits_texture.png"
    if not catalog_path.is_file() or not license_path.is_file() or not texture_path.is_file():
        raise SystemExit("Weapon catalog, CC0 license, or shared texture atlas is missing.")
    license_text = license_path.read_text(encoding="utf-8", errors="replace").lower()
    if "cc0" not in license_text and "creative commons zero" not in license_text:
        raise SystemExit("KayKit CC0 license text is missing or unrecognized.")
    if texture_path.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("Weapon texture atlas is not a valid PNG.")
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    models = catalog.get("models", [])
    if len(models) < 30:
        raise SystemExit(f"Expected at least 30 weapon models, found {len(models)}.")
    required = {"sword_A", "sword_G", "bow_A_withString", "dagger_C",
                "axe_D", "hammer_D", "staff_D", "wand_B", "spear_B",
                "halberd", "shield_D", "fistweapon_C_left", "fistweapon_C_right"}
    found = {item.get("id") for item in models}
    missing = sorted(required - found)
    if missing:
        raise SystemExit("Missing weapon families/grades: " + ", ".join(missing))
    total = 0
    for item in models:
        model = PACK / item["path"]
        buffer = PACK / item["buffer"]
        if not model.is_file() or not buffer.is_file():
            raise SystemExit(f"Missing glTF or binary buffer for {item.get('id')}.")
        raw = model.read_bytes()
        if len(raw) < 500 or raw.startswith(b"version https://git-lfs.github.com/spec/v1"):
            raise SystemExit(f"{model.name} is a Git LFS pointer or truncated, not glTF JSON.")
        doc = json.loads(raw.decode("utf-8"))
        if doc.get("asset", {}).get("version") != "2.0":
            raise SystemExit(f"{model.name} is not glTF 2.0.")
        buffers = doc.get("buffers", [])
        images = doc.get("images", [])
        if not any(b.get("uri") == buffer.name and b.get("byteLength") == buffer.stat().st_size for b in buffers):
            raise SystemExit(f"{model.name} has a missing or size-mismatched buffer.")
        if not any(i.get("uri") == texture_path.name for i in images):
            raise SystemExit(f"{model.name} does not reference the shared texture atlas.")
        total += buffer.stat().st_size
    print(f"Validated {len(models)} textured KayKit weapons; {total:,} bytes of mesh buffers; CC0 license and PNG atlas OK.")

if __name__ == "__main__":
    main()
