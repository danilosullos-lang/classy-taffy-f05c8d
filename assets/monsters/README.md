# Monster assets

This directory is populated by the GitHub Actions import workflows. All imported models are additive; the original monsters, procedural enemies and playable characters remain intact.

## Current CC0 collection

- **Gobkit creature and fantasy-enemy packs — 182 rigged GLB models.** This curated selection contains 8 minions, 80 animals and flying/aquatic creatures, 10 dinosaurs, 60 insects, 8 orc legion enemies, 8 Bloodiron enemies and 8 horror enemies. It deliberately excludes modern civilian character packs and static environment props. Sources: [Gobkit free assets](https://gobkit.com/freebies) and its [machine-readable CC0 manifest](https://gobkit.com/api/free). License: CC0 1.0 Universal, recorded per model in `catalog.json`.
- **Quaternius Cute Animated Monsters — 21 textured glTF models.** Source: [official pack page](https://quaternius.com/packs/cutemonsters.html). License: CC0.
- **Quaternius Ultimate Monsters — 17 textured glTF models currently imported from the 50-model pack.** The official pack is animated and CC0; only the 17 glTF exports available to the importer are listed here. Source: [official pack page](https://quaternius.com/packs/ultimatemonsters.html).

**Catalog total: 220 animated models and 2,158 animation clips.** The catalog records the source URL, CC0 license URL/evidence, relative asset path, file size, and clip names for every model.

## Runtime integration

- `catalog.json` lists all 220 imported models.
- `index.html` keeps the original Cute Animated Monster pools and additively maps every Gobkit and Ultimate Monsters entry into the existing `mp`, `mg` and `ms` enemy pools.
- The browser smoke test resolves every catalog path against the runtime pools; the current check reports **220/220 mapped, 0 missing**.
- Gobkit models are skinned rigs. The runtime uses Three.js `SkeletonUtils.clone` and the model's own named animation clips, avoiding shared-skeleton animation bugs.
- Model files are stored as normal Git blobs, not Git LFS pointer files, so Vercel can serve them as static assets.

## Automated validation

The import workflow validates every model before publishing: glTF 2.0/GLB headers and chunks, buffer lengths, embedded/external textures, animation clips, file hashes and per-model CC0 provenance. The browser smoke test also loads representative original, Gobkit, Quaternius Cute and Quaternius Ultimate models in Chromium and checks that each has visible textured meshes and animation clips.

Imports are additive and use an allow-listed GitHub tree/API publisher. Existing game code and assets are not overwritten by the asset importer.
