/* Aetheria field-death and respawn lifecycle.
 * Keeps the existing 5% field gold penalty and preserves inventory/character progress.
 * This is a client-side gameplay helper, not an authoritative server anti-cheat boundary.
 */
(function(root){
  'use strict';
  function finite(value){return Number.isFinite(Number(value))}
  function resolveFieldRespawn(params){
    params=params||{};
    const player=params.player,field=params.field,spawn=params.spawn;
    if(!player||typeof player!=='object'||!field||typeof field!=='object'||!spawn||typeof spawn!=='object')
      return {ok:false,reason:'invalid_state'};
    const x=Number(spawn.x),z=Number(spawn.z),hp=Number(params.hpMax);
    const terrainHeight=Number(params.terrainHeight),groundY=Number(params.groundY);
    const waterLevel=Number(params.waterLevel===undefined?-.9:params.waterLevel);
    const gold=Number(params.gold),rate=Number(params.goldLossRate===undefined?.05:params.goldLossRate);
    const invulnerability=Number(params.invulnerabilitySeconds===undefined?3:params.invulnerabilitySeconds);
    if(![x,z,hp,terrainHeight,groundY,waterLevel,gold,rate,invulnerability].every(Number.isFinite)||
       hp<=0||gold<0||invulnerability<0||invulnerability>60)
      return {ok:false,reason:'invalid_values'};
    const safeGold=Math.max(0,Math.floor(gold));
    const lossRate=Math.max(0,Math.min(1,rate));
    const lost=Math.min(safeGold,Math.floor(safeGold*lossRate));
    const remainingGold=safeGold-lost;

    /* All inputs are validated before mutating either state object. */
    field.x=x;field.z=z;field.vx=0;field.vz=0;field.h=0;field.cy=0;
    field.faceT=0;field.gx=1e9;
    player.hp=hp;player.y=0;player.vy=0;player.gy=groundY;
    player.coyote=0;player.jumpBuf=0;player.wet=terrainHeight<waterLevel+.15;
    player.bub=invulnerability;player.iframe=invulnerability;
    player.vz=0;player.dash=0;player.lock=false;player.warn=0;

    return {
      ok:true,gold:remainingGold,lost,inventoryPreserved:true,
      spawn:{x:x,z:z},invulnerabilitySeconds:invulnerability
    };
  }
  root.AetheriaDeathLifecycle=Object.freeze({resolveFieldRespawn:resolveFieldRespawn});
})(typeof window!=='undefined'?window:globalThis);
