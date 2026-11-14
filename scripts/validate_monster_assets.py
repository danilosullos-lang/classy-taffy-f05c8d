#!/usr/bin/env python3
"""Validate imported CC0 monster glTF/GLB assets without modifying game files."""
from __future__ import annotations
import base64, json, struct, sys
from pathlib import Path
from urllib.parse import unquote, unquote_to_bytes, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "assets/monsters/catalog.json"
CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/"
COMPONENT_TYPES = {5120, 5121, 5122, 5123, 5125, 5126}
ACCESSOR_TYPES = {"SCALAR", "VEC2", "VEC3", "VEC4", "MAT2", "MAT3", "MAT4"}

def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

def resolve_local(model: Path, uri: str) -> Path:
    parsed = urlsplit(uri)
    if parsed.scheme or parsed.netloc:
        fail(f"{model}: external network dependency is not vendored: {uri}")
    rel = Path(unquote(parsed.path))
    if rel.is_absolute() or ".." in rel.parts:
        fail(f"{model}: unsafe dependency path: {uri}")
    path = (model.parent / rel).resolve()
    if ROOT.resolve() not in path.parents:
        fail(f"{model}: dependency escapes repository: {uri}")
    if not path.is_file():
        fail(f"{model}: missing dependency: {uri}")
    return path

def decode_data_uri(uri: str, label: str) -> tuple[bytes, str]:
    try:
        header, payload = uri.split(",", 1)
        raw = base64.b64decode(payload, validate=True) if ";base64" in header else unquote_to_bytes(payload)
    except Exception as exc:
        fail(f"{label}: invalid data URI: {exc}")
    if not raw:
        fail(f"{label}: empty data URI")
    mime = header[5:].split(";", 1)[0].lower() if header.startswith("data:") else ""
    return raw, mime

def image_mime_from_path(path: Path) -> str:
    return {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".ktx2": "image/ktx2"
    }.get(path.suffix.lower(), "")

def check_image_bytes(raw: bytes, label: str, mime: str = "") -> None:
    if not raw:
        fail(f"{label}: empty image payload")
    signatures = {
        "image/png": raw.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": raw.startswith(b"\xff\xd8\xff"),
        "image/webp": len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP",
        "image/ktx2": raw.startswith(bytes.fromhex("AB4B5458203230BB0D0A1A0A")),
    }
    if mime:
        if mime not in signatures:
            fail(f"{label}: unsupported image MIME type {mime}")
        if not signatures[mime]:
            fail(f"{label}: image bytes do not match {mime}")
    elif not any(signatures.values()):
        fail(f"{label}: unsupported or corrupt image bytes")

def validate_document(doc: dict, path: Path, buffers: list[bytes]) -> tuple[int, list[str]]:
    if doc.get("asset", {}).get("version") != "2.0":
        fail(f"{path}: expected glTF 2.0")

    views = doc.get("bufferViews", [])
    for i, view in enumerate(views):
        bi = int(view.get("buffer", 0))
        if bi < 0 or bi >= len(buffers):
            fail(f"{path}: bufferView {i} references missing buffer {bi}")
        start = int(view.get("byteOffset", 0))
        length = int(view.get("byteLength", -1))
        if start < 0 or length < 0 or start + length > len(buffers[bi]):
            fail(f"{path}: bufferView {i} exceeds buffer {bi}")
        stride = view.get("byteStride")
        if stride is not None and not 4 <= int(stride) <= 252:
            fail(f"{path}: bufferView {i} has invalid byteStride")

    accessors = doc.get("accessors", [])
    for i, accessor in enumerate(accessors):
        if int(accessor.get("count", 0)) <= 0:
            fail(f"{path}: accessor {i} has no elements")
        if int(accessor.get("componentType", 0)) not in COMPONENT_TYPES:
            fail(f"{path}: accessor {i} has invalid componentType")
        if accessor.get("type") not in ACCESSOR_TYPES:
            fail(f"{path}: accessor {i} has invalid type")
        if "bufferView" in accessor and not 0 <= int(accessor["bufferView"]) < len(views):
            fail(f"{path}: accessor {i} references missing bufferView")
        sparse = accessor.get("sparse")
        if sparse:
            for key in ("indices", "values"):
                bv = sparse.get(key, {}).get("bufferView")
                if bv is None or not 0 <= int(bv) < len(views):
                    fail(f"{path}: accessor {i} sparse {key} references missing bufferView")

    nodes = doc.get("nodes", [])
    for i, node in enumerate(nodes):
        for child in node.get("children", []):
            if not 0 <= int(child) < len(nodes):
                fail(f"{path}: node {i} references missing child {child}")
        skin = node.get("skin")
        if skin is not None and not 0 <= int(skin) < len(doc.get("skins", [])):
            fail(f"{path}: node {i} references missing skin {skin}")

    for i, skin in enumerate(doc.get("skins", [])):
        joints = skin.get("joints", [])
        if not joints or any(not 0 <= int(node) < len(nodes) for node in joints):
            fail(f"{path}: skin {i} has invalid joints")
        accessor = skin.get("inverseBindMatrices")
        if accessor is not None and not 0 <= int(accessor) < len(accessors):
            fail(f"{path}: skin {i} references missing inverseBindMatrices accessor")

    images = doc.get("images", [])
    for i, img in enumerate(images):
        uri = img.get("uri")
        if uri:
            if uri.startswith("data:"):
                raw, mime = decode_data_uri(uri, f"{path}: image {i}")
            else:
                image_path = resolve_local(path, uri)
                raw = image_path.read_bytes()
                mime = img.get("mimeType") or image_mime_from_path(image_path)
        elif "bufferView" in img:
            vi = int(img["bufferView"])
            if not 0 <= vi < len(views):
                fail(f"{path}: image {i} references missing bufferView")
            if not img.get("mimeType"):
                fail(f"{path}: image {i} has no mimeType")
            view = views[vi]
            raw = buffers[int(view.get("buffer", 0))][int(view.get("byteOffset", 0)):int(view.get("byteOffset", 0)) + int(view["byteLength"])]
            mime = img["mimeType"]
        else:
            fail(f"{path}: image {i} has neither URI nor bufferView")
        check_image_bytes(raw, f"{path}: image {i}", mime)

    textures = doc.get("textures", [])
    for i, texture in enumerate(textures):
        source = texture.get("source")
        basisu = texture.get("extensions", {}).get("KHR_texture_basisu", {}).get("source")
        source = source if source is not None else basisu
        if source is not None and not 0 <= int(source) < len(images):
            fail(f"{path}: texture {i} references missing image {source}")
        sampler = texture.get("sampler")
        if sampler is not None and not 0 <= int(sampler) < len(doc.get("samplers", [])):
            fail(f"{path}: texture {i} references missing sampler {sampler}")

    for i, material in enumerate(doc.get("materials", [])):
        pbr = material.get("pbrMetallicRoughness", {})
        texture_infos = [
            pbr.get("baseColorTexture"), pbr.get("metallicRoughnessTexture"),
            material.get("normalTexture"), material.get("occlusionTexture"),
            material.get("emissiveTexture")
        ]
        for info in texture_infos:
            if info is not None and not 0 <= int(info.get("index", -1)) < len(textures):
                fail(f"{path}: material {i} references missing texture")

    for i, mesh in enumerate(doc.get("meshes", [])):
        for primitive in mesh.get("primitives", []):
            refs = list(primitive.get("attributes", {}).values())
            if primitive.get("indices") is not None:
                refs.append(primitive["indices"])
            if any(not 0 <= int(ref) < len(accessors) for ref in refs):
                fail(f"{path}: mesh {i} references missing accessor")
            material = primitive.get("material")
            if material is not None and not 0 <= int(material) < len(doc.get("materials", [])):
                fail(f"{path}: mesh {i} references missing material")

    animations = doc.get("animations", [])
    if not isinstance(animations, list):
        fail(f"{path}: animations must be a list")
    names = []
    for i, clip in enumerate(animations):
        samplers = clip.get("samplers", [])
        channels = clip.get("channels", [])
        if not samplers or not channels:
            fail(f"{path}: animation {i} has no samplers/channels")
        names.append(str(clip.get("name") or f"animation-{i}"))
        for j, sampler in enumerate(samplers):
            for key in ("input", "output"):
                accessor = sampler.get(key)
                if accessor is None or not 0 <= int(accessor) < len(accessors):
                    fail(f"{path}: animation {i} sampler {j} has invalid {key} accessor")
        for j, channel in enumerate(channels):
            if not 0 <= int(channel.get("sampler", -1)) < len(samplers):
                fail(f"{path}: animation {i} channel {j} has invalid sampler")
            target = channel.get("target", {})
            node = target.get("node")
            if node is not None and not 0 <= int(node) < len(nodes):
                fail(f"{path}: animation {i} channel {j} targets missing node")
            if target.get("path") not in {"translation", "rotation", "scale", "weights"}:
                fail(f"{path}: animation {i} channel {j} has invalid target path")
    return len(animations), names

def check_gltf(path: Path) -> tuple[int, list[str], int]:
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"{path}: invalid glTF JSON: {exc}")
    buffers = []
    total = 0
    for i, buf in enumerate(doc.get("buffers", [])):
        uri = buf.get("uri")
        expected = int(buf.get("byteLength", 0))
        if not uri:
            fail(f"{path}: glTF buffer {i} has no URI")
        if uri.startswith("data:"):
            raw, _ = decode_data_uri(uri, f"{path}: buffer {i}")
        else:
            raw = resolve_local(path, uri).read_bytes()
        if len(raw) < expected:
            fail(f"{path}: buffer {i} truncated ({len(raw)} < {expected})")
        buffers.append(raw)
        total += len(raw)
    count, names = validate_document(doc, path, buffers)
    return count, names, total

def check_glb(path: Path) -> tuple[int, list[str], int]:
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF":
        fail(f"{path}: invalid GLB magic/header")
    version, declared = struct.unpack_from("<II", raw, 4)
    if version != 2 or declared != len(raw):
        fail(f"{path}: invalid GLB version/declared length")
    offset, doc, binary = 12, None, b""
    while offset < len(raw):
        if offset + 8 > len(raw):
            fail(f"{path}: truncated chunk header")
        size, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        if size % 4:
            fail(f"{path}: chunk size is not 4-byte aligned")
        if offset + size > len(raw):
            fail(f"{path}: truncated chunk")
        chunk = raw[offset:offset + size]
        if kind == 0x4E4F534A:
            try:
                doc = json.loads(chunk.decode("utf-8").rstrip(" \x00"))
            except Exception as exc:
                fail(f"{path}: invalid GLB JSON chunk: {exc}")
        elif kind == 0x004E4942:
            if binary:
                fail(f"{path}: multiple BIN chunks are unsupported")
            binary = chunk
        offset += size
    if doc is None:
        fail(f"{path}: missing JSON chunk")
    declared_buffers = doc.get("buffers", [])
    if len(declared_buffers) > 1:
        fail(f"{path}: GLB declares multiple buffers")
    if declared_buffers:
        if declared_buffers[0].get("uri"):
            fail(f"{path}: GLB unexpectedly references an external buffer")
        expected = int(declared_buffers[0].get("byteLength", 0))
        if len(binary) < expected:
            fail(f"{path}: BIN chunk shorter than declared buffer")
        buffers = [binary]
    else:
        buffers = []
    count, names = validate_document(doc, path, buffers)
    return count, names, len(binary)

def main() -> None:
    if not CATALOG.is_file():
        fail("assets/monsters/catalog.json missing")
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    monsters = data.get("monsters")
    if not isinstance(monsters, list) or not monsters:
        fail("monster catalog is empty/invalid")
    seen = set()
    for item in monsters:
        rel = item.get("path", "")
        path = (ROOT / rel).resolve()
        if ROOT.resolve() not in path.parents or not path.is_file():
            fail(f"missing/unsafe catalog path: {rel}")
        if rel in seen:
            fail(f"duplicate catalog path: {rel}")
        seen.add(rel)
        if "CC0 1.0" not in str(item.get("license", "")):
            fail(f"{rel}: missing explicit CC0 1.0 license metadata")
        if item.get("licenseUrl") != CC0_URL:
            fail(f"{rel}: missing canonical CC0 license URL")
        if not item.get("source") or not item.get("sourceUrl"):
            fail(f"{rel}: missing source provenance")
        if "CC0" not in str(item.get("licenseEvidence", "")):
            fail(f"{rel}: missing CC0 license evidence")
        if path.suffix.lower() == ".gltf":
            count, names, buffer_bytes = check_gltf(path)
        elif path.suffix.lower() == ".glb":
            count, names, buffer_bytes = check_glb(path)
        else:
            fail(f"unsupported model format: {rel}")
        if count <= 0:
            fail(f"{rel}: model has no animation clips")
        if item.get("animationCount") is not None and int(item["animationCount"]) != count:
            fail(f"{rel}: catalog animationCount {item['animationCount']} != actual {count}")
        catalog_names = item.get("animations")
        if catalog_names and list(catalog_names) != names:
            fail(f"{rel}: catalog animation names differ from the model")
        if item.get("animated") is False:
            fail(f"{rel}: catalog marks an animated model as static")
        print(f"OK {rel}: {count} animations, {buffer_bytes} buffer bytes, CC0 verified")
    print(f"Validated {len(monsters)} CC0 animated monster models.")
if __name__ == "__main__":
    main()
