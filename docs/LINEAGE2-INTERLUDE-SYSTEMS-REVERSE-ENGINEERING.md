# Lineage II Interlude — deep systems and client-data research

**Reference target:** Chronicle 6 / Interlude (C6), not later Gracia or High Five features.
**Purpose:** build an original RPG with the depth, progression loops and readable MMO feedback of Interlude. These public source projects are behavioral and format references; our implementation remains original.

## Executive finding

Two complementary research layers provide a broad view of Interlude:

1. **Client-data inspection — L2PackTool 1.13.2.** Its source includes C6/Interlude table definitions, Unreal package readers, client reference auditing and CLI/GUI modules. It maps connections between table records and referenced assets.
2. **Server-behavior inspection — L2E and dr3dd/L2Interlude.** Their open code exposes systems, state transitions, persistence entities and packet flows. L2E's changelog documents 124 milestones, while marking some systems as stubs, partial or planned. dr3dd documents a separate C# server with PTS data loading, geodata, pathfinding, NPC movement and interaction.

This is much wider than a list of classes or a pack of 3D models: it covers what the player sees, the data that drives it, and the rules that make it work.

## Research sources inspected

| Source | Inspected material | Use |
|---|---|---|
| [L2PackTool 1.13.2](https://github.com/JEAN-ALMEIDA-CZO/L2PackTool/tree/v1.13.2) | README, release metadata, source tree, client audit, Chronicle detector, map package code, Interlude DDF definitions and C6 manifest | Client resource inventory and asset-reference audit |
| [L2E — Interlude Elixir server](https://github.com/ignaciochemes/L2ex) | README architecture, domain design rules, changelog through M124, source tree | Server systems, persistence, combat/AI, progression and multiplayer design |
| [dr3dd/L2Interlude](https://github.com/dr3dd/L2Interlude) | Project README and feature status | Geodata, pathfinding, PTS world data, NPC movement and interaction cross-check |
| [Interlude class tree](https://la2wiki.com/pt/interlude/classes) | 89 class paths and class-change levels | Class progression reference |
| [Interlude systems guide](https://la2wiki.com/pt/interlude/guides) | Class quests, subclass/noblesse, epic bosses, pets, clans, SA, augmentation, fishing, manor | Progression and endgame loop |
| [Interlude knowledge base](https://l2-servera.com/en/kategorii/wiki/) | Monster/NPC, item, skill, location, clan hall and castle catalog structure | Content taxonomy |

## 1. What the C6 client data describes

L2PackTool's Interlude manifest lists eight table definitions as proven by its author against a local Interlude client, and two as not proven. This is the upstream project's claim, not a new binary round-trip test performed in this repository.

### Eight table families listed as proven upstream

- **weapongrp:** weapon identity, drop model/texture, icons, hand use, weapon type, crystal grade, physical/magical attack, critical, hit/avoid modifiers, attack speed, soulshot/spiritshot consumption, sounds and visual effects.
- **armorgrp:** armor identity, icons, material, body slot, separate mesh/material references for race/gender body rigs, defense, MP bonus, armor category and crystal grade.
- **etcitemgrp:** consumable/material identity, drop mesh/texture, icons, stackability, item family and grade, sound and equip behavior.
- **itemname-e:** localized item names/descriptions paired with item identifiers.
- **skillgrp:** skill ID/level, operation type, MP/HP cost, cast range/style, hit time, magic flag, character animation, description, icon and enchant relationship.
- **skillname-e:** localized skill names/descriptions paired with skill identifiers.
- **npcgrp:** NPC class/model, texture sets, movement speed, animation/sound/effect references, raid-boss effect settings and quest/class flags.
- **npcname-e:** localized NPC names/titles paired with NPC identifiers.

### Two tables explicitly listed as not proven upstream

- systemmsg-e
- sysstring-e

Do not silently treat these layouts as validated. Keep the importer capable of marking fields/sources as unknown until a real sample is measured.

### Client package relationships

L2PackTool's client audit documents these package types and common client folders:

| Package | Typical folder | Content |
|---|---|---|
| .utx | systextures, textures | texture objects and material references |
| .usx | staticmeshes | static world/object meshes |
| .ukx | animations | skeletal meshes and animation packages |
| .uax | sounds, voice | sound packages |
| .unr | maps | Unreal world/map packages |
| .umx | music | music packages |
| .u | system | Unreal script/package objects |

The audit starts with reference tables such as npcgrp.dat, weapongrp.dat, armorgrp.dat, etcitemgrp.dat, itemgrp.dat, skillgrp.dat, pledgegrp.dat and doorgrp.dat, then compares Package.Object references with package exports. For encrypted mesh/animation packages, the tool explicitly distinguishes “package exists” from “contents were inspected”; this avoids false claims that every model has been validated.

**Implication for our game:** every character, NPC, monster, weapon, armor piece, skill icon, sound and world prop should have a machine-readable asset manifest with runtime path, file existence, texture/material dependencies, skeleton/animation profile and source/license. This is the class of missing-reference issue that produces white trees, invisible weapons, generic NPCs and idle-only characters.

## 2. Character identity and class progression

Interlude's class tree has 89 class nodes across five races, with advancement milestones at levels 20, 40 and 76.

### Race/archetype coverage to study

- **Human:** fighter and mystic paths, including tank, damage, archer, dagger, wizard, healer and summoner branches.
- **Elf:** fighter and mystic paths, including evasive/defensive melee, archery, support magic and elemental summoning.
- **Dark Elf:** fighter and mystic paths, including high-burst melee, dark magic, debuffs, support and dark summoning.
- **Orc:** fighter and mystic paths, including heavy melee, fist combat, warcry and party buffs.
- **Dwarf:** gathering, crafting and heavy support combat; crafting identity is part of the economy, not a cosmetic class difference.

### Class system requirements for our RPG

1. Race/body archetype and appearance selection.
2. Starter class with its own starter weapon, armor silhouette and animation profile.
3. Level-gated class advancement with quest chain, NPC dialogue and item objectives.
4. Class-specific skill tree, SP/currency costs, unlock levels and prerequisites.
5. Weapon/armor permissions enforced in UI and combat logic.
6. Class-change persistence and skill-set migration.
7. Optional subclass progression as a later endgame feature.

Start with a smaller, balanced roster (tank/knight, warrior, rogue, archer, mage, healer/support, summoner) and expand only when each class has a complete visual and mechanical identity.

## 3. Combat, skills and status effects

The reference server code exposes a full combat loop: target selection, auto-attack cadence, attack/miss/critical resolution, hit animation, damage, hate/aggro, death, XP/SP, ground drops and respawn.

### Skill categories

- Active physical attacks and weapon skills.
- Active magic attacks, cast-time spells and area-of-effect spells.
- Passive stat/weapon/armor mastery.
- Buffs and debuffs with expiry times.
- Crowd control: stun, root/hold, silence and slow.
- Damage-over-time and mana-drain effects.
- Toggle skills with recurring resource drain.
- Summon/pet skills.
- Skill enchantment as a later progression layer.

### Required combat rules

- Authoritative hit/damage calculation; animation presents the resolved action.
- Range and line-of-sight checks before melee/ranged/magic effects.
- Weapon-specific attack intervals, reach and animation selection.
- Cooldown timestamps and explicit cast completion/interruption.
- Resist checks for control effects and debuffs.
- Buff stacking/overwrite rules and death/zone cleanup.
- NPC hate list, target switching, leash radius and faction aggro.
- Party XP/SP distribution and kill-credit rules.

## 4. Equipment, itemization and economy

Interlude's item system connects client visuals to server templates. A weapon record can refer to multiple meshes, textures, icons, sounds, effects, hand usage, attack speed and shot consumption; armor records can have race/gender-specific body meshes.

### Equipment slots and progression

- Weapons: one-handed sword, dual sword, dagger, bow, blunt, polearm, fist weapon and staff.
- Off-hand: shield and other supported off-hand items.
- Armor: head, chest, legs, gloves, boots and accessory slots.
- Item grades and level/class restrictions.
- Set bonuses, weapon special abilities, soul crystals and augmentation.
- Enchant scrolls with success/failure rules and blessed variants.
- Soulshots/spiritshots and automatic consumption.
- Dyes/henna stat customization.
- Consumables, materials, recipes, keys, quest items and pet items.

### Economy loops

- NPC buy/sell lists and teleport services.
- Player-to-player trade with atomic confirmation/cancel.
- Private buy/sell stores.
- Personal and clan warehouses.
- Crafting recipes and ingredient validation.
- Drops, spoil, gathering and rare materials.
- Merchant tax and castle/manor-linked economy.
- Item destruction, crystallization, repair/salvage and enhancement sinks.

Every item in our game should have stable ID, display name, rarity, slot/category, required level/class, stats, model/icon references, drop/craft/sell policies and asset provenance.

## 5. NPCs, monsters, bosses and AI

The reference source tree separates NPC templates, live NPC instances, spawn tables, walking/patrol data and raid-boss managers. Its documented AI states include idle, walking, chasing, attacking and returning.

### Behavior families

- Town NPCs: class trainers, quest givers, gatekeepers, merchants, blacksmiths, warehouse keepers, healers and special service NPCs.
- Passive creatures and ambient citizens.
- Melee attackers, ranged attackers and spellcasters.
- Healers/support mobs, guards and faction-linked packs.
- Elites, named champions, dungeon bosses and world/raid bosses.
- Pets and summoned companions.

### NPC/monster definition fields

- Template ID, family/faction, level, HP/MP, attack/defense, resistances and XP/SP.
- Model, texture/material, skeleton, animation profile, sounds and effects.
- Spawn region/coordinates, heading, respawn interval and day/night condition.
- Aggro radius, hate values, leash radius, patrol waypoints and movement speed.
- Skills, loot/drop/spoil tables, quest flags and boss/instance tags.

A single model must not be reused indiscriminately for different NPC roles. Variants need different silhouettes, equipment, textures, animations, names and behavior profiles.

## 6. Quests and progression loops

The reference systems expose quest state, quest items, NPC quest flags, kill/talk dispatch, completion and reward delivery. The Interlude quest guide groups content into class-transfer, subclass/noblesse, epic-boss, pet, clan and hundreds of other tasks.

### Objective types

- Talk to NPC / choose dialogue response.
- Kill a named target or collect a kill count.
- Gather item drops or deliver a package.
- Explore/visit a region or interact with an object.
- Escort/follow an NPC.
- Clear a dungeon or defeat a boss.
- Craft, refine, fish or trade an item.
- Complete a multi-stage class, clan or pet quest.

### Quest engine requirements

- locked → available → active → objectives → ready_to_turn_in → completed.
- Explicit prerequisites and level/class/race checks.
- Branching dialogue and quest-specific NPC state.
- Stable objective IDs and per-objective progress.
- Quest items with inventory ownership rules.
- Atomic one-time rewards and persisted completion.
- Repeatable/daily/weekly tasks with server cooldowns.
- Chains that unlock trainers, regions, dungeons, classes and endgame systems.

Our existing seven NPC contracts are a useful starter layer; the next meaningful upgrade is chained quest progression, item hand-ins, branch dialogues and reward equipment.

## 7. World, collision, navigation and zones

This is a top priority because the game has previously had player wall-clipping. The Interlude reference projects expose a dedicated geodata/GeoEngine layer, height lookup, NSWE cell passability, line of sight and A* pathfinding.

### World simulation requirements

- Static collision for buildings, castle walls, rocks, trees and props.
- Walkable surfaces, height/ground sampling, slope and step limits.
- Swept capsule collision for player movement.
- Navigation mesh or grid pathfinding for NPCs/monsters.
- Line-of-sight for aggro and ranged attacks.
- Spawn validation and NPC leash/path-return behavior.
- Region/area-of-interest updates so clients only receive nearby entity changes.
- Zone types: peace, PvP, siege, damage, water, swamp and boss/instance zones.
- Doors/gates with state, HP, collision and interaction state.

The BSP Inspector kit is useful for studying one Unreal collision representation, but it is not a drop-in Three.js physics engine. Our collision runtime must be implemented and tested against our actual GLB world.

## 8. Social, PvP and endgame

### Social layer

- Parties: invite, accept, leave, kick, loot rules, shared XP and party HP/MP frames.
- Friends and private messages.
- Clans: membership/ranks, skills, reputation, crests and clan warehouse.
- Alliances and clan wars.
- Community board, chat channels, macros and shortcuts.
- Private stores and trade.

### PvP layer

- Duel and party duel with countdown, boundaries and result settlement.
- Open-world PvP flag state.
- PK/karma, guard response and item-drop consequences.
- Olympiad: registration, match queue, isolated arena, points, cycle and hero election.
- Anti-exploit checks for range, cooldown, teleport, inventory and reward ownership.

### Castle warfare and territory economy

- Nine-castle reference model.
- Siege registration, attacker/defender rosters and scheduled phases.
- Gates/doors with HP, destruction and repair.
- Relic/control-point capture and siege score.
- Castle ownership transfer and clan permissions.
- Manor state cycle, seed sales, crop procurement and castle tax.
- Clan halls with ownership/rent, auctions and timed functions.

### Other signature Interlude systems

- Seven Signs: Dawn/Dusk cabals, competition/validation periods, seals and Festival of Darkness.
- Cursed weapons: Zariche/Akamanah possession, kills, decay and world broadcast.
- Grand/epic bosses: spawn windows, instance locks and reward rules.
- Pets: summon, follow, hunger, feed, inventory, equipment and progression.
- Fishing: rod/bait requirements, bite/reel flow and caught items.
- Henna/dyes, recipes, augmentation, soul crystals and skill enchant.

These systems should be staged after core world, class, combat and quest foundations are stable.

## 9. UI and player feedback

The system inventory implies a persistent MMO interface with:
- Character portrait, level, HP/MP/XP and status effects.
- Target frame with level, HP and target identity.
- Hotbar, cooldown state, skill tooltips and quick consumables.
- Inventory, paperdoll/equipment, stats, skill tree and quest journal.
- Minimap/world map with NPC, quest, party and location markers.
- Party/clan/social panels, chat and combat/system log.
- NPC dialogue, shop, warehouse, craft, trade and private-store panels.
- PvP flag, duel, Olympiad and siege status.
- Mobile touch layout with accessible controls and no hidden combat view.

## 10. Reference architecture distilled for our browser RPG

The L2E codebase describes a server split into login/network, player session, world regions/AOI, NPC instances, combat, inventory, quests, party/clan, instances, siege and endgame managers. Its README presents this as an ongoing implementation, and its changelog marks several pieces as stubs or planned. Treat it as a source of domain boundaries and state transitions, not proof that every feature is production-complete.

For our project:
1. Keep current Three.js/browser rendering and asset loader.
2. Move class/item/NPC/skill/quest definitions into versioned JSON data.
3. Add deterministic client-side systems for offline testing.
4. Move combat, rewards, inventory, PvP, clan and siege authority to a backend before public multiplayer.
5. Use a spatial grid/AOI for entity replication when multiplayer is introduced.
6. Add regression fixtures for each mechanic and a browser smoke test after every integration.

## 11. Implementation backlog for our current game

| Priority | Work | Definition of done |
|---|---|---|
| P0 | Collision and navigation | no player wall clipping; ground/height stable; NPCs path around walls |
| P0 | Class/weapon/animation matrix | each playable class has correct rig, idle/walk/run/attack/cast/hit/death and weapon pairing |
| P0 | Asset reference audit | every tree, monster, NPC, weapon, armor and effect has valid model/material/texture references |
| P1 | Data-driven classes and skills | class restrictions, unlock levels, costs, cooldowns and effects validate |
| P1 | Equipment and item grades | complete paperdoll, icons, stats, set bonuses and weapon categories |
| P1 | Quest chains | prerequisite graph, dialogue branches, kill/collect/deliver/explore, hand-ins and unique rewards |
| P2 | NPC/monster behavior | aggro, hate, patrol, leash, faction response, respawn and drops |
| P2 | Dungeons and bosses | boss phases, telegraphs, instance entry and reward ownership |
| P2 | Party and trade | party XP, party UI, secure trade, warehouse and private stores |
| P3 | PvP/PK/duels | consent/flag rules, karma, guard response and authoritative damage |
| P3 | Clans and alliances | membership, ranks, clan skills, wars, crests and shared storage |
| P3 | Castle siege/manor | registration, gates, control objective, ownership, tax and crops |
| P4 | Olympiad/Seven Signs | cycles, matchmaking, arena, hero status and cabal scoring |
| P4 | Pets/fishing/augmentation | complete side progression loops |

## 12. Tool acquisition and reproducibility

### L2PackTool

- Repository: https://github.com/JEAN-ALMEIDA-CZO/L2PackTool
- Pinned version: v1.13.2
- Pinned source commit: 46ef515c3bb0dca90ac1854b260cef851f38b02c
- License: MIT for the tool's own source.
- Windows installer: https://github.com/JEAN-ALMEIDA-CZO/L2PackTool/releases/download/v1.13.2/L2PackTool-Setup-1.13.2.exe
- Source artifact is produced by .github/workflows/lineage2-client-research.yml.
- The release installer is Windows-only and approximately 338 MB; the source tree is the smaller research artifact.
- UModel is a separately obtained external viewer dependency documented by L2PackTool; it is not bundled in this game repository.

### Existing Elbera research kits

The previous integration already pins and verifies three source-only archives:
- Core: bounded .dat/Unreal package/texture readers and table helpers.
- BSP Inspector: BSP collision/query implementation and fixtures.
- NPC Source: NPC appearance and animation-source extraction helpers.

These remain separate from L2PackTool. They complement rather than replace it.

## 13. Current evidence boundary

This investigation inspected public source code, manifests, table schemas, changelogs and documentation. It did not parse a local Interlude installation in this repository because no original client folder is present here. Therefore no exact NPC/monster/item counts, map list, drop percentages or per-skill numerical values are claimed as newly extracted from a client. Those values can be imported into our own content definitions once a client dataset is available.

The upstream L2PackTool manifest says its eight C6 table definitions were proven against an Interlude client; systemmsg-e and sysstring-e are explicitly unproven. L2E's changelog is a project progress record, not certification that all server features are complete.

## 14. Upstream projects

- L2PackTool (MIT): https://github.com/JEAN-ALMEIDA-CZO/L2PackTool
- L2E (Apache-2.0): https://github.com/ignaciochemes/L2ex
- dr3dd/L2Interlude: https://github.com/dr3dd/L2Interlude
- ELBERA research tools: https://github.com/elberacasa/Lineage2Elbera
