#!/usr/bin/env python3
"""Audit RPG model appearance: materials, base-color textures, images and runtime paths."""
from __future__ import annotations

import base64
import json
import re
import struct
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
CRITICAL_TREES = [
    "assets/world/trees/tree1.glb",
    "assets/world/trees/tree2.glb",
    "assets/world/trees/tree3.glb",
    "assets/world/trees/bush.glb",
]
CLASS_MODELS = [
    "skins/lyra-archer-animated.glb",
    "skins/classes/Barbarian.glb",
    "skins/classes/Knight.glb",
    "skins/classes/Mage.glb",
    "skins/classes/Rogue_Hooded.glb",
]


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def resolve_uri(model: Path, uri: str) -> bytes | None:
    if uri.startswith("data:"):
        try:
            header, payload = uri.split(",", 1)
            return base64.b64decode(payload) if ";base64" in header else unquote(payload).encode()
        except Exception as exc:
            fail(f"{model.relative_to(ROOT)}: URI data inválida: {exc}")
    parsed = urlsplit(uri)
    if parsed.scheme or parsed.netloc:
        fail(f"{model.relative_to(ROOT)}: dependência externa não incluída: {uri}")
    rel = Path(unquote(parsed.path))
    if rel.is_absolute() or ".." in rel.parts:
        fail(f"{model.relative_to(ROOT)}: caminho de dependência inseguro: {uri}")
    target = (model.parent / rel).resolve()
    if ROOT.resolve() not in target.parents or not target.is_file():
        fail(f"{model.relative_to(ROOT)}: arquivo dependente ausente: {uri}")
    return target.read_bytes()


def read_document(path: Path) -> dict:
    raw = path.read_bytes()
    if path.suffix.lower() == ".gltf":
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception as exc:
            fail(f"{path.relative_to(ROOT)}: glTF JSON inválido: {exc}")
    if len(raw) < 20 or raw[:4] != b"glTF":
        fail(f"{path.relative_to(ROOT)}: cabeçalho GLB inválido")
    version, declared = struct.unpack_from("<II", raw, 4)
    if version != 2 or declared != len(raw):
        fail(f"{path.relative_to(ROOT)}: versão/tamanho GLB inválido")
    offset, document = 12, None
    while offset + 8 <= len(raw):
        size, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        if offset + size > len(raw):
            fail(f"{path.relative_to(ROOT)}: chunk GLB truncado")
        chunk = raw[offset:offset + size]
        if kind == 0x4E4F534A:
            try:
                document = json.loads(chunk.decode("utf-8").rstrip(" \\t\\r\\n\\0"))
            except Exception as exc:
                fail(f"{path.relative_to(ROOT)}: JSON GLB inválido: {exc}")
        offset += size
    if not isinstance(document, dict):
        fail(f"{path.relative_to(ROOT)}: chunk JSON GLB ausente")
    return document


def audit_model(path: Path, require_texture: bool) -> tuple[int, int, int]:
    doc = read_document(path)
    if doc.get("asset", {}).get("version") != "2.0":
        fail(f"{path.relative_to(ROOT)}: não é glTF 2.0")
    for buffer in doc.get("buffers", []):
        uri = buffer.get("uri")
        if uri:
            data = resolve_uri(path, uri)
            if len(data) < int(buffer.get("byteLength", 0)):
                fail(f"{path.relative_to(ROOT)}: buffer incompleto: {uri}")
    images = doc.get("images", [])
    for image in images:
        uri = image.get("uri")
        if uri:
            data = resolve_uri(path, uri)
            if not data:
                fail(f"{path.relative_to(ROOT)}: imagem vazia: {uri}")
        elif "bufferView" not in image:
            fail(f"{path.relative_to(ROOT)}: imagem sem URI nem bufferView")
    textures = doc.get("textures", [])
    for texture in textures:
        source = texture.get("source")
        if source is not None and not (0 <= int(source) < len(images)):
            fail(f"{path.relative_to(ROOT)}: textura aponta para imagem inexistente")
    materials = doc.get("materials", [])
    textured_materials = 0
    for material in materials:
        pbr = material.get("pbrMetallicRoughness", {})
        info = pbr.get("baseColorTexture")
        if info:
            index = int(info.get("index", -1))
            if not (0 <= index < len(textures)):
                fail(f"{path.relative_to(ROOT)}: material aponta para textura inexistente")
            textured_materials += 1
    primitives = [p for mesh in doc.get("meshes", []) for p in mesh.get("primitives", [])]
    if not primitives:
        fail(f"{path.relative_to(ROOT)}: nenhum mesh/primitive visível")
    bad_materials = [p for p in primitives
                     if "material" in p and not (0 <= int(p["material"]) < len(materials))]
    if bad_materials:
        fail(f"{path.relative_to(ROOT)}: primitive aponta para material inexistente")
    if require_texture and textured_materials == 0:
        fail(f"{path.relative_to(ROOT)}: sem material com textura baseColor/diffuse")
    if require_texture and not images:
        fail(f"{path.relative_to(ROOT)}: não contém imagens de textura")
    return len(primitives), len(materials), textured_materials


def main() -> None:
    if not HTML.is_file():
        fail("index.html ausente")
    html = HTML.read_text(encoding="utf-8")
    checked = 0

    # Inspect every imported world model, not only the 29 assets currently placed by the runtime.
    world_root = ROOT / "assets/world"
    all_world_models = sorted([*world_root.rglob("*.glb"), *world_root.rglob("*.gltf")])
    world_without_color_maps = []
    for path in all_world_models:
        _, material_count, textured_count = audit_model(path, require_texture=False)
        if material_count and textured_count == 0:
            world_without_color_maps.append(path.relative_to(ROOT).as_posix())

    # All world models explicitly requested by the runtime must exist and contain mesh/material data.
    world_refs = re.findall(r"rpgWorldLoad\('([^']+)'\s*,\s*'([^']+)'", html)
    missing_world = [url for _, url in world_refs
                     if url.startswith("/") and not (ROOT / url.lstrip("/")).is_file()]
    if missing_world:
        fail(f"Modelos do mundo referenciados mas ausentes: {missing_world}")
    for key, url in world_refs:
        path = ROOT / url.lstrip("/")
        _, mats, _ = audit_model(path, require_texture=key in {"tree1", "tree2", "tree3", "bush", "palm"})
        checked += 1
        if mats == 0:
            print(f"AVISO: {path.relative_to(ROOT)} usa geometria sem material PBR.")

    # The four forest assets are required to have embedded/valid color textures.
    for rel in CRITICAL_TREES:
        path = ROOT / rel
        if not path.is_file():
            fail(f"Árvore ausente: {rel}")
        audit_model(path, require_texture=True)

    # Every playable class skin and every catalogued monster model must be textured.
    for rel in CLASS_MODELS:
        path = ROOT / rel
        if not path.is_file():
            fail(f"Skin de classe ausente: {rel}")
        audit_model(path, require_texture=True)

    catalog_path = ROOT / "assets/monsters/catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    monsters = catalog.get("monsters", [])
    if len(monsters) != int(catalog.get("count", -1)):
        fail("Quantidade do catálogo de monstros diverge do campo count.")
    monster_paths = set()
    for item in monsters:
        rel = item.get("path", "")
        path = (ROOT / rel).resolve()
        if ROOT.resolve() not in path.parents or not path.is_file():
            fail(f"Modelo de monstro ausente/inseguro: {rel}")
        if rel in monster_paths:
            fail(f"Modelo duplicado no catálogo: {rel}")
        monster_paths.add(rel)
        audit_model(path, require_texture=True)

    # Ensure each catalogued monster is reachable by one of the three runtime enemy pools.
    start = html.find("const MONSTER_ASSET_PATHS=")
    end = html.find("const MONSTER_ASSET_NAMES=", start)
    if start < 0 or end < 0:
        fail("Mapeamento de monstros do runtime não encontrado.")
    mapping = html[start:end]
    referenced = set()
    for rel in re.findall(r"'(/assets/monsters/packs/gobkit/[^']+\.glb)'", mapping):
        referenced.add(rel.lstrip("/"))
    for name in re.findall(r"'([A-Za-z0-9_]+)'", mapping):
        candidate = f"assets/monsters/packs/quaternius-cute/{name}.gltf"
        if (ROOT / candidate).is_file():
            referenced.add(candidate)
    for rel in re.findall(r"'(/monster_[^']+\.glb)'", mapping):
        referenced.add(rel.lstrip("/"))
    # Gobkit and Quaternius Ultimate entries are injected from catalog.json at runtime.
    dynamic_start = html.find("function loadAdditionalMonsterCatalog")
    dynamic_end = html.find("const MONSTER_GLTF_CACHE", dynamic_start)
    if dynamic_start < 0 or dynamic_end < 0:
        fail("Carregador dinâmico do catálogo de monstros não encontrado.")
    dynamic_loader = html[dynamic_start:dynamic_end]
    if ("fetch('/assets/monsters/catalog.json')" not in dynamic_loader or
        "entries.filter(item=>item&&item.path&&/(ultimate|gobkit)/i.test(String(item.pack||'')))" not in dynamic_loader or
        "MONSTER_ASSET_PATHS[pool].push(url)" not in dynamic_loader):
        fail("O catálogo CC0 não está conectado aos pools de spawn do runtime.")
    for item in monsters:
        if re.search(r"(ultimate|gobkit)", str(item.get("pack", "")), re.I):
            referenced.add(str(item.get("path", "")))

    absent_refs = sorted(p for p in referenced if not (ROOT / p).is_file())
    if absent_refs:
        fail(f"Modelos usados pelo runtime não existem: {absent_refs}")
    unspawned = sorted(monster_paths - referenced)
    if unspawned:
        fail(f"Monstros catalogados sem referência nas listas de spawn: {unspawned}")

    print(f"APARÊNCIA OK: {len(CRITICAL_TREES) + 1} modelos de vegetação texturizados, "
          f"{len(CLASS_MODELS)} skins de personagem, {len(monsters)} monstros com imagens e materiais, "
          f"{len(world_refs)} modelos de cenário referenciados ({checked} verificados).")
    print(f"AUDITORIA COMPLETA DO ACERVO: {len(all_world_models)} modelos do mundo inspecionados; "
          f"{len(world_without_color_maps)} não contêm mapas de cor próprios e dependem de material/fallback do jogo.")
    if world_without_color_maps:
        for rel in world_without_color_maps[:30]:
            print(f"SEM MAPA DE COR EMBUTIDO (requer fallback PBR): {rel}")


if __name__ == "__main__":
    main()
