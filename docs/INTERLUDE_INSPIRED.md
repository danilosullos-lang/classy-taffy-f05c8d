# Lineage II Interlude-inspired direction

This project is an original RPG that takes design inspiration from the Interlude era of Lineage II. It does not redistribute NCSoft client files, proprietary models, maps, music, quest text, server code, or extracted databases.

## Implemented foundation

- Five selectable races at character creation: Human, Elf, Dark Elf, Orc, and Dwarf, each with its own village sign/palette and race-shaped character appearance.
- The character creator now follows the actual Interlude base classes: Fighter/Mystic for Humans, Elves, Dark Elves and Orcs; Dwarven Fighter for Dwarves.
- Race starting attributes are added to the character's base stats and saved.
- Profession transfers are playable at levels 20, 40 and 76, following race-locked first-, second- and third-profession branches.
- Class-oriented hotbar labels and role-specific combat skills: fighter, tank, archer, dagger, mage, healer, support, and crafter. The skill set changes when the profession path changes.
- Free-roam ground replaces the old central water lane. The player can travel in both directions and terrain biomes are selected from world position.
- World chunk generation now supports negative coordinates, allowing the world to load while moving backwards.
- Medieval town hubs are generated in selected world regions, with a town square, modular houses, gate towers, well, market stall, and four service NPCs. The free Quaternius Medieval Village MegaKit standard pack is mirrored in the repository: 176 modular glTF models plus their binary buffers and textures, under CC0.
- NPC services: gatekeeper travel between regions (Adena fee), merchant consumables, blacksmith equipment/forging access, priest healing/blessing, and a questmaster with sequential hunting, dungeon and raid quests.
- Existing dungeons, monster packs, audio, PBR terrain, loot, and local save data remain in place.

## Data catalog

`data/interlude-inspired-world.json` defines the reference design data for:
- five races and their attributes;
- 31 second-profession paths and their third-profession advances;
- weapon/armor grades;
- hunting regions, dungeons, and raid-boss encounter groups;
- an original starter skill catalog;
- quest arcs and core MMORPG system targets.

The race/class transfer tree, starter skills, town services, and three starter quest arcs are wired into the playable runtime. The wider catalog remains a design/configuration resource; it is not a claim that every listed system is already implemented.

## Still required before calling this a full MMORPG

The current project is still a browser-based single-player-first RPG with peer-to-peer presence/duels, not a persistent authoritative MMO server. A full Interlude-scale experience still needs:
- a server-authoritative world simulation, accounts, characters, inventory, combat, persistence, and anti-cheat;
- party, clan, clan skills, castle siege, Olympiad, karma/PK, and persistent raid scheduling;
- complete race-specific character meshes, armor sets, weapons, shields, capes, and animation retargeting;
- a true world map with connected towns, roads, landmarks, dungeon interiors, collision/navigation meshes, and streaming;
- complete class advancement quests, subclass/Noblesse quest chains, skill trainers, drop/spoil tables, recipes, and balanced item economy;
- multiplayer stress tests with multiple real clients and server-side persistence.

## Asset policy

Use original procedural content and assets with verified CC0 or other compatible licenses. Candidate sources include Quaternius Universal Base Characters, Universal Animation Library, Modular Character Outfits - Fantasy, and Fantasy Props MegaKit. The Medieval Village MegaKit standard glTF pack is already imported and catalogued in `assets/world/village-megakit/`. Keep source URLs and license notes in the asset manifest whenever importing new files.