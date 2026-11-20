# Monster progression

Aetheria uses area-based monster levels, independent of the player's level. The progression is capped at level 80 and follows the five open-world biomes:

| Biome | Monster level band |
|---|---:|
| Campos de Valdora | 1–12 |
| Floresta Sombria | 12–28 |
| Tundra Gelada | 28–44 |
| Deserto Escaldante | 44–62 |
| Terras Vulcânicas | 62–80 |

The monster's base threat (HP and damage), area depth and rank adjust its level. Elite monsters receive a level bonus and stronger stats. Monster HP, damage and EXP scale from the monster's level, never from the player's level.

EXP uses a level-gap reduction inspired by Lineage 2-style hunting progression: no reduction for gaps up to 5 levels, then 70%, 40% and 10% at larger gaps. These are Aetheria balance values, not copied Lineage 2 server formulas.

Implementation: `assets/monsters/progression.js`; automated tests: `tests/monster-progression.cjs`.
