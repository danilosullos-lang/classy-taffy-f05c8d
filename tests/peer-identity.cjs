'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../assets/social/peer-identity.js'),'utf8'),
  {filename:'assets/social/peer-identity.js'});
const identity=globalThis.AetheriaPeerIdentity;

assert.ok(identity);
assert.equal(identity.KEY,'aetheria.p2p.client-id.v1');
assert.equal(identity.isValid('00010203-0405-4607-8809-0a0b0c0d0e0f'),true);
assert.equal(identity.isValid('00010203-0405-0607-0809-0a0b0c0d0e0f'),false);
assert.equal(identity.isValid('../not-an-id'),false);
assert.equal(identity.isValid(''),false);

function memoryStorage(initial){
  const values=new Map(Object.entries(initial||{}));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    values
  };
}
let randomCalls=0;
const cryptoApi={getRandomValues(bytes){
  randomCalls++;
  for(let i=0;i<bytes.length;i++)bytes[i]=i;
  return bytes;
}};
const storage=memoryStorage();
const first=identity.getOrCreate({storage,crypto:cryptoApi});
assert.equal(first,'00010203-0405-4607-8809-0a0b0c0d0e0f');
assert.equal(storage.getItem(identity.KEY),first);
assert.equal(identity.getOrCreate({storage,crypto:cryptoApi}),first);
assert.equal(randomCalls,1,'the stable identity must survive reload without regeneration');

const invalidStorage=memoryStorage({[identity.KEY]:'peer-id-from-old-build'});
const replaced=identity.getOrCreate({storage:invalidStorage,crypto:cryptoApi});
assert.equal(replaced,first,'invalid stored identities must be replaced with a valid UUID');
assert.equal(randomCalls,2);

assert.equal(identity.getOrCreate({storage,crypto:{}}),null,
  'identity creation must fail closed when secure randomness is unavailable');
assert.equal(identity.getOrCreate({storage:{getItem(){throw Error('blocked')}},crypto:cryptoApi}),null,
  'storage errors must not crash the game');

const peerA={peer:'transient-a',isMe:false,presence:{clientId:first,name:'A'}};
const peerB={peer:'transient-b',isMe:false,presence:{clientId:'invalid',name:'B'}};
const self={peer:'self-id',isMe:true,presence:{clientId:first}};
const peers=[self,peerA,peerB];
assert.equal(identity.resolve(peers,'transient-a'),first);
assert.equal(identity.resolve(peers,'transient-b'),null);
assert.equal(identity.resolve(peers,'missing'),null);
assert.equal(identity.resolve(peers,'self-id'),null,'local identity must not be resolved as a remote peer');
assert.equal(identity.findPeer(peers,first),peerA);
assert.equal(identity.findPeer(peers,'transient-a'),peerA,'legacy transient routing must remain available');
assert.equal(identity.findPeer(peers,'transient-b'),peerB);
assert.equal(identity.findPeer(peers,'unknown'),null);

const reconnected={peer:'new-transient-a',isMe:false,presence:{clientId:first,name:'A'}};
assert.equal(identity.findPeer([reconnected],first),reconnected,
  'a stable identity must resolve after Trystero assigns a new transient peer id');
assert.equal(identity.resolve([reconnected],'new-transient-a'),first);

console.log('Aetheria stable P2P identity: UUID persistence, storage failure, peer resolution and reconnect routing passed.');
