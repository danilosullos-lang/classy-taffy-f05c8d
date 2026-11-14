# Poly Haven PBR textures

This directory is populated by `.github/workflows/import-polyhaven-textures.yml`.

- Source: [Poly Haven](https://polyhaven.com/)
- License: [CC0 1.0 Universal](https://polyhaven.com/license)
- Files are downloaded from the official Poly Haven asset API and checked against the API-provided MD5 hash.
- The importer prefers 1K maps and uses 2K only as a fallback to keep downloads and mobile memory use reasonable.
- `manifest.json` records the exact asset IDs, source pages, map paths, sizes, and hashes.

Downloaded files are real image texture maps, not generated canvas patterns. They are not considered integrated into a game material until the game code explicitly loads and applies them.
