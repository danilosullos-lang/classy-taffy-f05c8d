#!/usr/bin/env python3
"""Generate unique per-model CC0 audio profiles from imported catalogs."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MC=ROOT/"assets/monsters/catalog.json"; AC=ROOT/"assets/audio/catalog.json"; OUT=ROOT/"assets/monsters/audio-map.json"
RULES={"slime":{"attack":["creature_slime_","burble_"],"aggro":["creature_slime_","burble_"],"hurt":["creature_hurt_","hurt_"],"death":["creature_die_","spit_"],"idle":["burble_","creature_misc_"]},"insect":{"attack":["bug_","creature_monster_"],"aggro":["bug_","creature_roar_"],"hurt":["hurt_","creature_hurt_"],"death":["creature_die_","scream_"],"idle":["bug_","creature_misc_"]},"aquatic":{"attack":["burble_","spit_","creature_monster_"],"aggro":["burble_","creature_roar_"],"hurt":["hurt_","creature_hurt_"],"death":["creature_die_","spit_"],"idle":["burble_","breath"]},"undead":{"attack":["monster_","creature_monster_"],"aggro":["scream_","roar_"],"hurt":["hurt_","creature_hurt_"],"death":["scream_","creature_die_"],"idle":["snore","breath","misc_"]},"mythic":{"attack":["creature_monster_","monster_","troll_"],"aggro":["creature_roar_","roar_","howl"],"hurt":["creature_hurt_","hurt_"],"death":["creature_die_","roar_","scream_"],"idle":["breath","roar_","creature_misc_"]},"humanoid":{"attack":["troll_","grunt_","creature_monster_"],"aggro":["troll_","grunt_","roar_"],"hurt":["grunt_","hurt_","creature_hurt_"],"death":["creature_die_","scream_","grunt_"],"idle":["breath","grunt_","creature_misc_"]},"flying":{"attack":["bug_","creature_monster_","spit_"],"aggro":["creature_roar_","roar_","howl"],"hurt":["hurt_","creature_hurt_"],"death":["scream_","creature_die_"],"idle":["breath","bug_","creature_misc_"]},"beast":{"attack":["monster_","grunt_","creature_monster_"],"aggro":["roar_","howl","barking_"],"hurt":["hurt_","creature_hurt_"],"death":["creature_die_","scream_"],"idle":["breath","barking_","creature_misc_"]}}
PATTERNS={"slime":r"slime|jelly|ooze|blob|mushroom","insect":r"insect|bug|bee|beetle|spider|scorpion|ant|wasp","aquatic":r"fish|shark|whale|crab|octopus|jellyfish|aquatic|sea|squid","undead":r"skeleton|zombie|ghost|undead|lich|vampire|wraith|skull","mythic":r"dragon|demon|devil|hydra|golem|cyclops|boss|titan","humanoid":r"orc|troll|goblin|ogre|giant|human|knight|warrior|bandit","flying":r"bird|eagle|crow|raven|bat|owl|phoenix"}
def family(n):
 for k,p in PATTERNS.items():
  if re.search(p,n,re.I): return k
 return "beast"
def choose(files,prefixes,key):
 found=sorted(f for f in files if any(Path(f).name.lower().startswith(p) for p in prefixes))
 if not found: found=sorted(f for f in files if any(p in Path(f).name.lower() for p in prefixes))
 if found:
  seed=sum(ord(c) for c in key); offset=seed%len(found); found=found[offset:]+found[:offset]
 return ["/"+f for f in found[:4]]
def main():
 monsters=json.loads(MC.read_text())["monsters"]; audio=json.loads(AC.read_text())
 files=[a["file"] for a in audio.get("assets",[]) if Path(a.get("file","")).suffix.lower() in {".ogg",".mp3",".wav",".m4a",".flac"}]
 result={"version":1,"license":"CC0-1.0","sourceCatalog":"/assets/monsters/catalog.json","audioCatalog":"/assets/audio/catalog.json","description":"One stable profile per model path (including repeated display names); family-aware sound variants are rotated per model.","monsters":{}}
 for m in monsters:
  key="/"+m["path"].lstrip("/"); fam=family(m["name"]); profile={"name":m["name"],"family":fam}
  for event,prefixes in RULES[fam].items():
   profile[event]=choose(files,prefixes,key)
   if not profile[event]: raise SystemExit(f"No sound candidates for {key} / {event}")
  result["monsters"][key.lower()]=profile
 for key,p in result["monsters"].items():
  for event in ("attack","aggro","hurt","death","idle"):
   for uri in p[event]:
    if not (ROOT/uri.lstrip("/")).is_file(): raise SystemExit(f"Missing sound: {key} {event} {uri}")
 OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
 print(f"OK: {len(result['monsters'])} unique monster model profiles / {len(files)} audio files")
if __name__=="__main__": main()
