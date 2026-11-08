'use strict';
const assert=require('node:assert/strict');
const Dwarf=require('../assets/classes/dwarf-profession.js');

assert.equal(Dwarf.MATERIALS.length,5);
assert.equal(Dwarf.RECIPES.length,4);
assert.deepEqual(Dwarf.normalizeMaterials({iron_ore:'8',rough_hide:-2,unknown:999}),{
  iron_ore:8,rough_hide:0,hardwood:0,monster_essence:0,arcane_crystal:0
});

const living={level:28,hp:100};
assert.equal(Dwarf.spoil(living,1000,15000),true);
assert.equal(Dwarf.spoil(living,1001,15000),false);
living.dead=true;
const loot=Dwarf.sweep(living,2000,()=>0);
assert.deepEqual(loot,{iron_ore:1,rough_hide:2,hardwood:1,monster_essence:2,arcane_crystal:1});
assert.equal(Dwarf.sweep(living,2001,()=>0),null,'a corpse can only be swept once');

const notSpoiled={dead:true,level:10};
assert.equal(Dwarf.sweep(notSpoiled,1000,()=>0),null);
const expired={dead:true,level:10};
Dwarf.spoil(expired,1000,100);
assert.equal(Dwarf.sweep(expired,1101,()=>0),null);

const poor=Dwarf.craft('dwarven_hammer',{iron_ore:6,hardwood:3,rough_hide:1},59);
assert.equal(poor.ok,false);
assert.equal(poor.reason,'ouro_insuficiente');
const insufficient=Dwarf.craft('dwarven_hammer',{iron_ore:5,hardwood:3,rough_hide:1},100);
assert.equal(insufficient.ok,false);
assert.equal(insufficient.reason,'materiais_insuficientes');
const crafted=Dwarf.craft('dwarven_hammer',{iron_ore:8,hardwood:4,rough_hide:2},100);
assert.equal(crafted.ok,true);
assert.deepEqual(crafted.item,{slot:0,grade:1,name:'Martelo de Forja',recipeId:'dwarven_hammer'});
assert.deepEqual(crafted.materials,{iron_ore:2,rough_hide:1,hardwood:1,monster_essence:0,arcane_crystal:0});
assert.equal(crafted.gold,40);
assert.equal(Dwarf.craft('not-a-recipe',{},100).reason,'receita_inexistente');
console.log('Dwarven profession: spoil, sweep, materials and crafting passed.');
