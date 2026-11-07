# Interlude reference research

See [the deep Interlude systems report](../../docs/LINEAGE2-INTERLUDE-SYSTEMS-REVERSE-ENGINEERING.md).

## Research sources and actual status

- **L2PackTool 1.13.2** — its public source and Interlude table/package references were inspected. The upstream repository identifies its authored source as MIT. It is **not downloaded or executed by the current game-check workflow**; its Windows installer and any original client data are not part of this project.
- **L2E** and **dr3dd/L2Interlude** — public server-side code and documentation are behavioral references for state machines, persistence, geodata, pathfinding and NPC interaction. They are not copied into the runtime.
- **Elbera Tools Core, BSP Inspector and NPC Source** — the current CI downloads three pinned source-only release archives, checks their SHA-256 values, extracts them into the ignored `vendor/` directory, verifies each archive's MIT license and source-only manifest, and runs the portable smoke suite shipped with each kit.

## What each Elbera kit actually does

| Kit | Verified source capability | Important boundary |
| --- | --- | --- |
| **Core 0.2.0 preview** | Bounded Unreal/package and DAT readers, texture pixel decoders, XDAT inspection and embedded-script extraction helpers. | Encrypted formats may require a separately built `l2encdec`; no game assets or decoder binary are bundled. |
| **BSP Inspector 0.1.0** | Standalone browser diagnostic for world-BSP queries, with a shared JavaScript query module and synthetic fixtures. | It is **not** a complete physics, terrain, actor-collision, walking or camera engine. A clear BSP result does not prove the whole world is collision-free. |
| **NPC Source 0.1.0** | Qualified NPC selectors, original sparse animation-key inspection and bounded NPC appearance/animation evidence tools. | Original inputs must come from a client the user is legally entitled to inspect; optional native fixture checks require Capstone 5.0.7. The kit does not contain NPC models. |

The portable kit tests use authored synthetic fixtures. Passing them verifies the included source and its declared boundaries; it does not prove complete original-client parity or authorize use of proprietary client data.

## License and content boundary

The Elbera release archives include their own MIT `LICENSE` files. That license covers Elbera-authored source and documentation only. It does **not** grant rights to Lineage II textures, models, maps, audio, DAT tables or other NCSoft content, and it does not relicense separately vendored third-party components. L2PackTool's own source is MIT; third-party viewers and game data retain their own terms.

This repository contains no local Interlude client, no extracted NCSoft data and no redistributed proprietary Lineage II assets. The CI audit rejects the client-asset and binary formats listed in its source-boundary check. Downloaded research archives remain ignored build inputs and are not committed into the game.

## Reproducibility

The downloader is `download_tools.py`. It pins each release URL and SHA-256, limits archive size and entry count, rejects path traversal and symlinks, and validates ZIP integrity before extraction.

Run the offline downloader safety test:

```sh
python tools/lineage2-reference/download_tools.py --self-test
```

The complete download, license/manifest audit and three portable kit smoke suites run in [game-checks.yml](../../.github/workflows/game-checks.yml). The current game runtime remains Three.js; these research tools are references, not replacement engines or runtime dependencies.
