'use strict';
const assert=require('node:assert/strict');
require('../assets/combat/death-lifecycle.js');
const D=globalThis.AetheriaDeathLifecycle;
assert.ok(D&&typeof D.resolveFieldRespawn==='function','death lifecycle must be exported');

const inventory=[{id:'sword-1'},{id:'armor-1'}];
const player={hp:0,mp:17,y:8,vy:4,gy:-4,coyote:1,jumpBuf:2,wet:false,bub:0,iframe:0,vz:3,dash:1,lock:true,warn:2,inventory};
const field={x:50,z:60,vx:4,vz:-3,h:8,cy:2,faceT:4,gx:0};
const result=D.resolveFieldRespawn({
  player,field,spawn:{x:0,z:20000},gold:1001,hpMax:500,
  terrainHeight:1.4,groundY:1.4,waterLevel:-.9,goldLossRate:.05,invulnerabilitySeconds:3
});
assert.equal(result.ok,true);
assert.equal(result.gold,951);
assert.equal(result.lost,50);
assert.equal(result.inventoryPreserved,true);
assert.deepEqual(result.spawn,{x:0,z:20000});
assert.equal(player.hp,500);
assert.equal(player.mp,17,'respawn must preserve the current mana amount');
assert.equal(player.y,0);
assert.equal(player.vy,0);
assert.equal(player.gy,1.4);
assert.equal(player.coyote,0);
assert.equal(player.jumpBuf,0);
assert.equal(player.wet,false);
assert.equal(player.bub,3);
assert.equal(player.iframe,3);
assert.equal(player.vz,0);
assert.equal(player.dash,0);
assert.equal(player.lock,false);
assert.equal(player.warn,0);
assert.deepEqual(player.inventory,inventory,'PvE field respawn must preserve equipped and bag items');
assert.deepEqual(field,{x:0,z:20000,vx:0,vz:0,h:0,cy:0,faceT:0,gx:1e9});

const waterPlayer={hp:0};
const waterField={};
const water=D.resolveFieldRespawn({
  player:waterPlayer,field:waterField,spawn:{x:2,z:3},gold:9,hpMax:100,
  terrainHeight:-1.2,groundY:-1.18,waterLevel:-.9
});
assert.equal(water.ok,true);
assert.equal(water.lost,0,'small gold balances must not be rounded into a loss');
assert.equal(waterPlayer.wet,true,'respawn must retain water-state detection');
assert.equal(waterPlayer.bub,3);
assert.equal(waterPlayer.iframe,3);

const clampedGold=D.resolveFieldRespawn({
  player:{},field:{},spawn:{x:0,z:0},gold:25,hpMax:10,
  terrainHeight:0,groundY:0,goldLossRate:4
});
assert.equal(clampedGold.ok,true);
assert.equal(clampedGold.gold,0);
assert.equal(clampedGold.lost,25);

const untouchedPlayer={hp:0,y:9};
const untouchedField={x:4,z:5};
const invalid=D.resolveFieldRespawn({
  player:untouchedPlayer,field:untouchedField,spawn:{x:Infinity,z:0},gold:100,hpMax:100,
  terrainHeight:0,groundY:0
});
assert.equal(invalid.ok,false);
assert.deepEqual(untouchedPlayer,{hp:0,y:9},'invalid respawn must not partially mutate player state');
assert.deepEqual(untouchedField,{x:4,z:5},'invalid respawn must not partially mutate field state');

const invalidGold=D.resolveFieldRespawn({
  player:untouchedPlayer,field:untouchedField,spawn:{x:0,z:0},gold:NaN,hpMax:100,
  terrainHeight:0,groundY:0
});
assert.equal(invalidGold.ok,false);
console.log('Aetheria death lifecycle: safe field respawn, terrain/water state, gold penalty, inventory preservation and invalid-state atomicity passed.');
