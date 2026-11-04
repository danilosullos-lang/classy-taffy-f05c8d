/*!
 * Aetheria Combat Core — adapted from NJ MMO / @tech-leads-club/nj-mmo
 * Original combat math: Copyright (c) 2026 Waldemar Neto
 * Source project license: MIT. See THIRD_PARTY_NOTICES.md.
 * Adaptation keeps the published melee, physical-skill, magic, critical,
 * attack-timing, range, cast-interruption and PvP-rule mechanics.
 */
(function(root){
  'use strict';
  const MELEE_WEAPON_MODIFIER=77;
  const MAGIC_DAMAGE_CONSTANT=91;
  const MIN_ATTACK_INTERVAL_MS=50;
  const ATTACK_SPEED_DIVISOR=500000;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function createSeededRng(seed){
    let state=seed>>>0;
    const nextFloat=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/0x100000000};
    return {
      nextFloat,
      nextInt(min,max){return min+Math.floor(nextFloat()*(max-min+1))},
      nextDamageOffset(randomDamage){return randomDamage<=0?0:this.nextInt(-randomDamage,randomDamage)}
    };
  }
  function calcMeleeDamage(attacker,defender,options={}){
    const randomDamage=attacker.randomDamage??0;
    const offset=options.rngOffset??options.rng?.nextDamageOffset(randomDamage)??0;
    return Math.max(1,Math.floor(attacker.pAtk*(1+offset/100)*MELEE_WEAPON_MODIFIER/Math.max(1,defender.pDef)));
  }
  function calcPhysicalSkillDamage(attacker,defender,power,options={}){
    const randomDamage=attacker.randomDamage??0;
    const offset=options.rngOffset??options.rng?.nextDamageOffset(randomDamage)??0;
    return Math.max(1,Math.floor(((attacker.pAtk+power)/Math.max(1,defender.pDef))*MELEE_WEAPON_MODIFIER*(1+offset/100)));
  }
  function calcMagicSkillDamage(attacker,defender,power,options={}){
    const offset=options.rngOffset??options.rng?.nextDamageOffset(0)??0;
    return Math.max(1,Math.floor((MAGIC_DAMAGE_CONSTANT*(attacker.mAtk+power)/Math.max(1,defender.mDef))*(1+offset/100)));
  }
  function rollCrit(attacker,rng){return rng.nextFloat()<clamp(attacker.critRate||0,0,100)/100}
  function applyCritMultiplier(damage,isCrit,multiplier=2){return isCrit?Math.floor(damage*multiplier):damage}
  function calculateAttackIntervalMs(attackSpeed){return Math.max(MIN_ATTACK_INTERVAL_MS,Math.floor(ATTACK_SPEED_DIVISOR/Math.max(1,attackSpeed)))}
  function horizontalDistance(x1,z1,x2,z2){return Math.hypot(x2-x1,z2-z1)}
  function isInMeleeRange(ax,az,tx,tz,range){return horizontalDistance(ax,az,tx,tz)<=range}
  function createCombatState(){
    return {targetId:null,nextAttackAtMs:0,skillCooldownEndMs:Object.create(null),castingSkillId:0,castEndMs:0,castTargetId:null,effects:[]};
  }
  function getSkillCooldownEnd(state,id){return state.skillCooldownEndMs[id]||0}
  function canUseSkill(state,id,knownIds,nowMs){
    return knownIds.has(id)&&nowMs>=getSkillCooldownEnd(state,id)&&state.castingSkillId===0;
  }
  function beginSkillCast(state,id,targetId,hitTime,nowMs){
    state.castingSkillId=id;state.castEndMs=nowMs+Math.max(0,hitTime||0);state.castTargetId=targetId||null;
  }
  function cancelSkillCast(state){
    state.castingSkillId=0;state.castEndMs=0;state.castTargetId=null;
  }
  function applyDamageToCastingPlayer(state,damage){
    if(damage>0&&state.castingSkillId!==0){cancelSkillCast(state);return true}return false;
  }
  function applyTimedEffect(target,kind,duration,value,nowMs){
    if(!target.effects)target.effects=[];
    const expiresAtMs=nowMs+Math.max(0,duration)*1000;
    const existing=target.effects.find(e=>e.kind===kind);
    if(existing){existing.expiresAtMs=Math.max(existing.expiresAtMs,expiresAtMs);existing.value=value}
    else target.effects.push({kind,value,expiresAtMs});
  }
  function tickTimedEffects(target,nowMs){
    if(!target.effects)return [];
    const expired=target.effects.filter(e=>e.expiresAtMs<=nowMs);
    target.effects=target.effects.filter(e=>e.expiresAtMs>nowMs);
    return expired;
  }
  function resolveDamage(options){
    const {kind='physical',attackPower=1,defense,magicDefense,power=0,critRate=0,critMultiplier=2,randomDamage=0,rng,rangeOk=true,damageMultiplier=1}=options;
    if(!rangeOk)return {ok:false,missed:false,critical:false,damage:0,reason:'out_of_range'};
    const sourceRng=rng||createSeededRng((options.seed??1)>>>0);
    const raw=kind==='magic'
      ?calcMagicSkillDamage({mAtk:attackPower},{mDef:magicDefense||91},power,{rng:sourceRng})
      :calcPhysicalSkillDamage({pAtk:attackPower,randomDamage},{pDef:defense||77},power,{rng:sourceRng});
    const critical=rollCrit({critRate},sourceRng);
    const damage=Math.max(1,Math.floor(applyCritMultiplier(raw,critical,critMultiplier)*Math.max(.01,damageMultiplier)));
    return {ok:true,missed:false,critical,damage,reason:null};
  }
  function resolvePlayerAttack(params){
    const {attacker,target,state,nowMs,range=4,peaceZone=false,rng}=params;
    if(!attacker||!target||target.hp<=0||peaceZone||!isInMeleeRange(attacker.x,attacker.z,target.x,target.z,range))return {ok:false,damage:0,killed:false};
    if(nowMs<(state.nextAttackAtMs||0))return {ok:false,damage:0,killed:false};
    const result=resolveDamage({kind:'physical',attackPower:attacker.pAtk,defense:target.pDef,critRate:attacker.critRate,randomDamage:attacker.randomDamage||0,rng});
    state.nextAttackAtMs=nowMs+calculateAttackIntervalMs(attacker.attackSpeed||300);
    target.hp=Math.max(0,target.hp-result.damage);
    return {ok:true,...result,killed:target.hp<=0};
  }
  function canAttackPlayer(attacker,target,peaceZone){
    if(peaceZone||!target||target.alive===false)return false;
    if(target.pvpFlag===1)return true;
    return (attacker?.karma||0)<0;
  }
  function resolvePlayerVsPlayerAttack(params){
    const allowed=canAttackPlayer(params.attacker,params.target,params.peaceZone);
    if(!allowed)return {allowed:false,damage:0};
    const damage=calcMeleeDamage({pAtk:params.attacker.pAtk,randomDamage:params.attacker.randomDamage||0},{pDef:params.target.pDef},{rng:params.rng});
    return {allowed:true,damage};
  }
  root.AetheriaCombatCore=Object.freeze({
    createSeededRng,calcMeleeDamage,calcPhysicalSkillDamage,calcMagicSkillDamage,
    rollCrit,applyCritMultiplier,calculateAttackIntervalMs,horizontalDistance,
    isInMeleeRange,createCombatState,getSkillCooldownEnd,canUseSkill,
    beginSkillCast,cancelSkillCast,applyDamageToCastingPlayer,
    applyTimedEffect,tickTimedEffects,resolveDamage,resolvePlayerAttack,
    canAttackPlayer,resolvePlayerVsPlayerAttack
  });
})(typeof window!=='undefined'?window:globalThis);
