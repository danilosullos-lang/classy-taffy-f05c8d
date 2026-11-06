#!/usr/bin/env python3
"""Validate the Poly Haven CC0 PBR texture manifest and imported image bytes."""
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "assets" / "textures" / "polyhaven"

def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

def main() -> None:
    manifest_path = BASE / "manifest.json"
    if not manifest_path.is_file():
        fail("Poly Haven texture manifest is missing.")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        fail(f"Invalid texture manifest JSON: {exc}")
    if manifest.get("license") != "CC0 1.0 Universal":
        fail("Texture manifest must declare CC0 1.0 Universal.")
    assets = manifest.get("assets", [])
    if len(assets) < 10:
        fail(f"Expected at least 10 PBR materials; found {len(assets)}.")
    seen = set()
    count = 0
    for asset in assets:
        asset_id = asset.get("id")
        if not asset_id or asset_id in seen:
            fail(f"Missing or duplicate material id: {asset_id}")
        seen.add(asset_id)
        maps = asset.get("maps", {})
        if not {"diffuse", "normal", "roughness"}.issubset(maps):
            fail(f"{asset_id} is missing diffuse, normal or roughness maps.")
        for channel, record in maps.items():
            rel = record.get("path", "")
            path = ROOT / rel
            if not rel.startswith("assets/textures/polyhaven/") or not path.is_file():
                fail(f"Missing or unsafe texture path: {rel}")
            data = path.read_bytes()
            if len(data) != record.get("bytes"):
                fail(f"Size mismatch: {rel}")
            digest = record.get("md5")
            if digest and hashlib.md5(data).hexdigest().lower() != digest.lower():
                fail(f"MD5 mismatch: {rel}")
            if channel == "diffuse" and data[:2] != bytes((255, 216)):
                fail(f"Diffuse map is not a JPEG: {rel}")
            if channel in ("normal", "metalness") and data[:8] != bytes((137, 80, 78, 71, 13, 10, 26, 10)):
                fail(f"{channel} map is not a PNG: {rel}")
            count += 1
    missing_roles = {role: asset_id for role, asset_id in manifest.get("roles", {}).items() if asset_id not in seen}
    if missing_roles:
        fail(f"Role mappings point to materials absent from the verified manifest: {missing_roles}")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for token in ("tg.setAttribute('uv'", "rpgApplyTerrainPbr", "rpgPbrTexture"):
        if token not in html:
            fail(f"Game integration marker missing: {token}")
    print(f"Poly Haven validation complete: {len(assets)} CC0 materials, {count} image maps verified.")

if __name__ == "__main__":
    main()
