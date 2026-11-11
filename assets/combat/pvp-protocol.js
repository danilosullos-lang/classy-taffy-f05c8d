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
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

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
       Number(sender.lv)<minLevel||!Number.isFinite(Number(sender.z))||
       !Number.isFinite(Number(sender.d))||Number(sender.hp)<=0)return reject('invalid_sender');
    if(context.receiverInZone!==true)return reject('outside_pvp');
    const distance=Number(context.distance);
    const range=Number(packet.r);
    if(!Number.isFinite(range)||range<=0||range>maxDistance||
       !Number.isFinite(distance)||distance<0||distance>Math.min(maxDistance,range))return reject('out_of_range');

    const rawDamage=Number(packet.d);
    if(!Number.isFinite(rawDamage)||rawDamage<=0||rawDamage>MAX_PACKET_DAMAGE)return reject('invalid_damage');

    if(!Array.isArray(state.sessions))state.sessions=[];
    if(state.sessions.includes(sid)&&state.sessionId!==sid)return reject('replayed_session');
    if(state.sessionId!==sid){
      state.sessions.push(sid);
      if(state.sessions.length>8)state.sessions=state.sessions.slice(-8);
      state.sessionId=sid;
      state.lastSeq=0;
      state.lastAcceptedAt=0;
    }
    if(seq<=Number(state.lastSeq||0))return reject('replay');
    // Consume a valid sequence even when rate-limited, so it cannot be replayed later.
    state.lastSeq=seq;
    if(now-Number(state.lastAcceptedAt||0)<cooldownMs)return reject('cooldown');

    const damage=Math.max(1,Math.min(maxDamage,Math.round(rawDamage*damageScale)));
    state.lastAcceptedAt=now;
    return {ok:true,damage,rawDamage:Math.round(rawDamage),seq,reason:null};
  }

  root.AetheriaPvpProtocol=Object.freeze({VERSION,createHitPacket,validateHit});
})(typeof window!=='undefined'?window:globalThis);
