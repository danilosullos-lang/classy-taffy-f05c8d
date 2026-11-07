# KayKit class skins and animation library

The playable character models and animation sets in this directory are from Kay Lousberg / KayKit and are released under CC0 1.0 Universal.

## Models

- Barbarian, Knight, Mage, Rogue_Hooded — [KayKit Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0)
- The same four humanoid rigs are shared across class specializations. The game equips the appropriate class weapon and applies class-specific material accents.

## Animation sets

- General, Movement Basic, Movement Advanced, Combat Melee, Combat Ranged, Simulation, Special and Tools — [KayKit Character Animations 1.1](https://kaylousberg.itch.io/kaykit-character-animations)
- The free animation files are distributed under CC0 1.0. The source archive also includes the creator's license text.
- Runtime uses the Rig_Medium exports because the four playable Adventurers models use that humanoid rig. Movement clips are played in-place; root position/scale tracks are intentionally filtered so they cannot displace or hide the player.

## Import and validation

- `scripts/sync-kaykit-assets.sh` downloads the public model GLBs and the CC0 Rig_Medium animation GLBs.
- `scripts/validate-kaykit-assets.py` validates GLB headers, model geometry/materials/textures, animation counts, and matching skeleton joint names before the assets are committed.
- Asset source archive for the animation exports: [GeorgeQLe/assets-kaykit-3d-characters](https://github.com/GeorgeQLe/assets-kaykit-3d-characters). This archive includes KayKit's original CC0 license file.

These files are game assets, not standalone products. Do not resell the unmodified asset files as a separate asset pack.
