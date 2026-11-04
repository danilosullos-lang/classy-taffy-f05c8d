#!/usr/bin/env python3
"""Import and verify the complete PNG collection from Kenney's CC0 Particle Pack."""
from __future__ import annotations
import hashlib, json, pathlib, time, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
DEST=ROOT/"assets"/"effects"/"kenney-particle-pack"
API="https://api.github.com/repos/Calinou/kenney-particle-pack/git/trees/master?recursive=1"
BASE="https://raw.githubusercontent.com/Calinou/kenney-particle-pack/master/"
LICENSE_PATH="addons/kenney_particle_pack/LICENSE.txt"
ROLE_PREFIXES=("fire","flame","magic","spark","slash","smoke","light","circle","trace","dirt","flare","muzzle","scorch","scratch","star","symbol","twirl","window")

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Aetheria-RPG-CC0-VFX-Importer/1.1","Accept":"application/json, application/octet-stream"})
    with urllib.request.urlopen(req,timeout=90) as response:
        return response.read()

def valid_png(data):
    return len(data)>1024 and data[:8]==b"\x89PNG\r\n\x1a\n"

def main():
    DEST.mkdir(parents=True,exist_ok=True)
    # Prefer the already checked-in, verified CC0 collection. This keeps CI
    # deterministic and avoids GitHub API rate limits on every push.
    local_paths=sorted(p for p in DEST.rglob("*.png") if valid_png(p.read_bytes()))
    if len(local_paths)>=80:
        paths=[p.relative_to(DEST).as_posix() for p in local_paths]
        source_paths=None
    else:
        tree=json.loads(fetch(API).decode("utf-8"))
        prefix="addons/kenney_particle_pack/"
        source_paths=sorted(x["path"] for x in tree.get("tree",[]) if x.get("type")=="blob" and x.get("path","").startswith(prefix) and x["path"].lower().endswith(".png"))
        if len(source_paths)<80:
            raise RuntimeError(f"Expected at least 80 CC0 particle PNGs, found {len(source_paths)}")
        paths=[source_path[len(prefix):] for source_path in source_paths]
    records=[]
    for relative in paths:
        path=DEST/relative
        data=path.read_bytes() if path.exists() else b""
        if not valid_png(data):
            if source_paths is None:
                raise RuntimeError(f"Checked-in Kenney PNG became invalid: {relative}")
            source_path=source_paths[paths.index(relative)]
            data=fetch(BASE+source_path)
            if not valid_png(data):
                raise RuntimeError(f"Invalid PNG from Kenney pack: {source_path}")
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_bytes(data)
        stem=pathlib.PurePosixPath(relative).name.split("_")[0]
        role=stem if stem in ROLE_PREFIXES else "particle"
        records.append({"file":path.relative_to(ROOT).as_posix(),"role":role,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
    license_path=DEST/"LICENSE.txt"
    if not license_path.exists() or license_path.stat().st_size<200:
        license_data=fetch(BASE+LICENSE_PATH)
        if b"CC0" not in license_data and b"Creative Commons Zero" not in license_data:
            raise RuntimeError("Kenney particle pack license text did not confirm CC0")
        license_path.write_bytes(license_data)
    manifest={
      "name":"Kenney Particle Pack",
      "creator":"Kenney",
      "source":"https://kenney.nl/assets/particle-pack",
      "repositoryMirror":"https://github.com/Calinou/kenney-particle-pack",
      "license":"CC0-1.0",
      "licenseUrl":"https://creativecommons.org/publicdomain/zero/1.0/",
      "importedAt":time.strftime("%Y-%m-%d",time.gmtime()),
      "count":len(records),
      "originalSprites":80,
      "rotatedVariants":len([x for x in records if "/rotated/" in x["file"]]),
      "assets":records
    }
    (DEST/"manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(f"Imported/verified complete Kenney CC0 particle collection: {len(records)} PNGs.")

if __name__=="__main__": main()
