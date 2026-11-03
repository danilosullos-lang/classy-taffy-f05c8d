# Monster skins, animations and audio coverage

## Inventory
- 220 catalogued monster models across 17 Gobkit and Quaternius packs; all 220 declare animation clips, with 182 skeletal-rigged models and 2,158 total clips.
- The monster GLTF validator checks glTF structure, buffers, accessors, rig/skeleton references, animation channels, material texture references and embedded or sidecar image bytes. The 38 animated models without a skeletal skin use node animation tracks and remain separately reported rather than mislabeled as skeletal rigs.
- 214 imported CC0 audio files are catalogued before the additional Ogrebane pack is imported; the importer now adds the 1.4 MB Ogrebane Monster Sound Effects Pack (CC0) and rebuilds the profiles after download.
- Six catalog entries reuse display names, so the audio map is keyed by the exact model path, not by name. This preserves all 220 models as separate entries.

## Implemented
- Stable audio profile for every one of the 220 model paths.
- Profiles classify creatures into slime, insect, aquatic, undead, mythic, humanoid, flying or beast families.
- Attack, aggro, hurt, death and idle event pools use existing CC0 sounds. Candidate order is rotated deterministically by model path so variants differ across individual models.
- Runtime resolves the sound profile from the exact model URL. Unknown or non-catalogued enemies retain the generic sound fallback.
- CI regenerates and validates all profiles and runs the existing model/texture/rig/animation validator.

## Acceptance boundary
Static checks verify every profile and audio path. They do not replace browser playback testing or visual inspection under game lighting.

## Sources
- [Quaternius Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters)
- [Quaternius Cute Animated Monsters](https://quaternius.com/packs/cutemonsters)
- Gobkit CC0 models, with per-model provenance in the monster catalog
- Kenney RPG audio, Rubberduck CC0 RPG / creature SFX, and Ogrebane Monster Sound Effects (CC0), with source URLs and archive/file hashes in the audio catalog

The audio import workflow now refreshes the monster map and validates both catalogs after downloading the Ogrebane archive. The upstream OpenGameArt page marks that pack CC0. See [source](https://opengameart.org/content/monster-sound-effects-pack).
