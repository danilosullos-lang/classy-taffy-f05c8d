#!/usr/bin/env python3
"""Import a curated, animated CC0 monster set from Gobkit into the game."""
from __future__ import annotations
import json, re, struct, time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://gobkit.com/api/free"
OUT = ROOT / "assets/monsters/packs/gobkit"
CATALOG = ROOT / "assets/monsters/catalog.json"
UA = "SuperHeroGame-CC0-Monster-Importer/1.0"
# Curated creatures/enemies only; skip humans, scenery and ordinary wildlife.
WANTED = {
    "minion-a01", "minion-a02", "minion-b01", "minion-b02",
    "minion-c01", "minion-c02", "minion-d01", "minion-d02",
    "ankylosaurus", "carnotaurus", "oviraptor", "pachycephalosaurus",
    "plesiosaurus", "pterodactylus", "spinosaurus", "stegosaurus",
    "trex", "triceratops",
    "pumpkinscarecrow", "sheetghost", "stitchedbrute", "tombmummy",
    "vampirecountess", "werewolfcaptain", "cleaverbutcher", "nightwitch",
    "antlionlarva", "scorpion", "orchidmantis", "manticora",
    "titanbeetle", "atlasbeetle", "herculesbeetle", "giantwaterbug",
    "cockroach", "tigerbeetle", "leafcutterant",
    "orcironguard", "orclegionarcher", "orclegioncommander",
    "orclegionary", "orcshieldbearer", "orcwardrummer",
    "orcwarshaman", "orcwarbandchampion",
}
MAX_FILE = 12 * 1024 * 1024
MAX_TOTAL = 90 * 1024 * 1024
# Import the full creature-focused Gobkit packs, not only the original hand-picked samples.
# Modern civilian/occupation character packs and static environment props remain excluded.
EXTRA_PACKS = {
    "gobkit-animal-pack", "gobkit-animal006-pack", "gobkit-animal007-pack",
    "gobkit-animal008-pack", "gobkit-animal009-pack", "gobkit-animal011-pack",
    "gobkit-animalB-pack", "gobkit-birds-pack",
    "gobkit-insect001-pack", "gobkit-insect002-pack", "gobkit-human010-pack",
}

def fetch_json(url: str):
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))

def safe_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-") or "pack"

def parse_glb(raw: bytes, label: str):
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise ValueError(f"{label}: missing GLB magic/header")
    version, declared = struct.unpack_from("<II", raw, 4)
    if version != 2 or declared != len(raw):
        raise ValueError(f"{label}: GLB version/length mismatch")
    offset, doc, bin_size = 12, None, 0
    while offset < len(raw):
        if offset + 8 > len(raw):
            raise ValueError(f"{label}: truncated chunk header")
        size, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        if offset + size > len(raw):
            raise ValueError(f"{label}: truncated chunk")
        chunk = raw[offset:offset + size]
        if kind == 0x4E4F534A:
            doc = json.loads(chunk.decode("utf-8").rstrip(" \x00"))
        elif kind == 0x004E4942:
            bin_size += size
        offset += size
    if not doc or doc.get("asset", {}).get("version") != "2.0":
        raise ValueError(f"{label}: missing glTF 2.0 JSON")
    buffers = doc.get("buffers", [])
    if buffers and (len(buffers) != 1 or buffers[0].get("uri")):
        raise ValueError(f"{label}: GLB has unsupported external buffers")
    if buffers and bin_size < int(buffers[0].get("byteLength", 0)):
        raise ValueError(f"{label}: BIN chunk shorter than declared buffer")
    views = doc.get("bufferViews", [])
    for i, view in enumerate(views):
        if int(view.get("buffer", 0)) != 0:
            raise ValueError(f"{label}: bufferView {i} references missing buffer")
        start = int(view.get("byteOffset", 0))
        end = start + int(view.get("byteLength", 0))
        if end > bin_size:
            raise ValueError(f"{label}: bufferView {i} exceeds BIN chunk")
    for i, image in enumerate(doc.get("images", [])):
        if "bufferView" in image:
            if int(image["bufferView"]) >= len(views):
                raise ValueError(f"{label}: image {i} has invalid bufferView")
            if not image.get("mimeType"):
                raise ValueError(f"{label}: image {i} missing mimeType")
        elif image.get("uri"):
            if not image["uri"].startswith("data:"):
                raise ValueError(f"{label}: image {i} has external URI")
        else:
            raise ValueError(f"{label}: image {i} has no embedded source")
    clips = doc.get("animations", [])
    for i, clip in enumerate(clips):
        if not clip.get("samplers") or not clip.get("channels"):
            raise ValueError(f"{label}: animation {i} is incomplete")
    return doc, bin_size

def main():
    source = fetch_json(API)
    if source.get("schemaVersion") != 2 or not isinstance(source.get("packs"), list):
        raise SystemExit("Gobkit API schema changed; refusing an unsafe import.")
    selected = {}
    for pack in source["packs"]:
        pack_id = str(pack.get("id") or pack.get("name") or pack.get("pack") or "gobkit")
        for model in pack.get("models", []):
            model_id = str(model.get("id", "")).lower()
            if model_id not in WANTED and pack_id not in EXTRA_PACKS:
                continue
            license_text = str(model.get("license") or source.get("license") or "")
            if "CC0 1.0" not in license_text:
                print(f"Skip {model_id}: no explicit CC0 license in API metadata")
                continue
            if not model.get("rigged") or not model.get("animations"):
                print(f"Skip {model_id}: not rigged/animated")
                continue
            url = model.get("url", "")
            if not url.startswith("https://gobkit.com/freebies/") or not url.endswith(".glb"):
                print(f"Skip {model_id}: unexpected model URL")
                continue
            selected[model_id] = (pack_id, model, license_text)
    if not selected:
        raise SystemExit("No curated CC0 animated monsters found in Gobkit API.")
    existing = json.loads(CATALOG.read_text(encoding="utf-8")) if CATALOG.exists() else {"monsters": []}
    monsters = existing.get("monsters", [])
    by_path = {item.get("path"): item for item in monsters}
    OUT.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    imported = 0
    for model_id, (pack_id, meta, license_text) in sorted(selected.items()):
        pack_slug = safe_slug(pack_id)
        dest_dir = OUT / pack_slug
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{model_id}.glb"
        rel = dest.relative_to(ROOT).as_posix()
        # A prior LFS checkout may leave a  pointer in the working tree when LFS smudging is disabled.
        # Re-download that file instead of treating the 131-byte pointer as a real GLB.
        if dest.exists() and dest.read_bytes()[:4] != b"glTF":
            dest.unlink()
        if not dest.exists():
            req = Request(meta["url"], headers={"User-Agent": UA})
            with urlopen(req, timeout=90) as response:
                raw = response.read(MAX_FILE + 1)
            if len(raw) > MAX_FILE:
                print(f"Skip {model_id}: exceeds {MAX_FILE} byte mobile import limit")
                continue
            if total_bytes + len(raw) > MAX_TOTAL:
                print("Reached curated pack size limit; remaining models will be picked up on a later run.")
                break
            doc, bin_size = parse_glb(raw, model_id)
            dest.write_bytes(raw)
            total_bytes += len(raw)
        else:
            raw = dest.read_bytes()
            doc, bin_size = parse_glb(raw, model_id)
        animations = [str(clip.get("name") or f"animation-{i}") for i, clip in enumerate(doc.get("animations", []))]
        if not animations:
            print(f"Skip {model_id}: GLB contains no animation clips")
            dest.unlink(missing_ok=True)
            continue
        entry = {
            "name": str(meta.get("name") or model_id),
            "pack": f"gobkit-{pack_slug}",
            "format": "glb",
            "path": rel,
            "animated": True,
            "rigged": True,
            "animationCount": len(animations),
            "animations": animations,
            "source": "Gobkit",
            "sourceUrl": meta["url"],
            "license": "CC0 1.0 Universal",
            "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
            "licenseEvidence": license_text,
            "bytes": len(raw),
        }
        by_path[rel] = entry
        imported += 1
        print(f"Validated {model_id}: {len(animations)} clips, {len(raw)} bytes, {bin_size} buffer bytes")
    monsters = sorted(by_path.values(), key=lambda x: (x.get("pack", ""), x.get("name", ""), x.get("path", "")))
    # Preserve per-pack provenance for every Quaternius model already in the catalog.
    for item in monsters:
        rel = str(item.get("path", "")).lower()
        if "quaternius-cute" in rel:
            item.update({
                "source": "Quaternius",
                "sourceUrl": "https://quaternius.com/packs/cutemonsters",
                "license": "CC0 1.0 Universal",
                "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
                "licenseEvidence": "Official Quaternius pack page displays CC0 1.0 and states that the models are free for personal and commercial projects."
            })
        elif "quaternius-ultimate-monsters" in rel or "ultimate-monsters" in rel:
            item.update({
                "source": "Quaternius",
                "sourceUrl": "https://quaternius.com/packs/ultimatemonsters.html",
                "license": "CC0 1.0 Universal",
                "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
                "licenseEvidence": "Official Quaternius Ultimate Monsters page displays CC0 1.0 and states that the 50 animated monsters are free for personal and commercial projects."
            })
    existing.update({
        "version": max(1, int(existing.get("version", 1))),
        "count": len(monsters),
        "monsters": monsters,
        "sources": [
            {"name": "Quaternius Cute Animated Monsters Pack", "url": "https://quaternius.com/packs/cutemonsters", "license": "CC0 1.0 Universal"},
            {"name": "Quaternius Ultimate Monsters Pack", "url": "https://quaternius.com/packs/ultimatemonsters.html", "license": "CC0 1.0 Universal"},
            {"name": "Gobkit Free 3D Assets", "url": "https://gobkit.com/freebies", "api": API, "license": "CC0 1.0 Universal"}
        ],
        "updatedAt": time.strftime("%Y-%m-%d", time.gmtime()),
        "note": "Additive catalog. Quaternius and Gobkit provenance is recorded per model; Gobkit models are self-contained GLB with named animation clips."
    })
    CATALOG.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if imported == 0 and not any(item.get("source") == "Gobkit" for item in monsters):
        raise SystemExit("No Gobkit assets imported.")
    print(f"Catalog now contains {len(monsters)} models; {imported} Gobkit models validated/imported; {total_bytes} new bytes downloaded.")

if __name__ == "__main__":
    main()
