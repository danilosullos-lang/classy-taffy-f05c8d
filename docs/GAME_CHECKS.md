# Game integrity checks

Run this before publishing changes to the game:

```bash
python scripts/validate_game.py
```

The check verifies that:
- `skins/skins.json` is valid JSON and has the expected structure;
- each local skin path resolves correctly (including URL-encoded spaces);
- every referenced file exists and has a valid GLB v2 header and size;
- the game entry point still contains the skin-catalog loader.

GitHub Actions runs the same check on pushes, pull requests, and manual dispatches.

This is an asset/integrity check, not a substitute for opening the game in a browser and testing movement, combat, touch controls, or multiplayer with two real devices.
