'use strict';
const assert=require('node:assert/strict');
require('../assets/combat/pvp-protocol.js');
const P=globalThis.AetheriaPvpProtocol;
assert.ok(P,'PvP protocol must be exported');
assert.equal(typeof P.createDeathPacket,'function');
assert.equal(typeof P.validateDeathPacket,'function');

const deathContext={senderId:'peer-a',recipientId:'peer-b',nowMs:20000};
const deathState={};
const death=P.createDeathPacket({to:'peer-b',sessionId:'death-session-a',seq:1});
assert.deepEqual(Object.keys(death).sort(),['seq','sid','to','v'].sort());
const acceptedDeath=P.validateDeathPacket(death,deathContext,deathState);
assert.equal(acceptedDeath.ok,true);
assert.equal(acceptedDeath.seq,1);
assert.equal(P.validateDeathPacket(death,{...deathContext,nowMs:20300},deathState).reason,'replay');

const fastDeath=P.createDeathPacket({to:'peer-b',sessionId:'death-session-a',seq:2});
assert.equal(P.validateDeathPacket(fastDeath,{...deathContext,nowMs:20200},deathState).reason,'cooldown');
assert.equal(deathState.lastSeq,2,'rate-limited death sequence must be consumed');
const nextDeath=P.createDeathPacket({to:'peer-b',sessionId:'death-session-a',seq:3});
assert.equal(P.validateDeathPacket(nextDeath,{...deathContext,nowMs:20250},deathState).ok,true);

assert.equal(P.validateDeathPacket(nextDeath,{...deathContext,nowMs:NaN},{}).reason,'invalid_context');
const wrongDeath=P.createDeathPacket({to:'peer-c',sessionId:'death-session-a',seq:4});
assert.equal(P.validateDeathPacket(wrongDeath,{...deathContext,nowMs:20300},deathState).reason,'wrong_recipient');

const newDeathSession=P.createDeathPacket({to:'peer-b',sessionId:'death-session-b',seq:1});
assert.equal(P.validateDeathPacket(newDeathSession,{...deathContext,nowMs:21000},deathState).ok,true);
const oldDeathSession=P.createDeathPacket({to:'peer-b',sessionId:'death-session-a',seq:4});
assert.equal(P.validateDeathPacket(oldDeathSession,{...deathContext,nowMs:21300},deathState).reason,'replayed_session');
assert.equal(P.createDeathPacket({to:'peer-b',sessionId:'death-session-a',seq:0}),null);
assert.equal(P.createDeathPacket({to:'peer-b',sessionId:'',seq:1}),null);


console.log('Aetheria PvP death protocol: recipient, sequence, replay, session rotation and cooldown passed.');
