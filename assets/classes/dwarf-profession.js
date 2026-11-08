/*!
 * Aetheria RPG — Dwarven profession rules
 * Original Aetheria gameplay code. No Lineage II client data or proprietary assets.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AetheriaDwarfProfession=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const MATERIALS=Object.freeze([
    {id:'iron_ore',name:'Minério de ferro',icon:'⛏️'},
    {id:'rough_hide',name:'Couro bruto',icon:'🦬'},
    {id:'hardwood',name:'Madeira nobre',icon:'🪵'},
    {id:'monster_essence',name:'Essência monstruosa',icon:'🔹'},
    {id:'arcane_crystal',name:'Cristal arcano',icon:'💎'}
  ]);
  const RECIPES=Object.freeze([
    {id:'dwarven_hammer',name:'Martelo de Forja',icon:'🔨',slot:0,grade:1,gold:60,materials:{iron_ore:6,hardwood:3,rough_hide:1}},
    {id:'reinforced_boots',name:'Botas Reforçadas',icon:'🥾',slot:2,grade:1,gold:35,materials:{rough_hide:5,iron_ore:2}},
    {id:'artisan_helm',name:'Elmo do Artífice',icon:'🪖',slot:1,grade:2,gold:110,materials:{iron_ore:10,rough_hide:4,arcane_crystal:2}},
    {id:'rune_amulet',name:'Amuleto Rúnico',icon:'📿',slot:3,grade:2,gold:90,materials:{arcane_crystal:3,monster_essence:4,hardwood:1}}
  ]);
  const MATERIAL_IDS=MATERIALS.map(x=>x.id);
  const clampInt=(value,max=999999)=>{
    const n=Number(value);
    return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
  };
  function normalizeMaterials(source){
    const out={};
    for(const id of MATERIAL_IDS)out[id]=clampInt(source&&source[id]);
    return out;
  }
  function spoil(enemy,nowMs,durationMs=15000){
    if(!enemy||enemy.dead||enemy.rpgSpoiled||!Number.isFinite(nowMs)||!Number.isFinite(durationMs)||durationMs<=0)return false;
    enemy.rpgSpoiled=true;
    enemy.rpgSpoiledAt=nowMs;
    enemy.rpgSpoiledUntil=nowMs+Math.min(30000,durationMs);
    return true;
  }
  function sweep(enemy,nowMs,random=Math.random){
    if(!enemy||!enemy.dead||!enemy.rpgSpoiled||enemy.rpgSwept||!Number.isFinite(nowMs)||
       !Number.isFinite(enemy.rpgSpoiledUntil)||enemy.rpgSpoiledUntil<nowMs)return null;
    enemy.rpgSwept=true;
    const level=clampInt(enemy.level||1,80)||1;
    const tier=Math.max(1,Math.min(6,1+Math.floor((level-1)/14)));
    const rareRoll=typeof random==='function'?Number(random()):1;
    return {
      iron_ore:1+Math.floor((tier-1)/2),
      rough_hide:1+(level>=20?1:0),
      hardwood:1,
      monster_essence:Math.max(1,Math.floor(level/20)+1),
      arcane_crystal:rareRoll<Math.min(.35,.08+level/500)?1:0
    };
  }
  function canCraft(recipeId,materials,gold){
    const recipe=RECIPES.find(x=>x.id===recipeId);
    if(!recipe)return {ok:false,reason:'receita_inexistente'};
    const stock=normalizeMaterials(materials);
    if(clampInt(gold)<recipe.gold)return {ok:false,reason:'ouro_insuficiente',recipe};
    for(const [id,amount] of Object.entries(recipe.materials)){
      if(stock[id]<amount)return {ok:false,reason:'materiais_insuficientes',material:id,required:amount,available:stock[id],recipe};
    }
    return {ok:true,recipe};
  }
  function craft(recipeId,materials,gold){
    const check=canCraft(recipeId,materials,gold);
    if(!check.ok)return check;
    const next=normalizeMaterials(materials);
    for(const [id,amount] of Object.entries(check.recipe.materials))next[id]-=amount;
    return {
      ok:true,
      materials:next,
      gold:clampInt(gold)-check.recipe.gold,
      item:{slot:check.recipe.slot,grade:check.recipe.grade,name:check.recipe.name,recipeId:check.recipe.id}
    };
  }
  return Object.freeze({MATERIALS,RECIPES,normalizeMaterials,spoil,sweep,canCraft,craft});
});
