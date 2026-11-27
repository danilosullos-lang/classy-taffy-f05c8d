# Lineage II Interlude — systems analysis for our RPG

**Purpose:** use Interlude as a systems and presentation reference, not copy its
proprietary assets or code. This is an implementation blueprint. It is not a
claim that the original client has been fully reverse-engineered: that requires
a matching, legally obtained client installation and the relevant local input
files. The companion research-kit downloader is documented in
[tools/lineage2-reference/README.md](../tools/lineage2-reference/README.md).

## 1. Reference architecture

A useful MMO architecture separates four responsibilities:

1. **Client presentation:** camera, character controller, animation state
   machine, UI, effects, sound and local prediction.
2. **Authoritative world simulation:** positions, collision, aggro, combat
   outcomes, cooldowns, inventory, quest state and rewards.
3. **Content definitions:** races/classes, skills, items, NPCs, monsters,
   drops, zones, quests, spawn groups and level requirements.
4. **Persistence and services:** character saves, economy, parties, clans,
   PvP/PK records, instances, siege schedules and chat.

Our current browser game is primarily a client-side experience. The safest
path is to make content definitions data-driven now, then move competitive
and persistent outcomes behind a server-authoritative API before opening
multiplayer PvP or an economy to abuse.

## 2. Character creation and class progression

Interlude's class fantasy is built around distinct race/class identities,
then specialization through class advancement. For our own game, preserve
that feeling while keeping our own names, balance and art:

- **Warrior / tank:** sword, blunt weapon and shield; threat, defense,
  stun/interrupt and party protection.
- **Knight / paladin:** heavy armor, shield blocks, taunts, defensive auras
  and protection skills.
- **Rogue / dagger:** daggers, evasion, critical bursts, positional attacks
  and short control windows.
- **Archer:** bow, range management, kiting, accuracy and high single-target
  physical damage.
- **Mage:** staff, elemental spells, cast time, MP management, area damage
  and control.
- **Healer / support:** healing, resurrection-style recovery, cleanses,
  defensive buffs and party utility.
- **Summoner:** pet control, pet progression, commands and shared combat roles.

Suggested progression structure:
- character creation chooses race, appearance and a starter archetype;
- an early quest chain teaches movement, targeting, basic attacks, skills
  and equipment;
- an initial specialization unlocks at a low milestone;
- a second specialization unlocks later and changes the skill kit;
- class changes must preserve character identity and saved equipment.

Do not grant every class the same weapon or animation set. Weapon category,
class permissions, attack animation, hit timing and skill availability must
come from one validated class/weapon definition.

## 3. Combat loop

The Interlude-like feel depends on readable timing and clear target feedback,
not just damage numbers:

1. select/lock a target and validate range/line of sight;
2. approach using collision-aware pathing;
3. start an auto-attack cycle with weapon-specific timing;
4. resolve hit, evasion, critical and damage on the authoritative side;
5. play the correct attack/hit/death animation and impact effect;
6. manage skill reuse, cast bar, MP/HP costs and interruption;
7. update aggro, combat state, PvP flag and party threat.

Required safeguards:
- one combat state machine per actor; no idle/walk/attack animation races;
- cooldown timestamps rather than frame-count timers;
- server-side validation for damage, range, line of sight and inventory;
- damage numbers and effects are outputs of a resolved event, not the source
  of truth;
- NPCs and monsters use the same collision and navigation rules as the player.

## 4. Equipment and item economy

Use a coherent grade ladder inspired by the progression pattern, with original
item names and models:

- starter / common equipment;
- progressively stronger tiers with level and stat requirements;
- weapon classes: sword, dual sword, dagger, bow, blunt, polearm, staff and
  shield/off-hand;
- armor slots: head, chest, legs, gloves, boots, cloak and accessories;
- upgrade loop: crafting/materials, safe enhancement rules, socket/special
  bonuses and repair/salvage.

Every item definition should include a stable ID, slot, weapon/armor category,
minimum level, class restrictions, stats, rarity, icon/model references,
sell value, drop policy and provenance/license for its art. Never infer an
asset path from its display name.

## 5. Quests, NPCs and world progression

A strong quest loop combines:
- NPC-given contracts with clear level gates and prerequisites;
- kill, collect, deliver, explore, escort and dungeon objectives;
- named targets and boss encounters;
- multi-step quest chains with dialogue and explicit turn-in;
- rewards: XP, currency, items, reputation and access unlocks;
- repeatable daily/weekly tasks with server-side cooldowns.

Quest state should be explicit: locked → available → active → objective
progress → ready to turn in → completed. Each objective needs a stable ID,
target ID, required count and progress count. Rewards must be granted once,
atomically with completion. NPC dialogue should be driven by quest state,
not duplicated ad hoc in every NPC click handler.

World layout should use readable progression bands: safe starter village,
nearby hunting grounds, a road/field region, a dungeon entrance, a mid-level
town and a high-level frontier. Towns need functional NPC roles (gatekeeper,
merchant, blacksmith, warehouse, priest/healer, quest giver and trainer).
Use original architecture and place names.

## 6. Monster ecosystem

Create distinct families and combat roles rather than a large set of reskinned
duplicates:

- melee patrols and guards;
- ranged attackers;
- spellcasters and healers;
- fast ambushers;
- defensive elites;
- dungeon packs with coordinated aggro;
- named champions and raid bosses.

Each spawn definition needs level band, family, territory, respawn range,
aggro radius, leash radius, party scaling, drop table and animation profile.
A monster must not spawn inside a wall, on a roof, or outside its navigation
region. Bosses need telegraphed attacks, phases and reward ownership rules.

## 7. PvP, clans and castle warfare

Interlude-style PvP is more than a damage toggle. Build it as separate systems:

- duel / consensual PvP;
- open-world PvP state and anti-grief rules;
- PK/karma consequences and guard response;
- party and clan membership, invitations and permissions;
- clan progression, reputation and allied groups;
- castle ownership, siege registration, scheduled siege windows,
  attackers/defenders, gates, control objectives and reward settlement.

Do not implement siege as a free-for-all arena. The castle needs objective
zones, destructible/repairable gates, spawn rules, registration validation,
score events and a deterministic end-state. All competitive results and
ownership changes must be server-authoritative.

## 8. Collision, movement and navigation

This is a priority because the game previously allowed the player to pass
through walls. Treat rendered geometry and collision geometry as separate
but linked data:

- static world collision for buildings, walls, rocks and castle pieces;
- walkable ground and slope limits;
- capsule-based player movement with swept collision;
- vertical grounding and step-up/step-down limits;
- navmesh or waypoint navigation for NPCs and monsters;
- line-of-sight checks for ranged skills and aggro;
- spawn validation against collision and walkable surfaces.

The BSP Inspector is a narrow reference for one Unreal collision component;
it is not a ready-made Three.js physics engine. Keep runtime collision
implementation independent and test it against the castle and every imported
prop.

## 9. Interface and feedback

The recognizable MMO interaction pattern is a compact persistent HUD:
- HP/MP/XP bars and level;
- target frame with name, level and health;
- skill hotbar with cooldown overlays and key hints;
- inventory/equipment and character stats;
- quest tracker and journal;
- minimap with player, NPC, quest and party markers;
- party frames, chat, system messages and combat log;
- contextual NPC dialogue and shop/trade panels.

Mobile layout must reorganize the hotbar and panels for touch without hiding
combat visibility. UI actions need visible pending/success/error states.

## 10. Implementation order for our repository

Recommended order, based on risk and dependency:

| Priority | Workstream | Acceptance criteria |
|---|---|---|
| P0 | collision + navigation | player cannot cross walls; NPCs/monsters stay on walkable ground |
| P0 | character/weapon animation matrix | each class and weapon has correct idle, walk, run, attack, cast, hit and death states |
| P1 | data-driven classes and skills | class restrictions, costs, cooldowns and unlock levels validate from data |
| P1 | equipment/grade economy | every item has a valid model/icon and slot/stat requirements |
| P1 | quest chains | prerequisites, dialogue, objectives and one-time rewards persist correctly |
| P2 | monster families and bosses | distinct behavior, territory, respawn, aggro and loot |
| P2 | party/clan/social | invitations, permissions and shared quest/loot rules |
| P3 | PvP/PK | consent/flag rules, karma, guards and anti-exploit validation |
| P3 | castle siege | registration, teams, gates, objectives and server-owned result |

## 11. Research-tool limitations and evidence

The selected Elbera kits are source-only prereleases:
- Core 0.2.0 preview: bounded package/DAT/texture and script-prefix readers;
- BSP Inspector 0.1.0: a specific world BSP query/collision component;
- NPC Source 0.1.0: bounded NPC selector and animation-reference analysis.

They do not bundle the Lineage II client, maps, meshes, textures, animations,
server accounts or credentials. Original-data inspection requires the user's
own matching client files and must respect original content rights. The kits'
synthetic smoke tests are not proof that an entire Interlude client has been
reconstructed.

## 12. Upstream attribution

- Source/toolkits: [ELBERA / Lineage2Elbera](https://github.com/elberacasa/Lineage2Elbera)
- Core 0.2.0 preview, BSP Inspector 0.1.0 and NPC Source 0.1.0 are published
  as standalone GitHub release archives; exact URLs and SHA-256 pins are
  maintained in tools/lineage2-reference/download_tools.py.
- Upstream authored source is MIT; Lineage II assets remain separately owned
  by NCSoft. See upstream [license and boundary](https://github.com/elberacasa/Lineage2Elbera/blob/main/LICENSE).
