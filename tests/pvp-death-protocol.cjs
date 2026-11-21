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
assert.equal(P.MAX_LOOT_RECEIPTS,2048);
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

const firstLootReceipt=P.rememberLootReceipt([], 'peer-a', 77);
assert.equal(firstLootReceipt.ok,true);
const persistedLootReceipts=JSON.parse(JSON.stringify(firstLootReceipt.receipts));
const repeatedItem=P.rememberLootReceipt(persistedLootReceipts,'peer-a','77');
assert.equal(repeatedItem.ok,false,'the same source item must not be transferred again under a new death event');
assert.equal(repeatedItem.reason,'duplicate');
assert.equal(P.rememberLootReceipt(persistedLootReceipts,'peer-a',78).ok,true);
assert.equal(P.rememberLootReceipt(persistedLootReceipts,'peer-c',77).ok,true);
assert.equal(P.lootReceiptKey('peer-a','invalid'),null);
assert.equal(P.lootReceiptKey('','77'),null);

let boundedLoot=[];
let oldestLootKey=null;
for(let i=1;i<=P.MAX_LOOT_RECEIPTS+3;i++){
  if(i===1)oldestLootKey=P.lootReceiptKey('peer-a',i);
  const result=P.rememberLootReceipt(boundedLoot,'peer-a',i);
  assert.equal(result.ok,true);
  boundedLoot=result.receipts;
}
assert.equal(boundedLoot.length,P.MAX_LOOT_RECEIPTS);
assert.equal(boundedLoot.includes(oldestLootKey),false,'loot receipt history must remain bounded');

const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert.match(index,/protocol\.deathReceiptKey\(m\.peer,d\.event\)/,
  'the browser receiver must check the persisted receipt before applying PvP loot');
assert.match(index,/protocol\.rememberDeathReceipt\(sv\.pk\.receipts,m\.peer,d\.event\)/,
  'the browser receiver must persist a receipt for each accepted PvP death');
assert.match(index,/sv\.pk\.receipts=receipt\.receipts/,
  'death receipt history must be part of the existing save payload');
assert.match(index,/protocol\.lootReceiptKey\(m\.peer,x&&x\.u\)/,
  'the browser receiver must identify each source item independently of the death event');
assert.match(index,/protocol\.rememberLootReceipt\(sv\.pk\.lootReceipts,m\.peer,x\.u\)/,
  'the browser receiver must persist a receipt for each transferred source item');
assert.match(index,/sv\.pk\.lootReceipts=lootReceipt\.receipts/,
  'item receipt history must be part of the existing save payload');


const pendingTransfer={peer:'peer-a',event:death,items:[{u:77},{u:78}]};
const ack=P.createLootAckPacket({to:'peer-b',event:death,accepted:[77],rejected:['78']});
assert.deepEqual(ack,{v:1,to:'peer-b',sid:'death-session-a',seq:1,accepted:['77'],rejected:['78']});
const checkedAck=P.validateLootAck(ack,{senderId:'peer-a',recipientId:'peer-b'},pendingTransfer);
assert.equal(checkedAck.ok,true);
assert.deepEqual(checkedAck.accepted,['77']);
assert.deepEqual(checkedAck.rejected,['78']);
assert.equal(checkedAck.complete,true);
assert.equal(P.validateLootAck(ack,{senderId:'peer-c',recipientId:'peer-b'},pendingTransfer).reason,'wrong_peer');
assert.equal(P.validateLootAck({...ack,to:'peer-c'},{senderId:'peer-a',recipientId:'peer-b'},pendingTransfer).reason,'wrong_peer');
assert.equal(P.validateLootAck({...ack,seq:2},{senderId:'peer-a',recipientId:'peer-b'},pendingTransfer).reason,'wrong_event');
assert.equal(P.validateLootAck({...ack,seq:'1'},{senderId:'peer-a',recipientId:'peer-b'},pendingTransfer).reason,'wrong_event',
  'acknowledgement sequence must be an integer, not a coercible string');
assert.equal(P.validateLootAck({...ack,accepted:['99']},{senderId:'peer-a',recipientId:'peer-b'},pendingTransfer).reason,'unknown_item');
assert.equal(P.createLootAckPacket({to:'peer-b',event:death,accepted:['77','77'],rejected:[]}),null);
assert.equal(P.createLootAckPacket({to:'peer-b',event:death,accepted:['77'],rejected:['77']}),null);
assert.equal(P.createLootAckPacket({to:'peer-b',event:death,accepted:['NaN'],rejected:[]}),null);
const partialAck=P.createLootAckPacket({to:'peer-b',event:death,accepted:['77'],rejected:[]});
const partialChecked=P.validateLootAck(partialAck,{senderId:'peer-a',recipientId:'peer-b'},pendingTransfer);
assert.equal(partialChecked.ok,true);
assert.equal(partialChecked.complete,false,'partial acknowledgements must leave unconfirmed items in escrow');
assert.equal(P.validateLootAck(partialAck,{senderId:'peer-a',recipientId:'peer-b'},{
  ...pendingTransfer,event:{...death,seq:3}
}).reason,'wrong_event');


const indexSource=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert.ok(indexSource.includes('sv.pk.pendingTransfers'),
  'outgoing PvP items must remain in persisted escrow until acknowledged');
assert.ok(indexSource.includes("room.on('pvpack'"),
  'the sender must listen for recipient loot acknowledgements');
assert.ok(indexSource.includes('protocol.validateLootAck'),
  'loot acknowledgements must be validated against the expected peer and pending event');
assert.ok(indexSource.includes('protocol.createLootAckPacket'),
  'the receiver must send structured acknowledgements');
assert.ok(indexSource.includes('pvpTransferRetry'),
  'pending transfers must be retried after connection recovery');
assert.ok(indexSource.includes('PV.durableTransferReceipts'),
  'the receiver must only acknowledge transfer outcomes after durable local save');
assert.ok(indexSource.includes('const saved=save(true)'),
  'the sender must persist escrow before emitting the PvP death event');

console.log('Aetheria PvP death protocol: recipient, sequence, replay, cross-session cooldown, persisted idempotency receipts and bounded history passed.');
