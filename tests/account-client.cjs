const assert=require('node:assert/strict');
require('../assets/engine/account-client.js');
const {AccountClient}=globalThis.AetheriaAccount;
const memory=new Map();
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const client=new AccountClient({base:'/api',storage});
assert.equal(client.authenticated,false);
client.token='session-token';
assert.equal(client.authenticated,true);
assert.equal(client.token,'session-token');

(async()=>{
  const originalFetch=global.fetch;
  const calls=[];
  try{
    global.fetch=async(url,options)=>{
      calls.push({url,options});
      return {ok:true,status:200,json:async()=>({character:{id:'00000000-0000-4000-8000-000000000001',revision:5}})};
    };
    const saved=await client.saveCharacter({slot:0,expectedRevision:4,name:'Aventureiro'});
    assert.equal(saved.revision,5);
    assert.equal(calls[0].url,'/api/characters');
    assert.equal(calls[0].options.method,'PUT');
    assert.equal(calls[0].options.headers.Authorization,'Bearer session-token');
    assert.equal(JSON.parse(calls[0].options.body).expectedRevision,4);
    await assert.rejects(()=>client.saveCharacter({slot:0}),error=>error.status===400&&error.message==='expected_revision_required');

    global.fetch=async()=>({ok:false,status:409,json:async()=>({error:'character_revision_conflict'})});
    await assert.rejects(()=>client.saveCharacter({slot:0,expectedRevision:4}),error=>error.status===409&&error.message==='character_revision_conflict');
    client.logout();
    assert.equal(client.authenticated,false);
    console.log('Aetheria account client: revision preconditions and conflict propagation passed.');
  }finally{global.fetch=originalFetch;}
})().catch(error=>{console.error(error);process.exitCode=1;});
