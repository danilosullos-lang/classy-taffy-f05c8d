import assert from 'node:assert/strict';
import { validateCharacter } from '../api/_lib/character-validation.js';
const valid={slot:0,name:'Aventureiro',race:'human',classId:'guerreiro',level:1,mapId:'talking_island',position:{x:10,y:0,z:20},vitals:{hp:100,mp:50},data:{xp:0},expectedRevision:0};
assert.deepEqual(validateCharacter(valid).position,{x:10,y:0,z:20});
assert.equal(validateCharacter(valid).vitals.hp,100);
assert.equal(validateCharacter(valid).expectedRevision,0);
const existingId='00000000-0000-4000-8000-000000000001';
assert.equal(validateCharacter({...valid,id:existingId,expectedRevision:4}).id,existingId);
assert.equal(validateCharacter({...valid,id:existingId,expectedRevision:4}).expectedRevision,4);
for(const [race,classId] of [['human','mago'],['elf','arqueiro'],['human','cavaleiro'],['dwarf','dwarf_fighter'],['dwarf','crafter']]) {
  assert.equal(validateCharacter({...valid,race,classId}).classId,classId);
}
for(const bad of [
  {...valid,slot:9},{...valid,level:81},{...valid,name:'x'},
  {...valid,position:{x:'NaN',y:0,z:0}},{...valid,vitals:{hp:'NaN',mp:1}},
  {...valid,race:'dwarf',classId:'mago'},{...valid,race:'human',classId:'crafter'},
  {...valid,mapId:'../../admin'},{...valid,expectedRevision:-1},
  {...valid,expectedRevision:1.5},{...valid,expectedRevision:2147483647},
  {...valid,id:'not-a-uuid',expectedRevision:1},{...valid,id:existingId,expectedRevision:0},
  {...valid,expectedRevision:1}
]) assert.throws(()=>validateCharacter(bad));
assert.throws(()=>validateCharacter({...valid,data:{payload:'x'.repeat(25000)}}),e=>e.status===413);
console.log('Aetheria character validation: revision preconditions and input checks passed.');
