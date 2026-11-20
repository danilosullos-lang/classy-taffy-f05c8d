'use strict';
const assert=require('node:assert/strict');
require('../assets/classes/skill-catalog.js');
const catalog=globalThis.AetheriaSkillCatalog;
assert.ok(catalog,'skill catalog must be exposed for browser and Node');
const roles=['fighter','tank','archer','dagger','mage','healer','support','crafter'];
const slots=['q','e','c','f','g','h','t','v'];
assert.deepEqual(Object.keys(catalog).sort(),roles.slice().sort());
for(const role of roles){
  assert.deepEqual(Object.keys(catalog[role]).sort(),slots.slice().sort(),role+' must define all eight skill slots');
  for(const slot of slots){
    const entry=catalog[role][slot];
    assert.ok(Array.isArray(entry)&&entry.length===3,role+'/'+slot+' must contain icon, name and description');
    assert.ok(entry.every(value=>typeof value==='string'&&value.length>0),role+'/'+slot+' metadata must be non-empty text');
    assert.ok(Object.isFrozen(entry),role+'/'+slot+' entry must be immutable');
  }
  assert.ok(Object.isFrozen(catalog[role]),role+' skill set must be immutable');
}
assert.equal(catalog.fighter.q[1],'Power Strike');
assert.equal(catalog.archer.q[1],'Double Shot');
assert.equal(catalog.mage.q[1],'Prominence');
assert.equal(catalog.tank.e[1],'Shield Stun');
assert.equal(catalog.healer.e[1],'Greater Heal');
assert.equal(catalog.crafter.e[1],'Spoil');
assert.equal(catalog.crafter.c[1],'Sweep');
assert.equal(catalog.crafter.g[1],'Create Item');
assert.equal(catalog.crafter.t[1],'Hard Tanning');
assert.equal(catalog.crafter.v[1],'Treasure Mastery');
assert.ok(Object.isFrozen(catalog),'top-level skill catalog must be immutable');
console.log('Aetheria class skill catalog: 8 roles × 8 slots, preserved names and immutable metadata passed.');
