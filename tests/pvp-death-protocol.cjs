'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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
assert.equal(P.validateDeathPacket(newDeathSession,{...deathContext,nowMs:20260},deathState).reason,'cooldown',
  'rotating the sender session must not bypass the per-peer death cooldown');
assert.equal(deathState.sessionId,'death-session-a','a rate-limited session must not replace the active session');
assert.equal(deathState.lastSeq,3,'a rate-limited new session must not mutate the active sequence');
assert.equal(P.validateDeathPacket(newDeathSession,{...deathContext,nowMs:20500},deathState).ok,true,
  'a new sender session may restart its sequence after the shared cooldown');
const oldDeathSession=P.createDeathPacket({to:'peer-b',sessionId:'death-session-a',seq:4});
assert.equal(P.validateDeathPacket(oldDeathSession,{...deathContext,nowMs:20800},deathState).reason,'replayed_session');
assert.equal(P.createDeathPacket({to:'peer-b',sessionId:'death-session-a',seq:0}),null);
assert.equal(P.createDeathPacket({to:'peer-b',sessionId:'',seq:1}),null);

assert.equal(P.MAX_DEATH_RECEIPTS,256);
const firstReceipt=P.rememberDeathReceipt([], 'peer-a', death);
assert.equal(firstReceipt.ok,true);
assert.equal(firstReceipt.key,P.deathReceiptKey('peer-a',death));
const persistedReceipts=JSON.parse(JSON.stringify(firstReceipt.receipts));
const afterReload=P.rememberDeathReceipt(persistedReceipts,'peer-a',death);
assert.equal(afterReload.ok,false,'a persisted death receipt must survive a simulated reload');
assert.equal(afterReload.reason,'duplicate');
assert.deepEqual(afterReload.receipts,persistedReceipts);
assert.equal(P.rememberDeathReceipt(persistedReceipts,'peer-c',death).ok,true,
  'the same event identifier from a different peer must not collide');
assert.equal(P.deathReceiptKey('',death),null);
assert.equal(P.deathReceiptKey('peer-a',{...death,seq:0}),null);

let bounded=[];
let oldestKey=null;
for(let i=0;i<P.MAX_DEATH_RECEIPTS+5;i++){
  const event=P.createDeathPacket({to:'peer-b',sessionId:'receipt-'+i,seq:1});
  if(i===0)oldestKey=P.deathReceiptKey('peer-a',event);
  const result=P.rememberDeathReceipt(bounded,'peer-a',event);
  assert.equal(result.ok,true);
  bounded=result.receipts;
}
assert.equal(bounded.length,P.MAX_DEATH_RECEIPTS);
assert.equal(bounded.includes(oldestKey),false,'receipt history must remain bounded and evict the oldest entry');

const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert.match(index,/protocol\.deathReceiptKey\(m\.peer,d\.event\)/,
  'the browser receiver must check the persisted receipt before applying PvP loot');
assert.match(index,/protocol\.rememberDeathReceipt\(sv\.pk\.receipts,m\.peer,d\.event\)/,
  'the browser receiver must persist a receipt for each accepted PvP death');
assert.match(index,/sv\.pk\.receipts=receipt\.receipts/,
  'receipt history must be part of the existing save payload');

console.log('Aetheria PvP death protocol: recipient, sequence, replay, cross-session cooldown, persisted idempotency receipts and bounded history passed.');
