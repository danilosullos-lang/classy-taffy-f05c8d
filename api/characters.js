import { db } from './_lib/db.js';
import { fail, methodOnly, readJson, send } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { validateCharacter } from './_lib/character-validation.js';
import { withUserTransaction } from './_lib/rls.js';

export default async function handler(req, res) {
  if (!methodOnly(req, res, ['GET','PUT'])) return;
  try {
    const user = await requireUser(req);
    const sql = db();
    if (req.method === 'GET') {
      const [rows] = await withUserTransaction(sql,user.id,[
        sql`SELECT id, slot, name, race, class_id AS "classId", level,
          map_id AS "mapId", position, vitals, character_data AS data,
          revision, updated_at AS "updatedAt"
          FROM aetheria_characters
          WHERE user_id = ${user.id}
          ORDER BY slot ASC`
      ]);
      return send(res, 200, { characters: rows });
    }

    const character = validateCharacter(await readJson(req, 32768));
    const statement = character.id
      ? sql`UPDATE aetheria_characters
          SET slot=${character.slot},name=${character.name},race=${character.race},
            class_id=${character.classId},level=${character.level},map_id=${character.mapId},
            position=${JSON.stringify(character.position)}::jsonb,
            vitals=${JSON.stringify(character.vitals)}::jsonb,
            character_data=${JSON.stringify(character.data)}::jsonb,
            revision=revision+1,updated_at=NOW()
          WHERE id=${character.id} AND user_id=${user.id}
            AND revision=${character.expectedRevision}
          RETURNING id,slot,name,race,class_id AS "classId",level,map_id AS "mapId",
            position,vitals,character_data AS data,revision,updated_at AS "updatedAt"`
      : sql`INSERT INTO aetheria_characters
          (user_id,slot,name,race,class_id,level,map_id,position,vitals,character_data)
          VALUES (${user.id},${character.slot},${character.name},${character.race},
            ${character.classId},${character.level},${character.mapId},
            ${JSON.stringify(character.position)}::jsonb,${JSON.stringify(character.vitals)}::jsonb,
            ${JSON.stringify(character.data)}::jsonb)
          ON CONFLICT (user_id,slot) DO NOTHING
          RETURNING id,slot,name,race,class_id AS "classId",level,map_id AS "mapId",
            position,vitals,character_data AS data,revision,updated_at AS "updatedAt"`;
    const [rows] = await withUserTransaction(sql,user.id,[statement]);
    if (!rows.length) throw Object.assign(new Error('character_revision_conflict'),{status:409});
    return send(res, 200, { character: rows[0] });
  } catch (error) { return fail(res, error); }
}
