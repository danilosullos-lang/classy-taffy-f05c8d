const assert=require('node:assert/strict');
require('../assets/engine/account-client.js');
const {AccountClient}=globalThis.AetheriaAccount;
const memory=new Map();const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const client=new AccountClient({storage});
assert.equal(client.authenticated,false);client.token='session-token';assert.equal(client.authenticated,true);assert.equal(client.token,'session-token');client.logout();assert.equal(client.token,'');console.log('Aetheria account client: all tests passed.');
