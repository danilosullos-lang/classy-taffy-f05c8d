const RACES = new Set(['human','elf','dark_elf','darkelf','orc','dwarf']);
const CLASSES = new Set(['novice','fighter','guerreiro','warrior','mago','mage','mystic','arquimago','arqueiro','archer','ranger','ladino','rogue','assassino','assassin','dagger','tanque','tank','cavaleiro','knight','paladino','paladin','templario','templar','sacerdote','priest','healer','sumo','support','anão','anao','dwarf','dwarf_fighter','crafter']);
const safeName = value => typeof value === 'string' && /^[\p{L}\p{N}_ -]{3,20}$/u.test(value.trim());
const invalid = (message,status=400) => Object.assign(new Error(message),{status});
export function validateCharacter(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('invalid_character');
  if (!safeName(input.name) || !RACES.has(input.race) || !CLASSES.has(input.classId)) throw invalid('invalid_character_identity');
  if(input.race==='dwarf'&&!['anão','anao','dwarf','dwarf_fighter','novice','fighter','guerreiro','crafter'].includes(input.classId))throw invalid('class_not_available_for_race');
  const level = Number(input.level ?? 1);
  if (!Number.isInteger(level) || level < 1 || level > 80) throw invalid('invalid_level');
  const slot = Number(input.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > 5) throw invalid('invalid_slot');
  const point = input.position || {};
  const position = { x: Number(point.x ?? 0), y: Number(point.y ?? 0), z: Number(point.z ?? 0) };
  if (![position.x,position.y,position.z].every(v=>Number.isFinite(v)&&Math.abs(v)<=1000000)) throw invalid('invalid_position');
  const vitals = input.vitals || {};
  const hpValue=Number(vitals.hp ?? 100), mpValue=Number(vitals.mp ?? 50);
  if(!Number.isFinite(hpValue)||!Number.isFinite(mpValue)||hpValue<0||mpValue<0)throw invalid('invalid_vitals');
  const hp=Math.min(1000000,Math.floor(hpValue)),mp=Math.min(1000000,Math.floor(mpValue));
  const mapId = String(input.mapId || 'talking_island');
  if (!/^[a-z0-9_-]{2,64}$/.test(mapId)) throw invalid('invalid_map');
  const data = input.data && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data : {};
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 24000) throw invalid('character_data_too_large',413);
  return { id: typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null,
    slot, name: input.name.trim(), race: input.race, classId: input.classId, level,
    mapId, position, vitals: { hp, mp }, data };
}
