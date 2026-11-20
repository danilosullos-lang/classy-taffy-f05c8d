#!/usr/bin/env python3
"""Validate all imported RPG world GLB assets are real, self-contained binaries."""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / "assets" / "world"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    files = sorted(WORLD.rglob("*.glb"))
    if not files:
        fail("No RPG world GLB files found.")
    for path in files:
        data = path.read_bytes()
        if data.startswith(b"version https://git-lfs.github.com/spec/v1"):
            fail(f"{path.relative_to(ROOT)} is a Git LFS pointer, not a model.")
        if len(data) < 20 or data[:4] != b"glTF":
            fail(f"{path.relative_to(ROOT)} is not a binary glTF.")
        version, declared = struct.unpack("<II", data[4:12])
        if version != 2 or declared != len(data):
            fail(f"{path.relative_to(ROOT)} has an invalid GLB header/length.")
        json_length, json_type = struct.unpack("<II", data[12:20])
        if json_type != 0x4E4F534A or 20 + json_length > len(data):
            fail(f"{path.relative_to(ROOT)} has no valid GLB JSON chunk.")
        import json
        try:
            document = json.loads(data[20:20 + json_length].decode("utf-8").rstrip(" \\t\\r\\n\\0"))
        except (UnicodeError, json.JSONDecodeError) as exc:
            fail(f"{path.relative_to(ROOT)} has invalid glTF JSON: {exc}")
        if not document.get("meshes") or not document.get("nodes"):
            fail(f"{path.relative_to(ROOT)} contains no visible mesh nodes.")
        print(f"OK {path.relative_to(ROOT)} ({len(data):,} bytes; {len(document['meshes'])} mesh(es))")
    readme = WORLD / "README.md"
    if not readme.is_file() or "CC0" not in readme.read_text(encoding="utf-8"):
        fail("assets/world/README.md must document the CC0 asset sources.")
    catalog_path = WORLD / "dungeons" / "cave-crystal" / "catalog.json"
    if not catalog_path.is_file():
        fail("Cave and Crystal Caverns catalog is missing.")
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        fail(f"Cave catalog JSON is invalid: {exc}")
    assets = catalog.get("assets", [])
    if catalog.get("license") != "CC0-1.0" or len(assets) != 94:
        fail("Cave catalog must contain all 94 CC0 models.")
    missing = [asset.get("path") for asset in assets
               if not (ROOT / str(asset.get("path", "").lstrip("/"))).is_file()]
    if missing:
        fail(f"Cave catalog references missing models: {missing[:5]}")
    village_catalog_path = WORLD / "village-megakit" / "catalog.json"
    if not village_catalog_path.is_file():
        fail("Quaternius Medieval Village MegaKit catalog is missing.")
    try:
        village = json.loads(village_catalog_path.read_text(encoding="utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        fail(f"Village catalog JSON is invalid: {exc}")
    models = village.get("models", [])
    if village.get("license") != "CC0-1.0" or len(models) != 176:
        fail("Village MegaKit catalog must contain all 176 CC0 glTF models.")
    for model in models:
        path = ROOT / str(model.get("path", "")).lstrip("/")
        if not path.is_file():
            fail(f"Village catalog references missing model: {model.get('path')}")
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeError, json.JSONDecodeError) as exc:
            fail(f"{path.relative_to(ROOT)} has invalid glTF JSON: {exc}")
        if document.get("asset", {}).get("version") != "2.0" or not document.get("meshes"):
            fail(f"{path.relative_to(ROOT)} is not a valid glTF 2.0 model.")
        for dependency in list(document.get("buffers", [])) + list(document.get("images", [])):
            uri = dependency.get("uri")
            if uri and not (path.parent / uri).is_file():
                fail(f"{path.relative_to(ROOT)} is missing dependency {uri}")
    print(f"RPG world validation complete: {len(files)} real GLB model(s), {len(assets)} cave assets and {len(models)} modular village glTF models.")


if __name__ == "__main__":
    main()
