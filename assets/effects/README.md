# Aetheria visual effects

## Kenney Particle Pack (selected sprites)

- Creator: Kenney Vleugels
- Official source: https://kenney.nl/assets/particle-pack
- Repository mirror: https://github.com/Calinou/kenney-particle-pack
- License: CC0 1.0 Universal; the original pack's `LICENSE.txt` is included.
- Imported sprites: flame, fireball, magic, spark, slash, smoke, holy light, impact ring and trail.
- Runtime: `index.html` loads these PNGs through Three.js `TextureLoader` and uses them in hit, monster-death and boss-combat particle bursts. The existing procedural particle emitter remains as a lightweight fallback.

The imported images are particle textures, not a complete particle engine. Aetheria's Three.js emitters, shader and animation logic provide the movement and lifetime.
