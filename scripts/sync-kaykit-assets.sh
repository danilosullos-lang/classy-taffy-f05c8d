#!/usr/bin/env bash
set -euo pipefail

# Rebuild the playable KayKit models from the creator's public CC0 repository
# and import only the free Rig_Medium animation sets used by these characters.
KAYKIT_BASE="https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf"
ANIMATION_BASE="https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-characters/main/assets/kaykit/character-animations-1.1/Animations/gltf/Rig_Medium"
mkdir -p skins/classes assets/animations/kaykit/rig-medium

fetch() {
  local url="$1" path="$2"
  curl --fail --location --retry 4 --retry-all-errors --connect-timeout 20 "$url" -o "$path"
  test -s "$path"
  python - "$path" <<'PY'
import pathlib, sys
p=pathlib.Path(sys.argv[1])
data=p.read_bytes()
if len(data)<1024 or data[:4] != b'glTF':
    raise SystemExit(f"Arquivo GLB inválido ou incompleto: {p} ({len(data)} bytes)")
PY
}

for model in Barbarian Knight Mage Rogue_Hooded; do
  fetch "$KAYKIT_BASE/$model.glb" "skins/classes/$model.glb"
done

declare -A sets=(
  [General]=general
  [MovementBasic]=movement-basic
  [MovementAdvanced]=movement-advanced
  [CombatMelee]=combat-melee
  [CombatRanged]=combat-ranged
  [Simulation]=simulation
  [Special]=special
  [Tools]=tools
)
for name in "${!sets[@]}"; do
  fetch "$ANIMATION_BASE/Rig_Medium_$name.glb" "assets/animations/kaykit/rig-medium/${sets[$name]}.glb"
done

# These are web-served GLBs, not Git LFS pointer files.
if ! grep -qF 'assets/animations/kaykit/**/*.glb -filter -diff -merge -text' .gitattributes; then
  printf '\n# KayKit CC0 Rig_Medium animation clips are served directly to Three.js.\nassets/animations/kaykit/**/*.glb -filter -diff -merge -text\n' >> .gitattributes
fi

python scripts/validate-kaykit-assets.py

git add .gitattributes skins/classes/Barbarian.glb skins/classes/Knight.glb skins/classes/Mage.glb skins/classes/Rogue_Hooded.glb assets/animations/kaykit
if ! git diff --cached --quiet; then
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git commit -m "Import compact KayKit CC0 skins and class animations"
  git push
fi
