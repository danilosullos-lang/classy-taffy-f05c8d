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
  const floorDamage=value=>Math.floor(value+Number.EPSILON*Math.max(1,Math.abs(value))*8);
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
    return Math.max(1,floorDamage(attacker.pAtk*(1+offset/100)*MELEE_WEAPON_MODIFIER/Math.max(1,defender.pDef)));
  }
  function calcPhysicalSkillDamage(attacker,defender,power,options={}){
    const randomDamage=attacker.randomDamage??0;
    const offset=options.rngOffset??options.rng?.nextDamageOffset(randomDamage)??0;
    return Math.max(1,floorDamage(((attacker.pAtk+power)/Math.max(1,defender.pDef))*MELEE_WEAPON_MODIFIER*(1+offset/100)));
  }
  function calcMagicSkillDamage(attacker,defender,power,options={}){
    const offset=options.rngOffset??options.rng?.nextDamageOffset(0)??0;
    return Math.max(1,floorDamage((MAGIC_DAMAGE_CONSTANT*(attacker.mAtk+power)/Math.max(1,defender.mDef))*(1+offset/100)));
  }
  function rollCrit(attacker,rng){return rng.nextFloat()<clamp(attacker.critRate||0,0,100)/100}
  function applyCritMultiplier(damage,isCrit,multiplier=2){return isCrit?floorDamage(damage*multiplier):damage}
  function calculateAttackIntervalMs(attackSpeed){return Math.max(MIN_ATTACK_INTERVAL_MS,Math.floor(ATTACK_SPEED_DIVISOR/Math.max(1,attackSpeed)))}
  function horizontalDistance(x1,z1,x2,z2){return Math.hypot(x2-x1,z2-z1)}
  function isInMeleeRange(ax,az,tx,tz,range){return horizontalDistance(ax,az,tx,tz)<=range}
  function createCombatState(){
    return {targetId:null,nextAttackAtMs:0,skillCooldownEndMs:Object.create(null),castingSkillId:0,castEndMs:0,castTargetId:null,effects:[]};
  }
  function getSkillCooldownEnd(state,id){
    const value=state&&state.skillCooldownEndMs?Number(state.skillCooldownEndMs[id]):0;
    return Number.isFinite(value)?value:0;
  }
  function canUseSkill(state,id,knownIds,nowMs){
    const now=Number(nowMs);
    return !!state&&!!knownIds&&typeof knownIds.has==='function'&&knownIds.has(id)&&
      Number.isFinite(now)&&now>=getSkillCooldownEnd(state,id)&&state.castingSkillId===0;
  }
  function beginSkillCast(state,id,targetId,hitTime,nowMs){
    const duration=Number(hitTime),start=Number(nowMs);
    if(!state||id===undefined||id===null||id===0||!Number.isFinite(duration)||duration<0||!Number.isFinite(start))return false;
    const end=start+duration;
    if(!Number.isFinite(end))return false;
    state.castingSkillId=id;state.castEndMs=end;state.castTargetId=targetId==null?null:targetId;
    return true;
  }
  function completeSkillCast(state,nowMs){
    const now=Number(nowMs);
    if(!state||state.castingSkillId===0||!Number.isFinite(now)||
       !Number.isFinite(Number(state.castEndMs))||now<Number(state.castEndMs))return null;
    const completed={id:state.castingSkillId,targetId:state.castTargetId};
    cancelSkillCast(state);
    return completed;
  }
  function cancelSkillCast(state){
    if(!state)return false;
    const active=state.castingSkillId!==0;
    state.castingSkillId=0;state.castEndMs=0;state.castTargetId=null;
    return active;
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
    options=options||{};
    const {kind='physical',attackPower=1,defense,magicDefense,power=0,critRate=0,critMultiplier=2,randomDamage=0,rng,rngOffset,rangeOk=true,damageMultiplier=1}=options;
    const reject=reason=>({ok:false,missed:false,critical:false,damage:0,reason});
    if(!rangeOk)return reject('out_of_range');
    if(kind!=='physical'&&kind!=='magic')return reject('invalid_kind');
    const attack=Number(attackPower),skillPower=Number(power),crit=Number(critRate);
    const critScale=Number(critMultiplier),variance=Number(randomDamage),multiplier=Number(damageMultiplier);
    const defenseValue=Number(kind==='magic'?(magicDefense??91):(defense??77));
    if(!Number.isFinite(attack)||attack<=0||!Number.isFinite(skillPower)||skillPower<0||
       !Number.isFinite(defenseValue)||defenseValue<=0||!Number.isFinite(crit)||
       !Number.isFinite(critScale)||critScale<1||!Number.isFinite(variance)||variance<0||
       !Number.isFinite(multiplier)||multiplier<=0||
       (rngOffset!==undefined&&!Number.isFinite(Number(rngOffset))))return reject('invalid_stats');
    if(rng&&(typeof rng.nextFloat!=='function'||typeof rng.nextDamageOffset!=='function'))
      return reject('invalid_rng');
    const sourceRng=rng||createSeededRng((options.seed??1)>>>0);
    const calcOptions={rng:sourceRng};
    if(rngOffset!==undefined)calcOptions.rngOffset=Number(rngOffset);
    const raw=kind==='magic'
      ?calcMagicSkillDamage({mAtk:attack},{mDef:defenseValue},skillPower,calcOptions)
      :calcPhysicalSkillDamage({pAtk:attack,randomDamage:variance},{pDef:defenseValue},skillPower,calcOptions);
    if(!Number.isFinite(raw)||raw<=0)return reject('invalid_damage');
    const critical=rollCrit({critRate:crit},sourceRng);
    const damage=Math.max(1,floorDamage(applyCritMultiplier(raw,critical,critScale)*multiplier));
    if(!Number.isFinite(damage))return reject('invalid_damage');
    return {ok:true,missed:false,critical,damage,reason:null};
  }
  function resolvePlayerAttack(params){
    const {attacker,target,state,nowMs,range=4,peaceZone=false,rng}=params||{};
    if(!attacker||!target||!state||!Number.isFinite(Number(nowMs))||
       ![attacker.x,attacker.z,target.x,target.z,target.hp].every(v=>Number.isFinite(Number(v))))
      return {ok:false,damage:0,killed:false,reason:'invalid_state'};
    if(Number(target.hp)<=0||peaceZone||!isInMeleeRange(Number(attacker.x),Number(attacker.z),Number(target.x),Number(target.z),range))
      return {ok:false,damage:0,killed:false,reason:peaceZone?'peace_zone':'out_of_range'};
    const nextAttackAt=Number(state.nextAttackAtMs||0);
    if(!Number.isFinite(nextAttackAt))return {ok:false,damage:0,killed:false,reason:'invalid_state'};
    if(Number(nowMs)<nextAttackAt)return {ok:false,damage:0,killed:false,reason:'cooldown'};
    const result=resolveDamage({kind:'physical',attackPower:attacker.pAtk,defense:target.pDef,critRate:attacker.critRate,randomDamage:attacker.randomDamage||0,rng});
    if(!result.ok)return {...result,killed:false};
    state.nextAttackAtMs=nowMs+calculateAttackIntervalMs(attacker.attackSpeed||300);
    target.hp=Math.max(0,target.hp-result.damage);
    return {ok:true,...result,killed:target.hp<=0};
  }
  function resolveMonsterAttack(params){
    const {attacker,target,state,nowMs,range=2,peaceZone=false}=params||{};
    if(!attacker||!target||!state||!Number.isFinite(Number(nowMs))||
       !Number.isFinite(Number(attacker.x))||!Number.isFinite(Number(attacker.z))||
       !Number.isFinite(Number(target.x))||!Number.isFinite(Number(target.z))){
      return {ok:false,damage:0,reason:'invalid_state'};
    }
    if(attacker.dead||attacker.alive===false||target.alive===false||
       !Number.isFinite(Number(target.hp))||Number(target.hp)<=0||peaceZone){
      return {ok:false,damage:0,reason:'not_attackable'};
    }
    if(!isInMeleeRange(Number(attacker.x),Number(attacker.z),Number(target.x),Number(target.z),Math.max(0,Number(range)||0))){
      return {ok:false,damage:0,reason:'out_of_range'};
    }
    if(Number(nowMs)<(Number(state.nextAttackAtMs)||0)){
      return {ok:false,damage:0,reason:'cooldown'};
    }
    const rawDamage=Number(attacker.damage??attacker.pAtk??1);
    if(!Number.isFinite(rawDamage)||rawDamage<=0)return {ok:false,damage:0,reason:'invalid_damage'};
    const interval=Number.isFinite(Number(attacker.attackIntervalMs))
      ?clamp(Number(attacker.attackIntervalMs),MIN_ATTACK_INTERVAL_MS,60000)
      :calculateAttackIntervalMs(attacker.attackSpeed||385);
    state.nextAttackAtMs=Number(nowMs)+interval;
    return {ok:true,damage:Math.max(1,rawDamage),critical:false,reason:null,nextAttackAtMs:state.nextAttackAtMs};
  }
  function canAttackPlayer(attacker,target,peaceZone){
    if(peaceZone||!target||target.alive===false)return false;
    if(target.pvpFlag===1)return true;
    return (attacker?.karma||0)<0;
  }
  function resolvePlayerVsPlayerAttack(params={}){
    const attacker=params.attacker,target=params.target;
    if(!attacker||!target)return {allowed:false,damage:0,reason:'invalid_target'};
    if(params.rangeOk===false)return {allowed:false,damage:0,reason:'out_of_range'};
    if(target.alive===false||(target.hp!=null&&(!Number.isFinite(Number(target.hp))||Number(target.hp)<=0)))
      return {allowed:false,damage:0,reason:'target_unavailable'};
    if(params.peaceZone)return {allowed:false,damage:0,reason:'peace_zone'};
    if(!canAttackPlayer(attacker,target,false))return {allowed:false,damage:0,reason:'not_allowed'};
    const pAtk=Number(attacker.pAtk),pDef=Number(target.pDef);
    if(!Number.isFinite(pAtk)||pAtk<=0||!Number.isFinite(pDef)||pDef<=0)
      return {allowed:false,damage:0,reason:'invalid_stats'};
    const damage=calcMeleeDamage({pAtk,randomDamage:Math.max(0,Number(attacker.randomDamage)||0)},{pDef},{rng:params.rng});
    if(!Number.isFinite(damage)||damage<=0)return {allowed:false,damage:0,reason:'invalid_damage'};
    return {allowed:true,damage,reason:null};
  }
  root.AetheriaCombatCore=Object.freeze({
    createSeededRng,calcMeleeDamage,calcPhysicalSkillDamage,calcMagicSkillDamage,
    rollCrit,applyCritMultiplier,calculateAttackIntervalMs,horizontalDistance,
    isInMeleeRange,createCombatState,getSkillCooldownEnd,canUseSkill,
    beginSkillCast,completeSkillCast,cancelSkillCast,applyDamageToCastingPlayer,
    applyTimedEffect,tickTimedEffects,resolveDamage,resolvePlayerAttack,
    resolveMonsterAttack,canAttackPlayer,resolvePlayerVsPlayerAttack
  });
})(typeof window!=='undefined'?window:globalThis);
