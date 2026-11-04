#!/usr/bin/env python3
"""Import a small, verified subset of Kenney's CC0 Particle Pack."""
from __future__ import annotations
import hashlib, json, pathlib, time, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
DEST=ROOT/"assets"/"effects"/"kenney-particle-pack"
BASE="https://raw.githubusercontent.com/Calinou/kenney-particle-pack/master/addons/kenney_particle_pack"
FILES={
  "flame_04.png":"fire",
  "fire_01.png":"fireball",
  "magic_04.png":"magic",
  "spark_07.png":"spark",
  "slash_02.png":"slash",
  "smoke_03.png":"smoke",
  "light_03.png":"holy",
  "circle_03.png":"impact",
  "trace_06.png":"trail",
}
LICENSE_URL="https://raw.githubusercontent.com/Calinou/kenney-particle-pack/master/addons/kenney_particle_pack/LICENSE.txt"

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Aetheria-RPG-CC0-VFX-Importer/1.0"})
    with urllib.request.urlopen(req,timeout=90) as response:
        return response.read()

def valid_png(data):
    return len(data)>1024 and data[:8]==b"\x89PNG\r\n\x1a\n"

def main():
    DEST.mkdir(parents=True,exist_ok=True)
    records=[]
    for filename,role in FILES.items():
        path=DEST/filename
        data=path.read_bytes() if path.exists() else b""
        if not valid_png(data):
            data=fetch(f"{BASE}/{filename}")
            if not valid_png(data):
                raise RuntimeError(f"Invalid PNG from Kenney pack: {filename}")
            path.write_bytes(data)
        records.append({"file":path.relative_to(ROOT).as_posix(),"role":role,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
    license_path=DEST/"LICENSE.txt"
    if not license_path.exists() or license_path.stat().st_size<200:
        license_data=fetch(LICENSE_URL)
        if b"CC0" not in license_data and b"Creative Commons Zero" not in license_data:
            raise RuntimeError("Kenney particle pack license text did not confirm CC0")
        license_path.write_bytes(license_data)
    manifest={
      "name":"Kenney Particle Pack — selected VFX sprites",
      "creator":"Kenney",
      "source":"https://kenney.nl/assets/particle-pack",
      "repositoryMirror":"https://github.com/Calinou/kenney-particle-pack",
      "license":"CC0-1.0",
      "licenseUrl":"https://creativecommons.org/publicdomain/zero/1.0/",
      "importedAt":time.strftime("%Y-%m-%d",time.gmtime()),
      "count":len(records),
      "assets":records
    }
    (DEST/"manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(f"Imported/verified {len(records)} Kenney CC0 particle sprites.")

if __name__=="__main__": main()
