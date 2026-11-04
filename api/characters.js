import { db } from './_lib/db.js';
import { fail, methodOnly, readJson, send } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
const RACES = new Set(['human','elf','dark_elf','orc','dwarf']);
const CLASSES = new Set(['novice','guerreiro','mago','arqueiro','tanque','anão','dwarf_fighter']);
const safeName = value => typeof value === 'string' && /^[\p{L}\p{N}_ -]{3,20}$/u.test(value.trim());
function validateCharacter(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('invalid_character'), { status: 400 });
  if (!safeName(input.name) || !RACES.has(input.race) || !CLASSES.has(input.classId)) throw Object.assign(new Error('invalid_character_identity'), { status: 400 });
  const level = Number(input.level || 1);
  if (!Number.isInteger(level) || level < 1 || level > 80) throw Object.assign(new Error('invalid_level'), { status: 400 });
  const slot = Number(input.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > 5) throw Object.assign(new Error('invalid_slot'), { status: 400 });
  const point = input.position || {};
  const finite = v => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 1000000;
  const position = { x: Number(point.x || 0), y: Number(point.y || 0), z: Number(point.z || 0) };
  if (![position.x,position.y,position.z].every(finite)) throw Object.assign(new Error('invalid_position'), { status: 400 });
  const vitals = input.vitals || {};
  const hp = Math.max(0, Math.min(1000000, Math.floor(Number(vitals.hp ?? 100))));
  const mp = Math.max(0, Math.min(1000000, Math.floor(Number(vitals.mp ?? 50))));
  const mapId = String(input.mapId || 'talking_island');
  if (!/^[a-z0-9_-]{2,64}$/.test(mapId)) throw Object.assign(new Error('invalid_map'), { status: 400 });
  const data = input.data && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data : {};
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 24000) throw Object.assign(new Error('character_data_too_large'), { status: 413 });
  return { id: typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null,
    slot, name: input.name.trim(), race: input.race, classId: input.classId, level,
    mapId, position, vitals: { hp, mp }, data };
}
export default async function handler(req, res) {
  if (!methodOnly(req, res, ['GET','PUT'])) return;
  try {
    const user = await requireUser(req);
    const sql = db();
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, slot, name, race, class_id AS "classId", level,
        map_id AS "mapId", position, vitals, character_data AS data,
        revision, updated_at AS "updatedAt"
        FROM aetheria_characters WHERE user_id = ${user.id} ORDER BY slot ASC`;
      return send(res, 200, { characters: rows });
    }
    const body = await readJson(req, 32768);
    const character = validateCharacter(body);
    const rows = character.id
      ? await sql`INSERT INTO aetheria_characters
          (id,user_id,slot,name,race,class_id,level,map_id,position,vitals,character_data)
          VALUES (${character.id},${user.id},${character.slot},${character.name},${character.race},${character.classId},${character.level},${character.mapId},${JSON.stringify(character.position)}::jsonb,${JSON.stringify(character.vitals)}::jsonb,${JSON.stringify(character.data)}::jsonb)
          ON CONFLICT (id,user_id) DO UPDATE SET slot=EXCLUDED.slot,name=EXCLUDED.name,race=EXCLUDED.race,class_id=EXCLUDED.class_id,level=EXCLUDED.level,map_id=EXCLUDED.map_id,position=EXCLUDED.position,vitals=EXCLUDED.vitals,character_data=EXCLUDED.character_data,revision=aetheria_characters.revision+1,updated_at=NOW()
          RETURNING id,slot,name,race,class_id AS "classId",level,map_id AS "mapId",position,vitals,character_data AS data,revision,updated_at AS "updatedAt"`
      : await sql`INSERT INTO aetheria_characters
          (user_id,slot,name,race,class_id,level,map_id,position,vitals,character_data)
          VALUES (${user.id},${character.slot},${character.name},${character.race},${character.classId},${character.level},${character.mapId},${JSON.stringify(character.position)}::jsonb,${JSON.stringify(character.vitals)}::jsonb,${JSON.stringify(character.data)}::jsonb)
          ON CONFLICT (user_id,slot) DO UPDATE SET name=EXCLUDED.name,race=EXCLUDED.race,class_id=EXCLUDED.class_id,level=EXCLUDED.level,map_id=EXCLUDED.map_id,position=EXCLUDED.position,vitals=EXCLUDED.vitals,character_data=EXCLUDED.character_data,revision=aetheria_characters.revision+1,updated_at=NOW()
          RETURNING id,slot,name,race,class_id AS "classId",level,map_id AS "mapId",position,vitals,character_data AS data,revision,updated_at AS "updatedAt"`;
    return send(res, 200, { character: rows[0] });
  } catch (error) { return fail(res, error); }
}
