/*!
 * Aetheria RPG — deterministic monster aggro, leash and return state.
 * Original Aetheria gameplay code. No proprietary client data or assets.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AetheriaMonsterAI=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const finite=value=>Number.isFinite(Number(value));
  const distance=(ax,az,bx,bz)=>Math.hypot(bx-ax,bz-az);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function update(entity,player,nowMs,options={}){
    if(!entity||!finite(entity.d)||!finite(entity.z)||!player||
       !finite(player.x)||!finite(player.z)||!finite(nowMs)){
      return {mode:'idle',target:null,distance:Infinity,homeDistance:Infinity,aggro:false};
    }
    const homeD=finite(entity.homeD)?Number(entity.homeD):Number(entity.d);
    const homeZ=finite(entity.homeZ)?Number(entity.homeZ):Number(entity.z);
    if(entity.dead){
      entity.aiMode='dead';
      return {mode:'dead',target:{x:homeD,z:homeZ},distance:distance(entity.d,entity.z,player.x,player.z),
        homeDistance:distance(entity.d,entity.z,homeD,homeZ),aggro:false};
    }
    const aggroRadius=clamp(Number(options.aggroRadius)||20,1,80);
    const loseRadius=clamp(Number(options.loseRadius)||30,aggroRadius,100);
    const leashRadius=clamp(Number(options.leashRadius)||48,aggroRadius,120);
    const returnRadius=clamp(Number(options.returnRadius)||1.25,.25,8);
    const loseAggroMs=clamp(Number(options.loseAggroMs)||1800,250,10000);
    const attackRange=clamp(Number(options.attackRange)||Number(entity.r)||2,.5,20);
    const playerDistance=distance(entity.d,entity.z,player.x,player.z);
    const homeDistance=distance(entity.d,entity.z,homeD,homeZ);
    let mode=['idle','chase','attack','return'].includes(entity.aiMode)?entity.aiMode:'idle';
    let lastSeen=finite(entity.aiLastSeenAt)?Number(entity.aiLastSeenAt):Number(nowMs);

    // Leash takes priority: a mob cannot be dragged indefinitely from its spawn.
    if(mode!=='return'&&homeDistance>leashRadius){
      mode='return';
      lastSeen=0;
    }else if(mode==='return'){
      if(playerDistance<=aggroRadius&&homeDistance>returnRadius&&homeDistance<=leashRadius){
        mode='chase';
        lastSeen=Number(nowMs);
      }else if(homeDistance<=returnRadius){
        mode='idle';
      }
    }

    if(mode==='idle'&&playerDistance<=aggroRadius){
      mode=playerDistance<=attackRange?'attack':'chase';
      lastSeen=Number(nowMs);
    }
    if(mode==='chase'||mode==='attack'){
      if(playerDistance<=loseRadius)lastSeen=Number(nowMs);
      else if(Number(nowMs)-lastSeen>=loseAggroMs)mode='return';
      if(mode==='chase'&&playerDistance<=attackRange)mode='attack';
      else if(mode==='attack'&&playerDistance>attackRange)mode='chase';
    }
    if(mode==='return'&&homeDistance<=returnRadius)mode='idle';

    entity.aiMode=mode;
    entity.aiLastSeenAt=lastSeen;
    const target=mode==='chase'||mode==='attack'
      ?{x:Number(player.x),z:Number(player.z)}
      :{x:homeD,z:homeZ};
    return {mode,target,distance:playerDistance,homeDistance,
      aggro:mode==='chase'||mode==='attack'};
  }
  function reset(entity,home){
    if(!entity)return false;
    const d=home&&finite(home.x)?Number(home.x):(finite(entity.homeD)?Number(entity.homeD):Number(entity.d));
    const z=home&&finite(home.z)?Number(home.z):(finite(entity.homeZ)?Number(entity.homeZ):Number(entity.z));
    if(!finite(d)||!finite(z))return false;
    entity.homeD=d;entity.homeZ=z;entity.aiMode='idle';entity.aiLastSeenAt=0;
    return true;
  }
  return Object.freeze({update,reset});
});
