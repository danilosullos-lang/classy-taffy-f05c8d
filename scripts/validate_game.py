#!/usr/bin/env python3
"""Validate the game's external skin catalog and referenced GLB assets."""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "skins" / "skins.json"


def fail(message: str) -> None:
    print(f"ERRO: {message}", file=sys.stderr)
    raise SystemExit(1)


def read_glb_json(path: Path) -> dict:
    """Read the JSON chunk from a GLB without external glTF dependencies."""
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        fail(f"{path.relative_to(ROOT)}: cabeçalho GLB ausente.")
    offset = 12
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        start, end = offset + 8, offset + 8 + chunk_length
        if end > len(data):
            fail(f"{path.relative_to(ROOT)}: chunk GLB ultrapassa o tamanho do arquivo.")
        if chunk_type == 0x4E4F534A:  # JSON
            try:
                value = json.loads(data[start:end].decode("utf-8").rstrip(" \\t\\r\\n\\0"))
            except (UnicodeError, json.JSONDecodeError) as exc:
                fail(f"{path.relative_to(ROOT)}: chunk JSON inválido: {exc}")
            if not isinstance(value, dict):
                fail(f"{path.relative_to(ROOT)}: raiz JSON do glTF inválida.")
            return value
        offset = end
    fail(f"{path.relative_to(ROOT)}: chunk JSON não encontrado no GLB.")
    return {}


def main() -> None:
    if not CATALOG.is_file():
        fail("skins/skins.json não existe.")

    try:
        skins = json.loads(CATALOG.read_text(encoding="utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        fail(f"catálogo JSON inválido: {exc}")

    if not isinstance(skins, list):
        fail("o catálogo precisa ser uma lista JSON.")
    if not skins:
        print("AVISO: catálogo sem skins cadastradas.")

    seen: set[str] = set()
    for index, skin in enumerate(skins, start=1):
        if not isinstance(skin, dict):
            fail(f"item {index} não é um objeto.")
        name = str(skin.get("nome", "")).strip()
        asset = skin.get("arquivo")
        if not name or not isinstance(asset, str) or not asset.strip():
            fail(f"item {index} precisa de nome e arquivo.")
        parsed = urlsplit(asset.strip())
        if parsed.scheme or parsed.netloc or not parsed.path.startswith("/skins/"):
            fail(f"{name}: use um caminho local iniciado por /skins/.")
        relative = unquote(parsed.path).lstrip("/")
        if ".." in Path(relative).parts:
            fail(f"{name}: caminho não pode sair da pasta do jogo.")
        if relative in seen:
            fail(f"arquivo duplicado no catálogo: {relative}")
        seen.add(relative)

        path = ROOT / relative
        if not path.is_file():
            fail(f"{name}: arquivo não encontrado: {relative}")
        with path.open("rb") as file:
            header = file.read(12)
        if len(header) != 12 or header[:4] != b"glTF":
            fail(f"{name}: {relative} não parece ser um GLB válido.")
        version, declared_length = struct.unpack("<II", header[4:12])
        if version != 2:
            fail(f"{name}: GLB precisa usar a versão 2 (encontrada: {version}).")
        if declared_length != path.stat().st_size:
            fail(f"{name}: tamanho declarado no cabeçalho GLB não confere.")
        print(f"OK: {name} -> {relative} ({path.stat().st_size} bytes)")

    # Validate the class-specific models too; these files must be real GLBs, not Git LFS pointer text.
    class_catalog_path = ROOT / "skins" / "class-skins.json"
    if not class_catalog_path.is_file():
        fail("skins/class-skins.json não existe.")
    try:
        class_catalog = json.loads(class_catalog_path.read_text(encoding="utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        fail(f"catálogo de classes inválido: {exc}")
    assets = class_catalog.get("assets") if isinstance(class_catalog, dict) else None
    if not isinstance(assets, dict) or not assets:
        fail("skins/class-skins.json precisa conter um objeto assets.")
    checked_class_assets: set[str] = set()
    for class_key, item in assets.items():
        if not isinstance(item, dict) or not isinstance(item.get("url"), str):
            fail(f"skin de classe inválida: {class_key}")
        parsed = urlsplit(item["url"].strip())
        if parsed.scheme or parsed.netloc or not parsed.path.startswith("/skins/"):
            fail(f"{class_key}: use um caminho local iniciado por /skins/.")
        relative = unquote(parsed.path).lstrip("/")
        if relative in checked_class_assets:
            continue
        checked_class_assets.add(relative)
        path = ROOT / relative
        if not path.is_file():
            fail(f"{class_key}: modelo de classe não encontrado: {relative}")
        data = path.read_bytes()
        if data.startswith(b"version https://git-lfs.github.com/spec/v1"):
            fail(f"{relative}: ainda é um ponteiro Git LFS; Vercel não servirá o modelo 3D real.")
        if len(data) < 12 or data[:4] != b"glTF":
            fail(f"{relative}: não parece ser um GLB válido.")
        version, declared_length = struct.unpack("<II", data[4:12])
        if version != 2 or declared_length != len(data):
            fail(f"{relative}: versão ou tamanho do GLB inválido.")
        print(f"OK classe: {class_key} -> {relative} ({len(data):,} bytes)")

    # The main playable archer rig must contain the complete imported CC0 animation library.
    player_path = ROOT / "skins" / "lyra-archer-animated.glb"
    player_gltf = read_glb_json(player_path)
    player_clips = player_gltf.get("animations", [])
    player_skins = player_gltf.get("skins", [])
    joint_count = max((len(item.get("joints", [])) for item in player_skins if isinstance(item, dict)), default=0)
    if len(player_clips) < 150:
        fail(f"Biblioteca de animações do jogador incompleta: {len(player_clips)} clipes (mínimo 150).")
    if joint_count < 15:
        fail(f"Rig de animação do jogador incompleto: {joint_count} articulações (mínimo 15).")
    print(f"OK animações do jogador: {len(player_clips)} clipes, {joint_count} articulações.")

    if not (ROOT / "index.html").is_file():
        fail("index.html não existe.")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    if "fetch('/skins/skins.json'" not in html:
        fail("index.html não parece carregar o catálogo de skins.")
    # The game bundles its matching Three.js runtime so GLB loading works without a third-party CDN.
    runtime_files = (
        "lib/three.min.js",
        "lib/GLTFLoader.js",
        "lib/SkeletonUtils.js",
        "lib/Pass.js",
        "lib/MaskPass.js",
        "lib/EffectComposer.js",
        "lib/RenderPass.js",
        "lib/UnrealBloomPass.js",
        "lib/ShaderPass.js",
        "lib/CopyShader.js",
        "lib/LuminosityHighPassShader.js",
    )
    for relative in runtime_files:
        path = ROOT / relative
        if not path.is_file() or path.stat().st_size < 100:
            fail(f"biblioteca local ausente ou incompleta: {relative}")
        print(f"OK runtime: {relative} ({path.stat().st_size:,} bytes)")
    for required_tag in ('<script src="lib/three.min.js"></script>', '<script src="lib/GLTFLoader.js"></script>', '<script src="lib/EffectComposer.js"></script>'):
        if required_tag not in html:
            fail(f"index.html não carrega biblioteca local obrigatória: {required_tag}")

    print(f"Validação concluída: {len(skins)} skin(s) verificada(s).")


if __name__ == "__main__":
    main()
