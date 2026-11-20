/*!
 * Aetheria PvP peer-message protocol.
 * Client-side validation for the existing Trystero room transport.
 * This is abuse resistance, not authoritative anti-cheat: peers still own
 * their local character state until a trusted game server is introduced.
 */
(function(root){
  'use strict';
  const VERSION=1;
  const MAX_PACKET_DAMAGE=1000000;
  const MAX_SESSION_LENGTH=64;
  const MAX_TRACKED_SESSIONS=64;
  const MAX_DEATH_RECEIPTS=256;
  const MAX_LOOT_RECEIPTS=2048;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  function cooldownActive(state,now,cooldownMs){
    if(state.lastAcceptedAt===undefined||state.lastAcceptedAt===null)return false;
    const last=Number(state.lastAcceptedAt);
    return !Number.isFinite(last)||now-last<cooldownMs;
  }

  function enterSession(sid,state,now,cooldownMs){
    if(state.sessionId===sid)return {ok:true,isNew:false};
    if(state.sessions.includes(sid))return {ok:false,reason:'replayed_session'};
    // Do not let arbitrary session rotation bypass the per-peer cooldown or
    // fill the replay history while packets are being rate-limited.
    if(cooldownActive(state,now,cooldownMs))return {ok:false,reason:'cooldown'};
    state.sessions.push(sid);
    if(state.sessions.length>MAX_TRACKED_SESSIONS)state.sessions=state.sessions.slice(-MAX_TRACKED_SESSIONS);
    state.sessionId=sid;
    state.lastSeq=0;
    return {ok:true,isNew:true};
  }

  function createHitPacket(input){
    input=input||{};
    const to=String(input.to||'').trim();
    const sid=String(input.sessionId||'');
    const damage=Number(input.damage);
    const seq=Number(input.seq);
    const sentAt=Number(input.nowMs);
    const range=Number(input.range);
    if(!to||to.length>128||!sid||sid.length>MAX_SESSION_LENGTH||
       !Number.isSafeInteger(seq)||seq<1||
       !Number.isFinite(damage)||damage<=0||damage>MAX_PACKET_DAMAGE||
       !Number.isFinite(sentAt)||!Number.isFinite(range)||range<=0)return null;
    return {
      v:VERSION,
      to,
      sid,
      seq,
      sentAt,
      r:clamp(range,1,40),
      d:Math.round(damage)
    };
  }

  function validateHit(packet,context,state,options){
    packet=packet||{};
    context=context||{};
    state=state||{};
    options=options||{};
    const now=Number(context.nowMs);
    const ttlMs=clamp(Number(options.ttlMs)||5000,500,15000);
    const cooldownMs=clamp(Number(options.cooldownMs)||250,100,2000);
    const minLevel=Math.max(1,Math.floor(Number(options.minLevel)||20));
    const maxDistance=clamp(Number(options.maxDistance)||40,1,40);
    const damageScale=clamp(Number(options.damageScale)||.35,.01,1);
    const maxDamage=Math.max(1,Math.floor(Number(context.maxDamage)||1));
    const reject=reason=>({ok:false,damage:0,reason});

    if(!Number.isFinite(now)||!packet||typeof packet!=='object')return reject('invalid_context');
    if(packet.v!==VERSION)return reject('unsupported_version');
    const recipient=String(context.recipientId||'');
    const senderId=String(context.senderId||'');
    if(!recipient||!senderId||senderId===recipient||String(packet.to||'')!==recipient)return reject('wrong_recipient');
    const sid=String(packet.sid||'');
    const seq=Number(packet.seq);
    const sentAt=Number(packet.sentAt);
    if(!sid||sid.length>MAX_SESSION_LENGTH||!Number.isSafeInteger(seq)||seq<1)return reject('invalid_sequence');
    if(!Number.isFinite(sentAt)||sentAt>now+1000||now-sentAt>ttlMs)return reject('stale_packet');

    const sender=context.sender;
    if(!sender||sender.mode!=='river'||Number(sender.pvp)!==1||
       !Number.isFinite(Number(sender.lv))||Number(sender.lv)<minLevel||
       !Number.isFinite(Number(sender.z))||!Number.isFinite(Number(sender.d))||
       !Number.isFinite(Number(sender.hp))||Number(sender.hp)<=0)return reject('invalid_sender');
    if(context.receiverInZone!==true)return reject('outside_pvp');
    const distance=Number(context.distance);
    const range=Number(packet.r);
    if(!Number.isFinite(range)||range<=0||range>maxDistance||
       !Number.isFinite(distance)||distance<0||distance>Math.min(maxDistance,range))return reject('out_of_range');

    const rawDamage=Number(packet.d);
    if(!Number.isFinite(rawDamage)||rawDamage<=0||rawDamage>MAX_PACKET_DAMAGE)return reject('invalid_damage');

    if(!Array.isArray(state.sessions))state.sessions=[];
    const session=enterSession(sid,state,now,cooldownMs);
    if(!session.ok)return reject(session.reason);
    if(!Number.isSafeInteger(Number(state.lastSeq))&&state.lastSeq!==undefined)return reject('invalid_sequence');
    if(seq<=Number(state.lastSeq||0))return reject('replay');
    // Consume a sequence for the active session even when rate-limited.
    state.lastSeq=seq;
    if(!session.isNew&&cooldownActive(state,now,cooldownMs))return reject('cooldown');

    const damage=Math.max(1,Math.min(maxDamage,Math.round(rawDamage*damageScale)));
    state.lastAcceptedAt=now;
    return {ok:true,damage,rawDamage:Math.round(rawDamage),seq,reason:null};
  }

  function createDeathPacket(input){
    input=input||{};
    const to=String(input.to||'').trim();
    const sid=String(input.sessionId||'');
    const seq=Number(input.seq);
    if(!to||to.length>128||!sid||sid.length>MAX_SESSION_LENGTH||
       !Number.isSafeInteger(seq)||seq<1)return null;
    return {v:VERSION,to,sid,seq};
  }

  function validateDeathPacket(packet,context,state,options){
    packet=packet||{};
    context=context||{};
    state=state||{};
    options=options||{};
    const now=Number(context.nowMs);
    const cooldownMs=clamp(Number(options.cooldownMs)||250,0,5000);
    const reject=reason=>({ok:false,reason});
    if(!Number.isFinite(now)||!packet||typeof packet!=='object')return reject('invalid_context');
    if(packet.v!==VERSION)return reject('unsupported_version');
    const recipient=String(context.recipientId||'');
    const senderId=String(context.senderId||'');
    if(!recipient||!senderId||senderId===recipient||String(packet.to||'')!==recipient)return reject('wrong_recipient');
    const sid=String(packet.sid||'');
    const seq=Number(packet.seq);
    if(!sid||sid.length>MAX_SESSION_LENGTH||!Number.isSafeInteger(seq)||seq<1)return reject('invalid_sequence');

    if(!Array.isArray(state.sessions))state.sessions=[];
    const session=enterSession(sid,state,now,cooldownMs);
    if(!session.ok)return reject(session.reason);
    if(!Number.isSafeInteger(Number(state.lastSeq))&&state.lastSeq!==undefined)return reject('invalid_sequence');
    if(seq<=Number(state.lastSeq||0))return reject('replay');
    state.lastSeq=seq;
    if(!session.isNew&&cooldownActive(state,now,cooldownMs))return reject('cooldown');
    state.lastAcceptedAt=now;
    return {ok:true,seq,sessionId:sid,reason:null};
  }

  function deathReceiptKey(peerId,event){
    const peer=String(peerId||'');
    if(!peer||peer.length>128||!event||event.v!==VERSION)return null;
    const sid=event.sid;
    const seq=Number(event.seq);
    if(typeof sid!=='string'||!sid||sid.length>MAX_SESSION_LENGTH||
       !Number.isSafeInteger(seq)||seq<1)return null;
    return JSON.stringify([peer,sid,seq]);
  }

  function rememberDeathReceipt(receipts,peerId,event,limit=MAX_DEATH_RECEIPTS){
    const key=deathReceiptKey(peerId,event);
    if(!key)return {ok:false,reason:'invalid_event',receipts:[]};
    const cap=Number.isSafeInteger(limit)?clamp(limit,1,MAX_DEATH_RECEIPTS):MAX_DEATH_RECEIPTS;
    const next=(Array.isArray(receipts)?receipts:[])
      .filter(value=>typeof value==='string'&&value.length<=256)
      .slice(-cap);
    if(next.includes(key))return {ok:false,reason:'duplicate',key,receipts:next};
    next.push(key);
    if(next.length>cap)next.splice(0,next.length-cap);
    return {ok:true,key,receipts:next};
  }

  function lootReceiptKey(peerId,itemId){
    const peer=String(peerId||'');
    const sourceId=String(itemId===undefined||itemId===null?'':itemId);
    if(!peer||peer.length>128||!/^[1-9][0-9]{0,15}$/.test(sourceId)||
       !Number.isSafeInteger(Number(sourceId)))return null;
    return JSON.stringify([peer,sourceId]);
  }

  function rememberLootReceipt(receipts,peerId,itemId,limit=MAX_LOOT_RECEIPTS){
    const key=lootReceiptKey(peerId,itemId);
    if(!key)return {ok:false,reason:'invalid_item_id',receipts:[]};
    const cap=Number.isSafeInteger(limit)?clamp(limit,1,MAX_LOOT_RECEIPTS):MAX_LOOT_RECEIPTS;
    const next=(Array.isArray(receipts)?receipts:[])
      .filter(value=>typeof value==='string'&&value.length<=256)
      .slice(-cap);
    if(next.includes(key))return {ok:false,reason:'duplicate',key,receipts:next};
    next.push(key);
    if(next.length>cap)next.splice(0,next.length-cap);
    return {ok:true,key,receipts:next};
  }

  root.AetheriaPvpProtocol=Object.freeze({
    VERSION,MAX_DEATH_RECEIPTS,MAX_LOOT_RECEIPTS,createHitPacket,validateHit,createDeathPacket,
    validateDeathPacket,deathReceiptKey,rememberDeathReceipt,lootReceiptKey,rememberLootReceipt
  });
})(typeof window!=='undefined'?window:globalThis);
