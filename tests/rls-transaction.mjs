import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withUserTransaction } from '../api/_lib/rls.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const userId='00000000-0000-4000-8000-000000000001';
let captured=null;
function fakeSql(strings,...values){
  return {text:strings.reduce((out,part,index)=>out+part+(index<values.length?'$'+(index+1):''),''),values};
}
fakeSql.transaction=async queries=>{
  captured=queries;
  return [[{set_config:userId}],[{id:'character-1'}]];
};
const [rows]=await withUserTransaction(fakeSql,userId,[
  fakeSql`SELECT id FROM aetheria_characters WHERE user_id=${userId}`
]);
assert.deepEqual(rows,[{id:'character-1'}]);
assert.equal(captured.length,2);
assert.match(captured[0].text,/set_config\('app\.user_id'/);
assert.deepEqual(captured[0].values,[userId]);
assert.deepEqual(captured[1].values,[userId]);
await assert.rejects(()=>withUserTransaction(fakeSql,'not-a-uuid',[fakeSql`SELECT 1`]),/invalid_user_scope/);
await assert.rejects(()=>withUserTransaction(fakeSql,userId,[]),/database_queries_required/);
await assert.rejects(()=>withUserTransaction({},userId,[{}]),/database_transactions_unavailable/);

const schema=await readFile(path.join(here,'../database/schema.sql'),'utf8');
const migration=await readFile(path.join(here,'../database/migrations/001_character_rls.sql'),'utf8');
for(const sql of [schema,migration]){
  assert.match(sql,/ALTER TABLE aetheria_characters ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/ALTER TABLE aetheria_characters FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/CREATE POLICY aetheria_characters_user_scope/);
  assert.match(sql,/current_setting\('app\.user_id', true\)/);
}
const route=await readFile(path.join(here,'../api/characters.js'),'utf8');
assert.equal((route.match(/withUserTransaction\(sql,\s*user\.id/g)||[]).length,2,
  'GET and PUT character queries must both use the RLS transaction wrapper');
console.log('Aetheria character RLS: transaction scoping, migration policy and API coverage passed.');
