#!/usr/bin/env python3
"""Check every monster model path has five valid audio event pools."""
import json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
m=json.loads((R/"assets/monsters/catalog.json").read_text())["monsters"]
a=json.loads((R/"assets/audio/catalog.json").read_text())["assets"]
p=json.loads((R/"assets/monsters/audio-map.json").read_text())["monsters"]
keys={"/"+x["path"].lstrip("/").lower() for x in m}
assert keys==set(p),f"model path/profile mismatch: {len(keys)} catalog models vs {len(p)} profiles"
files={"/"+x["file"] for x in a}
for key,profile in p.items():
 for event in ("attack","aggro","hurt","death","idle"):
  assert profile[event],(key,event,"empty")
  for uri in profile[event]:
   assert uri in files,(key,event,uri,"not in audio catalog")
   assert (R/uri.lstrip("/")).is_file(),(key,event,uri,"missing file")
print(f"OK: {len(keys)} distinct model paths have five valid CC0 audio profiles.")
