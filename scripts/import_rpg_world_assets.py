#!/usr/bin/env python3
"""Import CC0 overworld scenery plus the complete modular cave dungeon pack; validate catalog JSON."""
from __future__ import annotations

import json
import re
import struct
import urllib.request
import subprocess
import shutil
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "world"
HEADERS = {"User-Agent": "SuperHero-RPG-WorldAssetImporter/1.0"}

SOURCES = {
    "trees/tree1.glb": "https://media.githubusercontent.com/media/anshaneja5/skyline-run/main/public/assets/models/tree1.glb",
    "trees/tree2.glb": "https://media.githubusercontent.com/media/anshaneja5/skyline-run/main/public/assets/models/tree2.glb",
    "trees/tree3.glb": "https://media.githubusercontent.com/media/anshaneja5/skyline-run/main/public/assets/models/tree3.glb",
    "trees/bush.glb": "https://media.githubusercontent.com/media/anshaneja5/skyline-run/main/public/assets/models/bush.glb",
}
OPTIONAL = {
    "landmarks/castle_ruins.glb": "https://cdn.3dassets.dev/assets/23508/v1/model.glb",
}

SOURCES.update({
    "desert/Dune_Sand.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/crystal-crossroads/Dune_Sand.glb",
    "desert/PalmTree_Art.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/tomb-chaser-1/PalmTree_Art.glb",
    "desert/TempleArch01_Art.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/tomb-chaser-1/TempleArch01_Art.glb",
    "desert/Torch_Art.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/tomb-chaser-1/Torch_Art.glb",
    "crystals/Crystal_Cluster.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/crystal-crossroads/Crystal_Cluster.glb",
    "crystals/Crystal_Small_01.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/crystal-crossroads/Crystal_Small_01.glb",
    "ruins/Arc.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/crystal-crossroads/Arc.glb",
    "ruins/Column_SmallBroken_01.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/crystal-crossroads/Column_SmallBroken_01.glb",
    "ruins/Wall_Broken_01.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/crystal-crossroads/Wall_Broken_01.glb",
    "village/Cart.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/medieval-fair/Cart.glb",
    "village/Barrel.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/medieval-fair/Barrel.glb",
    "village/Lamp.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/medieval-fair/Lamp.glb",
    "village/Fair_Entry.glb": "https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/medieval-fair/Fair_Entry.glb",
})


def download(url: str, destination: Path, optional: bool = False) -> bool:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=90) as response, destination.open("wb") as stream:
            while chunk := response.read(1024 * 1024):
                stream.write(chunk)
    except Exception as exc:
        destination.unlink(missing_ok=True)
        if optional:
            print(f"WARNING: optional asset unavailable: {url}: {exc}")
            return False
        raise
    data = destination.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF" or data.startswith(b"version https://git-lfs.github.com/spec/v1"):
        destination.unlink(missing_ok=True)
        if optional:
            print(f"WARNING: optional asset is not a binary glTF: {url}")
            return False
        raise SystemExit(f"Invalid GLB downloaded from {url}")
    version, declared = struct.unpack("<II", data[4:12])
    if version != 2 or declared != len(data):
        destination.unlink(missing_ok=True)
        if optional:
            print(f"WARNING: optional GLB header invalid: {url}")
            return False
        raise SystemExit(f"Invalid GLB header from {url}")
    print(f"OK {destination.relative_to(ROOT)} ({len(data):,} bytes)")
    return True



CAVE_MANIFEST = "https://3dassets.dev/api/v1/packs/cave-and-crystal-networks"
CAVE_OUT = OUT / "dungeons" / "cave-crystal"


def import_cave_pack() -> int:
    request = urllib.request.Request(CAVE_MANIFEST, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=90) as response:
        pack = json.load(response)["data"]
    if pack.get("licenseLabel") != "CC0 1.0 Universal":
        raise SystemExit(f"Unexpected cave pack license label: {pack.get('licenseLabel')}")
    CAVE_OUT.mkdir(parents=True, exist_ok=True)
    assets = pack.get("assets", [])
    if len(assets) != 94:
        raise SystemExit(f"Unexpected cave pack asset count: {len(assets)}")
    catalog = []
    downloaded = 0
    for asset in assets:
        slug = re.sub(r"[^a-z0-9-]+", "-", asset.get("slug", "").lower()).strip("-")
        url = asset.get("cdnUrl", "")
        if not slug or not url.startswith("https://cdn.3dassets.dev/assets/") or not url.endswith("/model.glb"):
            raise SystemExit(f"Unsafe or missing cave asset URL: {asset.get('title')}")
        target = CAVE_OUT / f"{slug}.glb"
        valid = False
        if target.is_file():
            data = target.read_bytes()
            valid = len(data) >= 20 and data[:4] == b"glTF" and not data.startswith(b"version https://git-lfs.github.com/spec/v1")
            if valid:
                version, declared = struct.unpack("<II", data[4:12])
                valid = version == 2 and declared == len(data)
        if not valid:
            target.unlink(missing_ok=True)
            downloaded += int(download(url, target))
        catalog.append({
            "title": asset.get("title", slug),
            "slug": slug,
            "path": f"/assets/world/dungeons/cave-crystal/{slug}.glb",
            "summary": asset.get("summary", ""),
            "triangles": asset.get("stats", {}).get("triangles"),
            "license": "CC0-1.0",
        })
    starter = pack.get("starterScene", {})
    starter_url = starter.get("cdnUrl", "")
    if not starter_url.startswith("https://cdn.3dassets.dev/assets/") or not starter_url.endswith("/model.glb"):
        raise SystemExit("Cave pack starter scene URL is missing or invalid.")
    starter_path = CAVE_OUT / "cave-network-assembly.glb"
    valid = starter_path.is_file() and starter_path.read_bytes()[:4] == b"glTF"
    if not valid:
        starter_path.unlink(missing_ok=True)
        downloaded += int(download(starter_url, starter_path))
    (CAVE_OUT / "catalog.json").write_text(
        json.dumps({"pack": pack.get("title"), "license": "CC0-1.0", "assets": catalog,
                    "starter_scene": "/assets/world/dungeons/cave-crystal/cave-network-assembly.glb"},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Cave and Crystal Caverns: {len(assets)} modular GLBs; {downloaded} downloaded.")
    return downloaded


def import_medieval_village_pack() -> int:
    """Mirror the free Quaternius CC0 Medieval Village MegaKit glTF standard pack."""
    out = OUT / "village-megakit"
    catalog_path = out / "catalog.json"
    if catalog_path.is_file():
        try:
            existing = json.loads(catalog_path.read_text(encoding="utf-8"))
            models = existing.get("models", [])
            if existing.get("license") == "CC0-1.0" and len(models) == 176 and all(
                (ROOT / item["path"].lstrip("/")).is_file()
                and (ROOT / item["path"].lstrip("/")).read_bytes()[:20].lstrip().startswith(b"{")
                for item in models
            ):
                print(f"KEEP Medieval Village MegaKit ({len(models)} glTF models)")
                return 0
        except (OSError, KeyError, TypeError, json.JSONDecodeError):
            pass
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="quaternius-village-") as temp:
        source = Path(temp) / "pack"
        subprocess.run(
            ["git", "clone", "--depth", "1", "https://github.com/J-Ponzo/gltf-medieval-village-megakit.git", str(source)],
            check=True, timeout=300,
        )
        source_dir = source / "glTF"
        if not source_dir.is_dir():
            raise SystemExit("Quaternius Medieval Village MegaKit mirror has no glTF directory.")
        files = sorted(p for p in source_dir.iterdir() if p.is_file() and p.suffix.lower() in {".gltf", ".bin", ".png"})
        gltf_files = [p for p in files if p.suffix.lower() == ".gltf"]
        if len(gltf_files) != 176:
            raise SystemExit(f"Unexpected Medieval Village model count: {len(gltf_files)}")
        target_dir = out / "glTF"
        target_dir.mkdir(parents=True, exist_ok=True)
        for item in files:
            shutil.copy2(item, target_dir / item.name)
        shutil.copy2(source / "LICENSE", out / "LICENSE")
        shutil.copy2(source / "README.md", out / "SOURCE-README.md")
    models = []
    for path in sorted((out / "glTF").glob("*.gltf")):
        document = json.loads(path.read_text(encoding="utf-8"))
        dependencies = []
        for item in list(document.get("buffers", [])) + list(document.get("images", [])):
            uri = item.get("uri")
            if uri:
                dependency = (path.parent / uri).resolve()
                if not dependency.is_file() or dependency.parent != path.parent.resolve():
                    raise SystemExit(f"Missing or unsafe village asset dependency: {path.name} -> {uri}")
                dependencies.append(uri)
        models.append({
            "name": path.stem,
            "path": f"/assets/world/village-megakit/glTF/{path.name}",
            "dependencies": sorted(set(dependencies)),
            "bytes": path.stat().st_size,
        })
    (catalog_path).write_text(json.dumps({
        "pack": "Quaternius Medieval Village MegaKit — Standard glTF mirror",
        "source": "https://github.com/J-Ponzo/gltf-medieval-village-megakit",
        "officialSource": "https://quaternius.itch.io/medieval-village-megakit",
        "license": "CC0-1.0",
        "models": models,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported Medieval Village MegaKit: {len(models)} glTF models and shared texture/buffer dependencies.")
    return len(files)



def import_medieval_castle_pack() -> int:
    """Download the full 149-piece CC0 castle kit and its ready-assembled fortress scene."""
    slug = "medieval-castle-construction"
    manifest_url = f"https://3dassets.dev/api/v1/packs/{slug}"
    request = urllib.request.Request(manifest_url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = json.load(response)
    pack = payload.get("data", payload)
    if pack.get("licenseLabel") != "CC0 1.0 Universal":
        raise SystemExit(f"Unexpected castle pack licence: {pack.get('licenseLabel')}")
    assets = pack.get("assets", [])
    if len(assets) != 149:
        raise SystemExit(f"Unexpected castle model count: {len(assets)}")
    out = OUT / "castle-construction"
    out.mkdir(parents=True, exist_ok=True)
    catalog = []
    downloaded = 0
    for asset in assets:
        name = re.sub(r"[^a-z0-9-]+", "-", asset.get("slug", "").lower()).strip("-")
        url = asset.get("cdnUrl", "")
        if not name or not url.startswith("https://cdn.3dassets.dev/assets/") or not url.endswith("/model.glb"):
            raise SystemExit(f"Unsafe castle asset URL: {asset.get('title')}")
        target = out / "pieces" / f"{name}.glb"
        valid = False
        if target.is_file():
            data = target.read_bytes()
            valid = len(data) >= 20 and data[:4] == b"glTF" and not data.startswith(b"version https://git-lfs.github.com/spec/v1")
            if valid:
                version, declared = struct.unpack("<II", data[4:12])
                valid = version == 2 and declared == len(data)
        if not valid:
            target.unlink(missing_ok=True)
            downloaded += int(download(url, target))
        catalog.append({
            "title": asset.get("title", name),
            "slug": name,
            "path": f"/assets/world/castle-construction/pieces/{name}.glb",
            "license": "CC0-1.0",
            "triangles": asset.get("stats", {}).get("triangles"),
        })
    starter = pack.get("starterScene", {})
    starter_url = starter.get("cdnUrl", "")
    if not starter_url.startswith("https://cdn.3dassets.dev/assets/") or not starter_url.endswith("/model.glb"):
        raise SystemExit("Castle starter scene URL is missing or invalid.")
    starter_path = out / "castle-starter.glb"
    valid = False
    if starter_path.is_file():
        data = starter_path.read_bytes()
        valid = len(data) >= 20 and data[:4] == b"glTF"
        if valid:
            version, declared = struct.unpack("<II", data[4:12])
            valid = version == 2 and declared == len(data)
    if not valid:
        starter_path.unlink(missing_ok=True)
        downloaded += int(download(starter_url, starter_path))
    (out / "catalog.json").write_text(json.dumps({
        "pack": "Medieval Castle Construction",
        "source": f"https://3dassets.dev/packs/{slug}",
        "manifest": manifest_url,
        "license": "CC0-1.0",
        "model_count": len(catalog),
        "starter_scene": "/assets/world/castle-construction/castle-starter.glb",
        "assets": catalog,
    }, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
    print(f"Medieval Castle Construction: {len(catalog)} CC0 GLBs plus assembled fortress; {downloaded} downloaded.")
    return downloaded


def main() -> None:
    downloaded = 0
    for relative, url in SOURCES.items():
        target = OUT / relative
        if not target.is_file():
            downloaded += int(download(url, target))
        else:
            data = target.read_bytes()
            if len(data) < 20 or data[:4] != b"glTF":
                target.unlink()
                downloaded += int(download(url, target))
            else:
                print(f"KEEP {target.relative_to(ROOT)}")
    for relative, url in OPTIONAL.items():
        target = OUT / relative
        valid = False
        if target.is_file():
            data = target.read_bytes()
            valid = len(data) >= 20 and data[:4] == b"glTF" and not data.startswith(b"version https://git-lfs.github.com/spec/v1")
        if not valid:
            target.unlink(missing_ok=True)
            downloaded += int(download(url, target, optional=True))

    downloaded += import_cave_pack()
    downloaded += import_medieval_village_pack()
    downloaded += import_medieval_castle_pack()

    license_text = """RPG WORLD ASSET SOURCES

Trees and bush:
- Original pack: Quaternius Stylized Nature / tree models.
- Mirrored in: anshaneja5/skyline-run, public/assets/models.
- License: CC0 1.0 Universal (public domain dedication).
- Source repository: https://github.com/anshaneja5/skyline-run
- Original creator and pack information: https://quaternius.com/packs/stylizednaturemegakit.html

Castle landmark (when available):
- Pack: Medieval Castle Construction, 3dassets.dev.
- License stated by publisher: CC0 1.0 Universal.
- Source: https://3dassets.dev/packs/medieval-castle-construction
- Download: https://cdn.3dassets.dev/assets/23508/v1/model.glb

Additional environment props (crystals, ruins, desert pieces and village props):\n- Collection: Polygonal Mind CC0 GLB assets.\n- Source repository: https://github.com/ToxSam/cc0-models-Polygonal-Mind\n- Individual files are from projects/crystal-crossroads, projects/tomb-chaser-1 and projects/medieval-fair.\n- License: CC0 as stated by the collection publisher.\n\nCave and Crystal Caverns modular dungeon pack:\n- Source: https://3dassets.dev/packs/cave-and-crystal-networks\n- Manifest: https://3dassets.dev/api/v1/packs/cave-and-crystal-networks\n- 94 individual GLB models plus an assembled starter scene.\n- License: CC0 1.0 Universal, as stated in the pack manifest.\n\nMedieval Castle Construction: 149 modular GLBs plus an assembled castle courtyard starter scene.\n- Source: https://3dassets.dev/packs/medieval-castle-construction\n- Manifest: https://3dassets.dev/api/v1/packs/medieval-castle-construction\n- License: CC0 1.0 Universal.\n\nThe game imports only the listed GLB files. Source attribution is retained here
for provenance even where CC0 does not require attribution.
"""
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "README.md").write_text(license_text, encoding="utf-8")
    required = [OUT / p for p in SOURCES]
    missing = [str(p.relative_to(ROOT)) for p in required if not p.is_file()]
    if missing:
        raise SystemExit("Missing required RPG environment assets: " + ", ".join(missing))
    print(f"RPG world asset import complete; {len(list(OUT.rglob('*.glb')))} GLB files present; {downloaded} downloaded.")


if __name__ == "__main__":
    main()
