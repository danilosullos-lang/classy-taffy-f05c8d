# Interlude reference research

See [the deep Interlude systems report](../../docs/LINEAGE2-INTERLUDE-SYSTEMS-REVERSE-ENGINEERING.md).

The research sources now cover three distinct layers:

- **L2PackTool 1.13.2** — C6 client table definitions, Unreal package references, missing-asset audit, and client-side resource tooling. Its pinned source is downloaded as a GitHub Actions artifact by .github/workflows/lineage2-client-research.yml.
- **L2E** — server-side state machines and domain inventory for Interlude.
- **ELBERA Core/BSP/NPC kits** — bounded file readers, collision inspection and NPC appearance/animation research.

L2PackTool's Windows installer:
https://github.com/JEAN-ALMEIDA-CZO/L2PackTool/releases/download/v1.13.2/L2PackTool-Setup-1.13.2.exe

The installer is Windows-only (about 338 MB). The smaller source archive is published as the L2PackTool-v1.13.2-source workflow artifact. The tool's source license is MIT; third-party viewers and original Lineage II client data are not bundled.

No local Interlude client data is included in this repository, so exact content counts and raw client exports are not claimed as extracted.
