#!/usr/bin/env python3
"""Download allowlisted, source-only Elbera research kits with SHA-256 checks.

No game client files are downloaded or bundled. Archives are never executed.
"""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent
DOWNLOADS = ROOT / "downloads"
VENDOR = ROOT / "vendor"
KITS = {
    "core": {
        "filename": "elbera-tools-core-0.2.0-preview.zip",
        "url": "https://github.com/elberacasa/Lineage2Elbera/releases/download/elbera-tools-core-v0.2.0-preview/elbera-tools-core-0.2.0-preview.zip",
        "sha256": "fa614de28e8180c20d416c116c3a317068cff9822b0061cdfc7de52cbcd674c5",
        "smoke": "python3 tools/release/smoke_core.py",
    },
    "bsp": {
        "filename": "elbera-tools-bsp-inspector-0.1.0.zip",
        "url": "https://github.com/elberacasa/Lineage2Elbera/releases/download/elbera-tools-bsp-inspector-v0.1.0/elbera-tools-bsp-inspector-0.1.0.zip",
        "sha256": "fdc788d0d8e1e26f2bfe02a7054aaf67ff7092535111438f067f7ed7622490a4",
        "smoke": "python3 tools/release/smoke_bsp.py",
    },
    "npc": {
        "filename": "elbera-tools-npc-source-0.1.0.zip",
        "url": "https://github.com/elberacasa/Lineage2Elbera/releases/download/elbera-tools-npc-source-v0.1.0/elbera-tools-npc-source-0.1.0.zip",
        "sha256": "e1a6cf742d8e7b414ac3fbdb7c8f2deb1ce1cc57d09e45125991a977e34e2b98",
        "smoke": "python3 tools/release/smoke_npc_source.py",
    },
}


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_members(archive: zipfile.ZipFile) -> list[str]:
    infos = archive.infolist()
    if len(infos) > 500:
        raise ValueError("Archive has too many entries")
    total = sum(item.file_size for item in infos)
    if total > 20 * 1024 * 1024:
        raise ValueError("Archive exceeds the 20 MiB extraction limit")
    names = []
    for item in infos:
        name = item.filename
        path = PurePosixPath(name)
        mode = item.external_attr >> 16
        first = path.parts[0] if path.parts else ""
        if (path.is_absolute() or ".." in path.parts or not path.parts
                or "\\" in name or ":" in first):
            raise ValueError(f"Unsafe archive path: {name!r}")
        if stat.S_ISLNK(mode):
            raise ValueError(f"Symlink is not allowed: {name!r}")
        names.append(name)
    return names


def download(key: str) -> Path:
    spec = KITS[key]
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    destination = DOWNLOADS / spec["filename"]
    request = urllib.request.Request(
        spec["url"], headers={"User-Agent": "RPG-Interlude-Reference-Toolkit/1.0"}
    )
    temporary = destination.with_suffix(destination.suffix + ".part")
    try:
        with urllib.request.urlopen(request, timeout=45) as response, temporary.open("wb") as out:
            final_host = response.geturl().split("/", 3)[2].lower()
            if not (final_host == "github.com" or final_host.endswith(".githubusercontent.com")):
                raise ValueError(f"Unexpected download host: {final_host}")
            size = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > 10 * 1024 * 1024:
                    raise ValueError("Download exceeds the 10 MiB archive limit")
                out.write(chunk)
        actual = digest(temporary)
        if actual != spec["sha256"]:
            raise ValueError(f"SHA-256 mismatch for {key}: {actual}")
        with zipfile.ZipFile(temporary) as archive:
            safe_members(archive)
            bad = archive.testzip()
            if bad:
                raise ValueError(f"Corrupt ZIP member: {bad}")
        os.replace(temporary, destination)
        return destination
    finally:
        if temporary.exists():
            temporary.unlink()


def extract(key: str, archive_path: Path) -> Path:
    target = VENDOR / key
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive_path) as archive:
        safe_members(archive)
        archive.extractall(target)
    return target


def self_test() -> None:
    assert len(KITS) == 3
    for spec in KITS.values():
        assert len(spec["sha256"]) == 64
        assert spec["url"].startswith("https://github.com/elberacasa/Lineage2Elbera/releases/")
        assert Path(spec["filename"]).name == spec["filename"]
    fixture = ROOT / "_self_test.zip"
    try:
        with zipfile.ZipFile(fixture, "w") as archive:
            archive.writestr("safe/file.txt", "ok")
        with zipfile.ZipFile(fixture) as archive:
            assert safe_members(archive) == ["safe/file.txt"]
        with zipfile.ZipFile(fixture, "w") as archive:
            archive.writestr("../escape.txt", "no")
        with zipfile.ZipFile(fixture) as archive:
            try:
                safe_members(archive)
            except ValueError:
                pass
            else:
                raise AssertionError("Path traversal archive was accepted")
        with zipfile.ZipFile(fixture, "w") as archive:
            archive.writestr("C:/escape.txt", "no")
        with zipfile.ZipFile(fixture) as archive:
            try:
                safe_members(archive)
            except ValueError:
                pass
            else:
                raise AssertionError("Drive-path archive was accepted")
    finally:
        fixture.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kits", nargs="*", help="kit names (core, bsp, npc); default: all")
    parser.add_argument("--extract", action="store_true", help="extract verified archives under vendor/")
    parser.add_argument("--self-test", action="store_true", help="run offline downloader safety checks")
    args = parser.parse_args()
    unknown = [key for key in args.kits if key not in KITS]
    if unknown:
        parser.error("unknown kit(s): " + ", ".join(unknown))
    if args.self_test:
        self_test()
        print("Downloader safety checks passed.")
        return 0
    selected = args.kits or list(KITS)
    for key in selected:
        path = download(key)
        print(f"Verified {key}: {path} (sha256 {digest(path)})")
        if args.extract:
            print(f"Extracted {key}: {extract(key, path)}")
    print("Archives are source-only research tools; they do not include Lineage II assets.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
