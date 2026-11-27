const assert=require('node:assert/strict');
require('../assets/engine/account-client.js');
const {AccountClient}=globalThis.AetheriaAccount;
const memory=new Map();
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const client=new AccountClient({base:'/api',storage});
assert.equal(client.authenticated,false);
assert.equal(client.accountId,'','an old or anonymous session has no trusted account scope');
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

    const userId='20000000-0000-4000-8000-000000000001';
    global.fetch=async(url,options)=>({ok:true,status:200,json:async()=>({token:'new-session-token',user:{id:userId,email:'player@example.invalid'}})});
    const user=await client.login('player@example.invalid','a-long-test-password');
    assert.equal(user.id,userId);
    assert.equal(client.accountId,userId,'login stores the server-returned account ID for local sync scoping');
    assert.equal(storage.getItem('aetheria.account.user.v1'),userId);
    assert.equal(client.token,'new-session-token');
    client.logout();
    assert.equal(client.authenticated,false);
    assert.equal(client.accountId,'','logout clears both token and account scope');
    assert.equal(storage.getItem('aetheria.account.user.v1'),null);
    console.log('Aetheria account client: revision preconditions and conflict propagation passed.');
  }finally{global.fetch=originalFetch;}
})().catch(error=>{console.error(error);process.exitCode=1;});
