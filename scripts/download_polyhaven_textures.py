#!/usr/bin/env python3
"""Download curated and discovered CC0 PBR materials from Poly Haven.

This importer also triggers the repository-wide validated CC0 asset refresh.
"""
from __future__ import annotations
import hashlib, json, time
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/textures/polyhaven"
API = "https://api.polyhaven.com"
UA = "SuperHeroRPG-CC0-TexturePipeline/2.0 (Powered by Poly Haven)"
CHANNELS = ["diffuse", "normal", "roughness"]
ASSETS = {
    "forrest_ground_01": CHANNELS, "grass_ground": CHANNELS,
    "brown_mud_leaves_01": CHANNELS, "dense_sand": CHANNELS,
    "rocky_terrain_02": CHANNELS, "snow_02": CHANNELS,
    "concrete_floor_01": CHANNELS, "rock_face_03": CHANNELS,
    "cobblestone_floor_04": CHANNELS, "rough_wood": CHANNELS,
    "bark_brown_02": CHANNELS, "metal_plate": CHANNELS + ["metalness"],
    "plastered_wall_05": CHANNELS, "red_bricks_04": CHANNELS,
    "leaves_forest_ground": CHANNELS, "forest_leaves_03": CHANNELS,
    "leafy_grass": CHANNELS, "fabric_pattern_05": CHANNELS,
    "fabric_leather_02": CHANNELS, "leather_red_02": CHANNELS,
    "white_bricks": CHANNELS, "clay_roof_tiles_03": CHANNELS,
}
ROLE_QUERIES = {
    "wood": ["weathered wood", "wood planks"], "bark": ["tree bark"],
    "stone": ["stone wall", "rock surface"], "brick": ["brick wall"],
    "plaster": ["plaster wall"], "roof": ["roof tiles", "clay roof"],
    "metal": ["rusty metal", "metal plate"], "concrete": ["concrete wall", "cement floor"],
    "fabric": ["woven fabric", "cloth material"], "leather": ["leather material"],
    "foliage": ["forest leaves", "leaf litter", "leafy ground"],
    "tile": ["ceramic tiles", "stone tiles"], "sand": ["sand ground"],
    "dirt": ["mud soil", "dirt ground"], "grass": ["grass ground"],
    "snow": ["snow surface"], "asphalt": ["asphalt road"],
    "moss": ["mossy stone", "moss ground"],
    "marble": ["marble surface", "polished marble"],
    "slate": ["slate stone", "slate roof"],
    "ice": ["ice surface", "glacier ice"],
    "lava": ["volcanic rock", "cooled lava"],
    "armor": ["metal armor", "brushed steel"],
    "cloth": ["woven cloth", "medieval fabric"],
    "darkwood": ["dark weathered wood", "aged timber"],
}
FALLBACK_ROLES = {
    "wood": "rough_wood", "bark": "bark_brown_02", "stone": "rock_face_03",
    "brick": "red_bricks_04", "plaster": "plastered_wall_05",
    "roof": "clay_roof_tiles_03", "metal": "metal_plate",
    "concrete": "concrete_floor_01", "fabric": "fabric_pattern_05",
    "leather": "fabric_leather_02", "foliage": "leaves_forest_ground", "tile": "cobblestone_floor_04",
    "sand": "dense_sand", "dirt": "brown_mud_leaves_01",
    "grass": "grass_ground", "snow": "snow_02",
    "asphalt": "concrete_floor_01", "moss": "forest_leaves_03",
    "marble": "stone_wall_05", "slate": "stone_wall",
    "ice": "snow_01", "lava": "rock_face_03",
    "armor": "metal_plate", "cloth": "poly_wool_herringbone",
    "darkwood": "weathered_planks",
}
ALIASES = {
    "diffuse": ("Diffuse", "Color", "Albedo", "Base Color"),
    "normal": ("nor_gl", "Normal", "nor_dx"),
    "roughness": ("Rough", "Roughness"),
    "metalness": ("Metal", "Metalness"),
}

def get_json(url: str):
    last = None
    for attempt in range(4):
        try:
            req = Request(url, headers={"User-Agent": UA})
            with urlopen(req, timeout=50) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            last = exc
            if exc.code not in (429, 500, 502, 503, 504):
                raise
            time.sleep(min(20, 2 ** (attempt + 1)))
        except (URLError, TimeoutError, OSError) as exc:
            last = exc
            time.sleep(min(12, 2 ** attempt))
    raise RuntimeError(f"API request failed after retries: {url}: {last}")

def download(url: str, dest: Path, expected_md5: str | None):
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=120) as response:
        data = response.read()
    if not data:
        raise RuntimeError("empty download")
    if expected_md5 and hashlib.md5(data).hexdigest().lower() != expected_md5.lower():
        raise RuntimeError("MD5 mismatch")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return len(data)

def pick_file(files: dict, channel: str):
    for key in ALIASES[channel]:
        variants = files.get(key)
        if not isinstance(variants, dict):
            continue
        one_k = variants.get("1k") or variants.get("2k") or {}
        # The runtime validator and Three.js loader use stable JPEG/PNG channel conventions.
        formats = ("jpg",) if channel in ("diffuse", "roughness") else ("png",)
        for fmt in formats:
            item = one_k.get(fmt)
            if isinstance(item, dict) and item.get("url"):
                return item
    return None

def discover_assets(metadata: dict):
    chosen, roles = {}, dict(FALLBACK_ROLES)
    for role, queries in ROLE_QUERIES.items():
        found = []
        for query in queries:
            try:
                url = f"{API}/search?q={quote(query.lower())}&t=textures&limit=12&min=0.22"
                payload = get_json(url)
                for result in payload.get("results", []):
                    slug = result.get("slug")
                    if slug and slug in metadata and metadata[slug].get("type") == 1 and slug not in found:
                        found.append(slug)
                    if len(found) >= 2:
                        break
            except Exception as exc:
                print(f"::warning::Poly Haven search '{query}' failed: {exc}")
            if found:
                break
        if found:
            roles[role] = found[0]
            for slug in found:
                chosen.setdefault(slug, {"roles": []})
                if role not in chosen[slug]["roles"]:
                    chosen[slug]["roles"].append(role)
    return chosen, roles

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "source": "Poly Haven", "sourceUrl": "https://polyhaven.com/",
        "credit": "Powered by Poly Haven", "license": "CC0 1.0 Universal",
        "licenseUrl": "https://polyhaven.com/license",
        "apiTerms": "https://github.com/Poly-Haven/Public-API/blob/master/ToS.md",
        "downloadedAt": time.strftime("%Y-%m-%d", time.gmtime()),
        "resolution": "1K preferred (2K fallback)",
        "roles": dict(FALLBACK_ROLES), "assets": [],
    }
    metadata, dynamic = {}, {}
    try:
        metadata = get_json(f"{API}/assets?type=textures")
        if not isinstance(metadata, dict):
            raise RuntimeError("unexpected /assets response")
        dynamic, manifest["roles"] = discover_assets(metadata)
    except Exception as exc:
        print(f"::warning::Dynamic material discovery unavailable; using core pack: {exc}")

    plan = dict(ASSETS)
    for slug in dynamic:
        plan.setdefault(slug, CHANNELS)
    successes = 0
    for asset_id, channels in plan.items():
        try:
            files = get_json(f"{API}/files/{asset_id}")
        except Exception as exc:
            print(f"::warning::Could not query {asset_id}: {exc}")
            continue
        meta = metadata.get(asset_id, {}) if isinstance(metadata, dict) else {}
        record = {
            "id": asset_id, "name": meta.get("name", asset_id.replace("_", " ").title()),
            "category": meta.get("category", ""), "tags": meta.get("tags", []),
            "url": f"https://polyhaven.com/a/{asset_id}", "license": "CC0 1.0",
            "roles": dynamic.get(asset_id, {}).get("roles", []), "maps": {},
        }
        for channel in channels:
            item = pick_file(files, channel)
            if not item:
                continue
            ext = item["url"].split("?", 1)[0].rsplit(".", 1)[-1].lower()
            if ext not in ("jpg", "jpeg", "png", "webp"):
                continue
            dest = OUT / asset_id / f"{channel}.{ext}"
            try:
                size = download(item["url"], dest, item.get("md5"))
                record["maps"][channel] = {
                    "path": dest.relative_to(ROOT).as_posix(), "ext": ext,
                    "bytes": size, "md5": item.get("md5"),
                    "resolution": "1k" if "/1k/" in item["url"].lower() else "2k",
                }
                successes += 1
                print(f"Downloaded {asset_id}/{channel}: {size} bytes")
            except Exception as exc:
                print(f"::warning::Failed {asset_id}/{channel}: {exc}")
        if all(ch in record["maps"] for ch in CHANNELS):
            manifest["assets"].append(record)
        else:
            print(f"::warning::Incomplete PBR set for {asset_id}; skipping material")
    complete = {a["id"] for a in manifest["assets"] if all(ch in a["maps"] for ch in CHANNELS)}
    for role, slug in list(manifest["roles"].items()):
        if slug not in complete:
            manifest["roles"][role] = FALLBACK_ROLES[role]
    manifest["extensions"] = {
        a["id"]: {ch: info["ext"] for ch, info in a["maps"].items()}
        for a in manifest["assets"]
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if successes < 3:
        raise SystemExit(f"Only {successes} texture maps downloaded; refusing to publish an incomplete pack.")
    print(f"Downloaded {successes} CC0 texture maps across {len(manifest['assets'])} materials.")
    print(f"Dynamic material roles: {json.dumps(manifest['roles'], ensure_ascii=False)}")

if __name__ == "__main__":
    main()
