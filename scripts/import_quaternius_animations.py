#!/usr/bin/env python3
"""Download the free CC0 Standard GLB editions of Quaternius UAL1 and UAL2."""
from __future__ import annotations
import hashlib, io, json, pathlib, re, time, urllib.request, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "animations" / "quaternius"
PACKS = [
    {"id":"ual1","name":"Universal Animation Library Standard","game":"universal-animation-library","upload_id":"17958403",
     "sha256":"cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724",
     "source":"https://quaternius.itch.io/universal-animation-library"},
    {"id":"ual2","name":"Universal Animation Library 2 Standard","game":"universal-animation-library-2","upload_id":"17958478",
     "sha256":"4008ea208a604773a2b2177d965f0f5d3195498b5bf838c3f5785d68e95f2a68",
     "source":"https://quaternius.itch.io/universal-animation-library-2"},
]
MAX_ZIP = 64 * 1024 * 1024
MAX_GLB = 48 * 1024 * 1024

def request(url, method="GET", data=None):
    req=urllib.request.Request(url,data=data,method=method,headers={
        "User-Agent":"SuperHeroRPG-CC0-AssetImporter/1.0",
        "Accept":"application/json, application/octet-stream, */*",
        "Origin":"https://itch.io",
        "Referer":"https://itch.io/",
    })
    with urllib.request.urlopen(req,timeout=120) as response:
        return response.read()

def glb_info(raw):
    if len(raw)<20 or raw[:4]!=b"glTF" or int.from_bytes(raw[4:8],"little")!=2:
        raise ValueError("invalid GLB v2")
    total=int.from_bytes(raw[8:12],"little")
    if total!=len(raw): raise ValueError("GLB length header mismatch")
    chunk_len=int.from_bytes(raw[12:16],"little")
    chunk_type=int.from_bytes(raw[16:20],"little")
    if chunk_type!=0x4E4F534A or 20+chunk_len>len(raw): raise ValueError("missing GLB JSON chunk")
    doc=json.loads(raw[20:20+chunk_len].decode("utf-8").rstrip(" \t\r\n\0"))
    animations=doc.get("animations",[])
    return {"animations":[a.get("name") or f"animation_{i+1}" for i,a in enumerate(animations)],
            "animationCount":len(animations),"nodes":len(doc.get("nodes",[])),
            "skins":len(doc.get("skins",[])),"meshes":len(doc.get("meshes",[]))}

def main():
    DEST.mkdir(parents=True,exist_ok=True)
    expected=[
        DEST/"ual1"/"UAL1_Standard.glb",
        DEST/"ual1"/"UAL1_Standard_RM.glb",
        DEST/"ual2"/"Mannequin_F.glb",
        DEST/"ual2"/"UAL2_Standard.glb",
        DEST/"ual2"/"UAL2_Standard_RM.glb",
    ]
    def is_real_glb(path):
        try:
            raw=path.read_bytes()
            return len(raw)>=20 and raw[:4]==b"glTF" and int.from_bytes(raw[4:8],"little")==2 and int.from_bytes(raw[8:12],"little")==len(raw)
        except OSError:
            return False
    if all(is_real_glb(path) for path in expected):
        print("Quaternius UAL assets already exist as valid GLB binaries; download skipped.")
        return
    manifest={"source":"Quaternius","license":"CC0-1.0","licenseUrl":"https://creativecommons.org/publicdomain/zero/1.0/",
              "importedAt":time.strftime("%Y-%m-%d",time.gmtime()),"packs":[],"files":[]}
    for pack in PACKS:
        endpoint=f"https://quaternius.itch.io/{pack['game']}/file/{pack['upload_id']}?source=game_download&as_props=1"
        payload=request(endpoint,method="POST",data=b"")
        data=json.loads(payload.decode("utf-8"))
        signed=data.get("url")
        if not signed: raise RuntimeError(f"itch.io did not return a signed URL for {pack['id']}")
        archive=request(signed)
        if not archive or len(archive)>MAX_ZIP: raise RuntimeError(f"Invalid archive size for {pack['id']}")
        digest=hashlib.sha256(archive).hexdigest()
        if digest!=pack["sha256"]: raise RuntimeError(f"SHA-256 mismatch for {pack['id']}: {digest}")
        folder=DEST/pack["id"]; folder.mkdir(parents=True,exist_ok=True)
        imported=[]
        with zipfile.ZipFile(io.BytesIO(archive)) as z:
            candidates=[n for n in z.namelist() if n.lower().endswith(".glb") and not n.endswith("/")]
            candidates=[n for n in candidates if "unreal-godot" in n.lower() or "glb" in pathlib.PurePosixPath(n).name.lower()]
            for name in candidates:
                info=z.getinfo(name)
                if info.file_size<=0 or info.file_size>MAX_GLB: continue
                raw=z.read(info)
                details=glb_info(raw)
                safe=pathlib.Path(name).name
                safe=re.sub(r"[^A-Za-z0-9_.-]+","_",safe)
                target=folder/safe
                target.write_bytes(raw)
                record={"pack":pack["id"],"file":target.relative_to(ROOT).as_posix(),
                        "bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"sourcePath":name,**details}
                imported.append(record)
        if not imported: raise RuntimeError(f"No valid GLB files found in {pack['id']}")
        manifest["packs"].append({k:pack[k] for k in ("id","name","source","sha256")}|{"files":len(imported),"animations":sum(x["animationCount"] for x in imported)})
        manifest["files"].extend(imported)
        print(f"{pack['id']}: {len(imported)} GLB files, {sum(x['animationCount'] for x in imported)} animation entries")
    (DEST/"manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(f"Imported {len(manifest['files'])} verified GLB animation assets.")

if __name__=="__main__": main()
