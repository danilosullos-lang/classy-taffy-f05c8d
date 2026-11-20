#!/usr/bin/env python3
"""Validate imported CC0 RPG sound effects and music files."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "assets" / "audio"
CATALOG = AUDIO / "catalog.json"
MUSIC = {
    "assets/audio/qubodup-two-game-music-loops/menu-loop.ogg",
    "assets/audio/qubodup-two-game-music-loops/battle-loop.ogg",
    "assets/audio/paul-wortmann-dark-cavern-ambient/dark-cavern-loop.ogg",
}


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    if catalog.get("license") != "CC0-1.0":
        raise SystemExit("Audio catalog license must be CC0-1.0")
    packs = catalog.get("packs", [])
    assets = catalog.get("assets", [])
    if not packs or not assets:
        raise SystemExit("Audio catalog is empty")
    for pack in packs:
        if pack.get("license") != "CC0-1.0":
            raise SystemExit(f"Non-CC0 audio pack: {pack.get('id')}")
        count = sum(1 for item in assets if item.get("pack") == pack.get("id"))
        if count != pack.get("files"):
            raise SystemExit(f"Pack count mismatch: {pack.get('id')} ({count} != {pack.get('files')})")
    seen = set()
    for item in assets:
        rel = item.get("file", "")
        if not rel.startswith("assets/audio/") or rel in seen:
            raise SystemExit(f"Invalid or duplicate audio path: {rel}")
        seen.add(rel)
        path = ROOT / rel
        if not path.is_file():
            raise SystemExit(f"Missing audio asset: {rel}")
        raw = path.read_bytes()
        if len(raw) != item.get("bytes"):
            raise SystemExit(f"Audio size mismatch: {rel}")
        if hashlib.sha256(raw).hexdigest() != item.get("sha256"):
            raise SystemExit(f"Audio SHA-256 mismatch: {rel}")
    missing = MUSIC - seen
    if missing:
        raise SystemExit("Missing music tracks: " + ", ".join(sorted(missing)))
    for rel in MUSIC:
        if (ROOT / rel).read_bytes()[:4] != b"OggS":
            raise SystemExit(f"Music track is not a valid OGG stream: {rel}")
    print(f"Validated {len(assets)} CC0 audio files across {len(packs)} packs; 3 OGG music tracks verified.")


if __name__ == "__main__":
    main()
