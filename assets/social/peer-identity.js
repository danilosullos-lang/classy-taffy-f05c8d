/* Stable, non-secret per-install identity for reconnecting the existing P2P room. */
(function(root){
  'use strict';
  const KEY='aetheria.p2p.client-id.v1';
  const UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function isValid(value){return typeof value==='string'&&UUID_V4.test(value);}
  function getOrCreate(options){
    options=options||{};
    const storage=options.storage||root.localStorage;
    const cryptoApi=options.crypto||root.crypto;
    const key=typeof options.key==='string'&&options.key?options.key:KEY;
    try{
      if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||
         !cryptoApi||typeof cryptoApi.getRandomValues!=='function')return null;
      const existing=storage.getItem(key);
      if(isValid(existing))return existing.toLowerCase();
      const bytes=new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      bytes[6]=(bytes[6]&0x0f)|0x40;
      bytes[8]=(bytes[8]&0x3f)|0x80;
      const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
      const id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
      storage.setItem(key,id);
      return id;
    }catch(_){return null;}
  }
  function resolve(peers,transientPeerId){
    if(!Array.isArray(peers)||typeof transientPeerId!=='string'||!transientPeerId)return null;
    const peer=peers.find(entry=>entry&&!entry.isMe&&entry.peer===transientPeerId);
    const id=peer&&peer.presence&&peer.presence.clientId;
    return isValid(id)?id.toLowerCase():null;
  }
  function findPeer(peers,identity){
    if(!Array.isArray(peers)||typeof identity!=='string'||!identity)return null;
    return peers.find(entry=>entry&&!entry.isMe&&
      (entry.peer===identity||(entry.presence&&isValid(entry.presence.clientId)&&
       entry.presence.clientId.toLowerCase()===identity.toLowerCase())))||null;
  }
  root.AetheriaPeerIdentity=Object.freeze({KEY,isValid,getOrCreate,resolve,findPeer});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.AetheriaPeerIdentity;
})(typeof window!=='undefined'?window:globalThis);
