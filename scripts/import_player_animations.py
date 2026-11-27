#!/usr/bin/env python3
"""Download CC0 Quaternius animation libraries and retarget them onto the Lyra player GLB."""
from pathlib import Path
from urllib.request import Request, urlopen
import os, subprocess, tempfile, time, struct

ROOT = Path(__file__).resolve().parents[1]
CHARACTER = ROOT / "skins" / "lyra-archer-animated.glb"
MERGER = ROOT / "scripts" / "merge_player_animations.mjs"
SOURCES = {
    "UAL1_Standard.glb": "https://raw.githubusercontent.com/NafisRayan/Animate-Rigged-Humanoid-No-Blender/main/Universal%20Animation%20Library%5BStandard%5D/Universal%20Animation%20Library%5BStandard%5D/Unreal-Godot/UAL1_Standard.glb",
    "UAL2_Standard.glb": "https://raw.githubusercontent.com/NafisRayan/Animate-Rigged-Humanoid-No-Blender/main/Universal%20Animation%20Library%202%5BStandard%5D/Universal%20Animation%20Library%202%5BStandard%5D/Unreal-Godot/UAL2_Standard.glb",
}

def download(url: str, destination: Path) -> None:
    """Fetch a CC0 GLB pack with retries and reject HTML/error payloads."""
    last_error = None
    for attempt in range(1, 4):
        try:
            request = Request(url, headers={"User-Agent": "Aetheria-RPG-CC0-Animation-Importer/1.1"})
            with urlopen(request, timeout=180) as response, destination.open("wb") as output:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    output.write(chunk)
            data = destination.read_bytes()
            if len(data) < 1024 * 1024:
                raise RuntimeError(f"Downloaded animation library is unexpectedly small: {destination}")
            if data[:4] != b"glTF":
                raise RuntimeError(f"Downloaded asset is not a binary glTF/GLB: {destination}")
            version, declared_length = struct.unpack_from("<II", data, 4)
            if version != 2 or declared_length != len(data):
                raise RuntimeError(f"Downloaded GLB header/length is invalid: {destination}")
            return
        except Exception as exc:
            last_error = exc
            destination.unlink(missing_ok=True)
            if attempt < 3:
                print(f"Download attempt {attempt} failed: {exc}; retrying...", flush=True)
                time.sleep(attempt * 3)
    raise RuntimeError(f"Unable to download and validate {url}: {last_error}")

def main() -> None:
    if not CHARACTER.exists(): raise FileNotFoundError(CHARACTER)
    with tempfile.TemporaryDirectory(prefix="rpg-player-anim-") as temp:
        tempdir = Path(temp)
        libraries = []
        for filename, url in SOURCES.items():
            target = tempdir / filename
            print(f"Downloading CC0 Quaternius humanoid combat/locomotion library: {filename}", flush=True)
            download(url, target)
            print(f"  {target.stat().st_size:,} bytes", flush=True)
            libraries.append(target)
        # Retarget the same CC0 clips onto every playable class rig. A class whose
        # skeleton is incompatible is left untouched; Lyra is the required fallback.
        characters = [
            CHARACTER,
            ROOT / "skins" / "classes" / "Barbarian.glb",
            ROOT / "skins" / "classes" / "Mage.glb",
            ROOT / "skins" / "classes" / "Rogue_Hooded.glb",
            ROOT / "skins" / "classes" / "Knight.glb",
        ]
        updated = []
        for character in characters:
            if not character.is_file():
                if character == CHARACTER:
                    raise FileNotFoundError(character)
                print(f"SKIP: optional class model not found: {character.relative_to(ROOT)}", flush=True)
                continue
            output = tempdir / f"{character.stem}-merged.glb"
            try:
                subprocess.run(
                    ["node", str(MERGER), str(character), str(output), *(str(p) for p in libraries)],
                    cwd=ROOT,
                    check=True,
                )
            except subprocess.CalledProcessError:
                if character == CHARACTER:
                    raise RuntimeError("Required Lyra fallback rig could not accept the CC0 animation library.")
                print(f"SKIP: incompatible rig; keeping original {character.relative_to(ROOT)}", flush=True)
                continue
            if not output.exists() or output.stat().st_size < character.stat().st_size:
                if character == CHARACTER:
                    raise RuntimeError("Merged Lyra GLB did not pass basic size validation.")
                print(f"SKIP: merged class model failed size validation: {character.relative_to(ROOT)}", flush=True)
                continue
            os.replace(output, character)
            updated.append(character)
            print(f"Updated {character.relative_to(ROOT)}: {character.stat().st_size:,} bytes", flush=True)
        if CHARACTER not in updated:
            raise RuntimeError("The required Lyra animation fallback was not updated.")
        print(f"CC0 animation import complete: {len(updated)} playable rig(s) updated.", flush=True)

if __name__ == "__main__":
    main()
