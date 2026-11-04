# Aetheria visual effects

## Kenney Particle Pack

- Creator: Kenney Vleugels
- Official source: https://kenney.nl/assets/particle-pack
- Repository mirror: https://github.com/Calinou/kenney-particle-pack
- License: CC0 1.0 Universal; the original pack's `LICENSE.txt` is included.
- Imported collection: all 80 original PNG sprites plus 16 rotated helper variants (96 PNG files total).
- Categories include flame/fire, magic, sparks, slash trails, smoke, light, circles, dirt, scorch, stars and other particle masks.
- Runtime: `index.html` loads nine selected textures through Three.js `TextureLoader` for hit, monster-death and boss-combat bursts. The remaining textures are available for future class skills and environmental effects.
- The existing procedural particle emitter and shader remain as the particle engine and lightweight fallback.

These are particle textures, not a complete particle engine. Aetheria's Three.js emitters, shader and animation logic provide movement, blending and lifetime.
