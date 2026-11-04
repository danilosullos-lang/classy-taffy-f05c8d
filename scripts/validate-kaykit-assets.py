#!/usr/bin/env python3
"""Validate downloaded KayKit GLBs and prove the animation rig matches the player models."""
from __future__ import annotations
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = ("Barbarian", "Knight", "Mage", "Rogue_Hooded")
SETS = ("general", "movement-basic", "movement-advanced", "combat-melee",
        "combat-ranged", "simulation", "special", "tools")


def read_glb(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError(f"Not a GLB file: {path}")
    version, total = struct.unpack_from("<II", data, 4)
    if version != 2 or total != len(data):
        raise ValueError(f"Invalid GLB header: {path} (version={version}, bytes={total}/{len(data)})")
    offset = 12
    while offset + 8 <= len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8:offset + 8 + length]
        if chunk_type == 0x4E4F534A:
            return json.loads(chunk.decode("utf-8"))
        offset += 8 + length
    raise ValueError(f"GLB JSON chunk missing: {path}")


def model_joints(doc: dict) -> set[str]:
    nodes = doc.get("nodes", [])
    names = set()
    for skin in doc.get("skins", []):
        for index in skin.get("joints", []):
            if index < len(nodes):
                names.add(nodes[index].get("name", ""))
    return {name for name in names if name}


def animation_targets(doc: dict) -> set[str]:
    nodes = doc.get("nodes", [])
    result = set()
    for animation in doc.get("animations", []):
        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            node = target.get("node")
            if node is not None and node < len(nodes):
                result.add(nodes[node].get("name", ""))
    return {name for name in result if name}


def main() -> None:
    model_docs = {}
    for name in MODELS:
        path = ROOT / "skins" / "classes" / f"{name}.glb"
        doc = read_glb(path)
        joints = model_joints(doc)
        if len(joints) < 15:
            raise SystemExit(f"{name}: expected a humanoid rig with >=15 joints, got {len(joints)}")
        if not doc.get("meshes") or not doc.get("materials") or not doc.get("images"):
            raise SystemExit(f"{name}: model is missing mesh/material/texture data")
        model_docs[name] = (doc, joints)

    reference_joints = model_docs["Barbarian"][1]
    for name, (_, joints) in model_docs.items():
        overlap = len(reference_joints & joints)
        if overlap < 15:
            raise SystemExit(f"{name}: incompatible class rig ({overlap} shared joints with Barbarian)")

    total_clips = 0
    for name in SETS:
        path = ROOT / "assets" / "animations" / "kaykit" / "rig-medium" / f"{name}.glb"
        doc = read_glb(path)
        clips = doc.get("animations", [])
        if not clips:
            raise SystemExit(f"{name}: animation set contains no clips")
        targets = animation_targets(doc)
        matched = len(reference_joints & targets)
        if matched < 10:
            raise SystemExit(f"{name}: animation rig does not match KayKit player rig ({matched} shared targets)")
        total_clips += len(clips)
        print(f"PASS {name}: {len(clips)} clips, {matched} matching bone targets")

    if total_clips < 40:
        raise SystemExit(f"Expected at least 40 animation clips, got {total_clips}")
    print(f"PASS {len(MODELS)} class skins; {total_clips} KayKit animation clips; CC0 Rig_Medium compatibility verified")


if __name__ == "__main__":
    main()
