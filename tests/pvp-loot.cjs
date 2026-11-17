'use strict';
const assert=require('node:assert/strict');
const Loot=require('../assets/combat/pvp-loot.js');
assert.ok(Loot&&typeof Loot.preparePvpDrop==='function');
assert.equal(Loot.MAX_DROP_ITEMS,3);

const normalInventory=[
  {u:1,s:0,r:1,lock:false},
  {u:2,s:1,r:1,lock:false},
  {u:3,s:2,r:5,lock:true}
];
const normalEquipment={0:1};
const normal=Loot.preparePvpDrop(normalInventory,normalEquipment,{random:()=>0});
assert.equal(normal.ok,true);
assert.deepEqual(normal.items.map(item=>item.u),[2],'normal PvP death prefers an unequipped item');
assert.deepEqual(normal.inventory.map(item=>item.u),[1,3]);
assert.deepEqual(normal.equipment,{0:1});
assert.deepEqual(normalEquipment,{0:1},'input equipment must not be mutated');
assert.equal(normalInventory.length,3,'input inventory must not be mutated');

const equippedOnly=Loot.preparePvpDrop(
  [{u:10,s:0,r:1},{u:11,s:1,r:1}],
  {0:10,1:11},
  {random:()=>.75}
);
assert.equal(equippedOnly.ok,true);
assert.deepEqual(equippedOnly.items.map(item=>item.u),[11]);
assert.deepEqual(equippedOnly.inventory.map(item=>item.u),[10]);
assert.deepEqual(equippedOnly.equipment,{0:10});
assert.deepEqual(equippedOnly.removedEquipmentSlots,['1'],'a dropped equipped item must be unequipped immediately');

const redInventory=[
  {u:20,s:0,r:1,lock:false},
  {u:21,s:1,r:3,lock:false},
  {u:22,s:2,r:2,lock:true},
  {u:23,s:3,r:4,lock:false}
];
const red=Loot.preparePvpDrop(redInventory,{0:21,1:23},{red:true,random:(()=>{const values=[0,.1,.9];let i=0;return()=>values[i++]??.9})()});
assert.equal(red.ok,true);
assert.deepEqual(red.items.map(item=>item.u),[20,21],'PK victim may drop one normal item and eligible rare extras');
assert.deepEqual(red.inventory.map(item=>item.u),[22,23]);
assert.deepEqual(red.equipment,{1:23});
assert.deepEqual(red.removedEquipmentSlots,['0']);
assert.equal(red.items.some(item=>item.u===22),false,'locked items must never drop');

const capped=Loot.preparePvpDrop(
  [{u:30,r:1},{u:31,r:5},{u:32,r:4},{u:33,r:3},{u:34,r:2}],
  {},
  {red:true,random:()=>0}
);
assert.equal(capped.ok,true);
assert.equal(capped.items.length,3,'a single death may drop no more than three items');

const locked=Loot.preparePvpDrop([{u:40,r:5,lock:true}],{0:40},{red:true,random:()=>0});
assert.equal(locked.ok,true);
assert.deepEqual(locked.items,[]);
assert.deepEqual(locked.inventory,[{u:40,r:5,lock:true}]);
assert.deepEqual(locked.equipment,{0:40});

const originalInventory=[{u:50,r:1},{u:50,r:3}];
const originalEquipment={0:50};
const duplicate=Loot.preparePvpDrop(originalInventory,originalEquipment,{random:()=>0});
assert.equal(duplicate.ok,false);
assert.equal(duplicate.reason,'duplicate_item_id');
assert.equal(originalInventory.length,2);
assert.deepEqual(originalEquipment,{0:50});

const invalidRandom=Loot.preparePvpDrop([{u:60,r:1}],{}, {random:()=>1});
assert.equal(invalidRandom.ok,false);
assert.equal(invalidRandom.reason,'invalid_random');
assert.equal(Loot.preparePvpDrop(null,{}).reason,'invalid_state');
assert.equal(Loot.preparePvpDrop([],[]).reason,'invalid_state');

console.log('Aetheria PvP loot: selection, PK bonus, locked items, equipment cleanup, drop cap and atomic invalid-state handling passed.');
