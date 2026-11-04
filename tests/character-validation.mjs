import assert from 'node:assert/strict';
import { validateCharacter } from '../api/_lib/character-validation.js';
const valid={slot:0,name:'Aventureiro',race:'human',classId:'guerreiro',level:1,mapId:'talking_island',position:{x:10,y:0,z:20},vitals:{hp:100,mp:50},data:{xp:0}};
assert.deepEqual(validateCharacter(valid).position,{x:10,y:0,z:20});
assert.equal(validateCharacter(valid).vitals.hp,100);
for(const bad of [
 {...valid,slot:9},{...valid,level:81},{...valid,name:'x'},
 {...valid,position:{x:'NaN',y:0,z:0}},{...valid,vitals:{hp:'NaN',mp:1}},
 {...valid,race:'dwarf',classId:'mago'},{...valid,mapId:'../../admin'}
]) assert.throws(()=>validateCharacter(bad));
assert.throws(()=>validateCharacter({...valid,data:{payload:'x'.repeat(25000)}}),e=>e.status===413);
console.log('Aetheria character validation: all tests passed.');
