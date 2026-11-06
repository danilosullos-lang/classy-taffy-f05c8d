#!/usr/bin/env python3
"""Import verified CC0 RPG audio archives into the static game assets."""
from __future__ import annotations
import hashlib, io, json, pathlib, urllib.request, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "audio"
PACKS = [
    {
        "id": "kenney-rpg-audio",
        "url": "https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip",
        "license": "CC0-1.0",
        "author": "Kenney",
        "source": "https://opengameart.org/content/50-rpg-sound-effects",
    },
    {
        "id": "qubodup-two-game-music-loops",
        "license": "CC0-1.0",
        "author": "qubodup",
        "source": "https://opengameart.org/content/two-simple-game-music-loops",
        "files": [
            {"name": "menu-loop.ogg", "url": "https://opengameart.org/sites/default/files/menumusicloop-tiggo.ogg"},
            {"name": "battle-loop.ogg", "url": "https://opengameart.org/sites/default/files/levelmusicloop-tigrun.ogg"}
        ]
    },
    {
        "id": "paul-wortmann-dark-cavern-ambient",
        "license": "CC0-1.0",
        "author": "Paul Wortmann",
        "source": "https://opengameart.org/content/dark-cavern-ambient",
        "files": [
            {"name": "dark-cavern-loop.ogg", "url": "https://opengameart.org/sites/default/files/dark_cavern_ambient_002.ogg"}
        ]
    },
    {
        "id": "rubberduck-80-rpg-sfx",
        "url": "https://opengameart.org/sites/default/files/80-CC0-RPG-SFX_0.zip",
        "license": "CC0-1.0",
        "author": "rubberduck",
        "source": "https://opengameart.org/content/80-cc0-rpg-sfx",
    },
    {
        "id": "ogrebane-monster-sfx",
        "url": "https://opengameart.org/sites/default/files/monster_sfx_pack.zip",
        "license": "CC0-1.0",
        "author": "Ogrebane",
        "source": "https://opengameart.org/content/monster-sound-effects-pack",
    },
    {
        "id": "rubberduck-80-creature-sfx",
        "url": "https://opengameart.org/sites/default/files/80-CC0-creature-SFX_0.zip",
        "license": "CC0-1.0",
        "author": "rubberduck",
        "source": "https://opengameart.org/content/80-cc0-creature-sfx",
    },
]
AUDIO_EXTS = {".ogg", ".wav", ".mp3", ".flac", ".m4a"}
MAX_ARCHIVE = 32 * 1024 * 1024
MAX_FILE = 8 * 1024 * 1024

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    catalog = {"license": "CC0-1.0", "packs": [], "assets": []}
    for pack in PACKS:
        folder = DEST / pack["id"]
        folder.mkdir(parents=True, exist_ok=True)
        if pack.get("files"):
            imported = []
            for asset in pack["files"]:
                req = urllib.request.Request(asset["url"], headers={"User-Agent": "SuperHeroRPG-AssetImporter/1.0"})
                with urllib.request.urlopen(req, timeout=45) as response:
                    raw = response.read(MAX_FILE + 1)
                if not raw or len(raw) > MAX_FILE:
                    raise RuntimeError(f"Invalid audio file size: {pack['id']}/{asset['name']}")
                target = folder / pathlib.Path(asset["name"]).name
                target.write_bytes(raw)
                imported.append({"pack": pack["id"], "file": target.relative_to(ROOT).as_posix(),
                                 "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
            catalog["packs"].append({**pack, "files": len(imported)})
            catalog["assets"].extend(imported)
            print(f"{pack['id']}: {len(imported)} music tracks")
            continue
        req = urllib.request.Request(pack["url"], headers={"User-Agent": "SuperHeroRPG-AssetImporter/1.0"})
        with urllib.request.urlopen(req, timeout=45) as response:
            data = response.read(MAX_ARCHIVE + 1)
        if len(data) > MAX_ARCHIVE:
            raise RuntimeError(f"Archive too large: {pack['id']}")
        digest = hashlib.sha256(data).hexdigest()
        imported = []
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for info in archive.infolist():
                if info.is_dir() or pathlib.PurePosixPath(info.filename).suffix.lower() not in AUDIO_EXTS:
                    continue
                if info.file_size > MAX_FILE or info.file_size == 0:
                    continue
                parts = [p for p in pathlib.PurePosixPath(info.filename).parts if p not in ("..", ".", "/")]
                if not parts:
                    continue
                target = folder.joinpath(*parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                raw = archive.read(info)
                if len(raw) > MAX_FILE:
                    continue
                target.write_bytes(raw)
                if not raw or len(raw) > MAX_FILE:
                    continue
                record = {"pack": pack["id"], "file": target.relative_to(ROOT).as_posix(),
                          "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
                imported.append(record)
        if not imported:
            raise RuntimeError(f"No audio files imported from {pack['id']}")
        catalog["packs"].append({**pack, "archive_sha256": digest, "files": len(imported)})
        catalog["assets"].extend(imported)
        print(f"{pack['id']}: {len(imported)} audio files")
    (DEST / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(catalog['assets'])} audio files into {DEST}")

if __name__ == "__main__":
    main()
