/* Aetheria monster progression — area-based levels, independent of player level. */
(function(root){
  'use strict';
  const MAX_LEVEL=80;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function depthAt(x,z){
    const d=Number(x),v=Number(z);
    const distance=Math.hypot(Number.isFinite(d)?d:0,Number.isFinite(v)?v:0);
    return clamp(Math.floor(distance/300),0,10);
  }
  function threatAt(stats){
    const hp=Math.max(1,Number(stats&&stats.hp)||1);
    const damage=Math.max(1,Number(stats&&stats.dm)||1);
    return clamp(Math.round((Math.log2(hp*damage)-6)*1.1),0,9);
  }
  const BIOME_BANDS=Object.freeze([[1,12],[12,28],[28,44],[44,62],[62,80]]);
  function levelFor(stats,x,z,tier,biome){
    const depth=depthAt(x,z),band=Number.isInteger(biome)&&BIOME_BANDS[biome]?BIOME_BANDS[biome]:null;
    const areaLevel=band?Math.round(band[0]+(band[1]-band[0])*(depth/10)):1+depth*7;
    const tierBonus=tier==='boss'?12:tier==='champion'?8:tier==='elite'?4:0;
    return clamp(areaLevel+threatAt(stats)+tierBonus,1,MAX_LEVEL);
  }
  function scaleStats(stats,level){
    const lv=clamp(Math.round(Number(level)||1),1,MAX_LEVEL);
    return {
      hp:Math.max(1,Math.round((Number(stats.hp)||1)*1.8*(1+(lv-1)*.045))),
      dm:Math.max(1,Math.round((Number(stats.dm)||1)*(1+(lv-1)*.025))),
      xp:Math.max(1,Math.round((Number(stats.xp)||1)*(1+(lv-1)*.05)))
    };
  }
  root.AetheriaMonsterProgression=Object.freeze({MAX_LEVEL,BIOME_BANDS,depthAt,threatAt,levelFor,scaleStats});
})(typeof window!=='undefined'?window:globalThis);
