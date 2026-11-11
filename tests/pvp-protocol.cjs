'use strict';
const assert=require('node:assert/strict');
require('../assets/combat/pvp-protocol.js');
const P=globalThis.AetheriaPvpProtocol;
assert.ok(P,'PvP protocol must be exported');

const sender={mode:'river',pvp:1,lv:35,hp:100,z:120,d:8};
const state={};
const context={senderId:'peer-a',recipientId:'peer-b',sender,receiverInZone:true,distance:12,nowMs:10000,maxDamage:90};
const packet=P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:1,damage:100,range:34,nowMs:10000});
assert.deepEqual(Object.keys(packet).sort(),['d','r','seq','sentAt','sid','to','v'].sort());
assert.equal(packet.v,P.VERSION);
assert.equal(packet.r,34);
const accepted=P.validateHit(packet,context,state);
assert.equal(accepted.ok,true);
assert.equal(accepted.damage,35);
assert.equal(accepted.rawDamage,100);
assert.equal(state.lastSeq,1);

assert.equal(P.validateHit(packet,{...context,nowMs:10300},state).reason,'replay');
const tooFast=P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:2,damage:100,range:34,nowMs:10100});
assert.equal(P.validateHit(tooFast,{...context,nowMs:10100},state).reason,'cooldown');
assert.equal(state.lastSeq,2,'rate-limited sequence must be consumed');
const next=P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:3,damage:1000,range:34,nowMs:10300});
const capped=P.validateHit(next,{...context,nowMs:10300},state);
assert.equal(capped.ok,true);
assert.equal(capped.damage,90,'receiver HP-based cap must be enforced');

const stale=P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:4,damage:20,range:34,nowMs:10301});
assert.equal(P.validateHit(stale,{...context,nowMs:16000},state).reason,'stale_packet');
const future=P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:4,damage:20,range:34,nowMs:20000});
assert.equal(P.validateHit(future,{...context,nowMs:10000},state).reason,'stale_packet');
const wrongRecipient=P.createHitPacket({to:'peer-c',sessionId:'session-a',seq:4,damage:20,range:34,nowMs:10400});
assert.equal(P.validateHit(wrongRecipient,{...context,nowMs:10400},state).reason,'wrong_recipient');
const outOfRange=P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:4,damage:20,range:8,nowMs:10400});
assert.equal(P.validateHit(outOfRange,{...context,nowMs:10400,distance:9},state).reason,'out_of_range');
assert.equal(P.validateHit(P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:4,damage:20,range:34,nowMs:10400}),{...context,nowMs:10400,receiverInZone:false},state).reason,'outside_pvp');
assert.equal(P.validateHit(P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:4,damage:20,range:34,nowMs:10400}),{...context,nowMs:10400,sender:{...sender,lv:19}},state).reason,'invalid_sender');
assert.equal(P.validateHit(P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:4,damage:20,range:34,nowMs:10400}),{...context,nowMs:10400,sender:{...sender,pvp:0}},state).reason,'invalid_sender');

const newSession=P.createHitPacket({to:'peer-b',sessionId:'session-b',seq:1,damage:20,range:34,nowMs:10400});
assert.equal(P.validateHit(newSession,{...context,nowMs:10400},state).ok,true,'new sender session may restart sequence');
const oldSession=P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:5,damage:20,range:34,nowMs:10700});
assert.equal(P.validateHit(oldSession,{...context,nowMs:10700},state).reason,'replayed_session');

assert.equal(P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:0,damage:20,range:34,nowMs:1}),null);
assert.equal(P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:1,damage:0,range:34,nowMs:1}),null);
assert.equal(P.createHitPacket({to:'peer-b',sessionId:'session-a',seq:1,damage:20,range:0,nowMs:1}),null);
console.log('Aetheria PvP protocol: packet schema, recipient, sender, zone, range, expiry, sequence, session replay, cooldown and damage cap passed.');
