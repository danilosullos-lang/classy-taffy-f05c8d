import { db } from './_lib/db.js';
import { fail, methodOnly, readJson, send } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { validateCharacter } from './_lib/character-validation.js';
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
    const character = validateCharacter(await readJson(req, 32768));
    const rows = character.id
      ? await sql`INSERT INTO aetheria_characters
          (id,user_id,slot,name,race,class_id,level,map_id,position,vitals,character_data)
          VALUES (${character.id},${user.id},${character.slot},${character.name},${character.race},${character.classId},${character.level},${character.mapId},${JSON.stringify(character.position)}::jsonb,${JSON.stringify(character.vitals)}::jsonb,${JSON.stringify(character.data)}::jsonb)
          ON CONFLICT (id) DO UPDATE SET slot=EXCLUDED.slot,name=EXCLUDED.name,race=EXCLUDED.race,class_id=EXCLUDED.class_id,level=EXCLUDED.level,map_id=EXCLUDED.map_id,position=EXCLUDED.position,vitals=EXCLUDED.vitals,character_data=EXCLUDED.character_data,revision=aetheria_characters.revision+1,updated_at=NOW()
          WHERE aetheria_characters.user_id=EXCLUDED.user_id
          RETURNING id,slot,name,race,class_id AS "classId",level,map_id AS "mapId",position,vitals,character_data AS data,revision,updated_at AS "updatedAt"`
      : await sql`INSERT INTO aetheria_characters
          (user_id,slot,name,race,class_id,level,map_id,position,vitals,character_data)
          VALUES (${user.id},${character.slot},${character.name},${character.race},${character.classId},${character.level},${character.mapId},${JSON.stringify(character.position)}::jsonb,${JSON.stringify(character.vitals)}::jsonb,${JSON.stringify(character.data)}::jsonb)
          ON CONFLICT (user_id,slot) DO UPDATE SET name=EXCLUDED.name,race=EXCLUDED.race,class_id=EXCLUDED.class_id,level=EXCLUDED.level,map_id=EXCLUDED.map_id,position=EXCLUDED.position,vitals=EXCLUDED.vitals,character_data=EXCLUDED.character_data,revision=aetheria_characters.revision+1,updated_at=NOW()
          RETURNING id,slot,name,race,class_id AS "classId",level,map_id AS "mapId",position,vitals,character_data AS data,revision,updated_at AS "updatedAt"`;
    if(!rows.length)throw Object.assign(new Error('character_not_found'),{status:404});
    return send(res, 200, { character: rows[0] });
  } catch (error) { return fail(res, error); }
}
