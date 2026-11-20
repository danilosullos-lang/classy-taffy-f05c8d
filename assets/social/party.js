(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AetheriaParty=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const MAX_MEMBERS=5;
const INVITE_TTL_MS=60000;
const cleanId=value=>typeof value==='string'&&value.length>0&&value.length<=128?value:null;

function create(options={}){
  const selfId=cleanId(options.selfId);
  if(!selfId)throw new TypeError('party_self_id_required');
  const send=typeof options.send==='function'?options.send:()=>{};
  const peerExists=typeof options.peerExists==='function'?options.peerExists:()=>false;
  const now=typeof options.now==='function'?options.now:()=>Date.now();
  const onChange=typeof options.onChange==='function'?options.onChange:()=>{};
  let party=null;
  const invites=[];
  const pending=new Map();

  const online=id=>{
    if(id===selfId)return true;
    try{return !!peerExists(id)}catch{return false}
  };
  const emit=(type,data)=>{
    try{
      const result=send(type,data);
      if(result&&typeof result.catch==='function')result.catch(()=>{});
      return true;
    }catch{return false}
  };
  const notify=()=>{try{onChange(snapshot())}catch{}};
  const expire=()=>{
    const time=now();
    let changed=false;
    for(let i=invites.length-1;i>=0;i--){
      if(invites[i].expiresAt<=time){invites.splice(i,1);changed=true}
    }
    for(const [id,expiresAt] of pending){
      if(expiresAt<=time){pending.delete(id);changed=true}
    }
    if(party&&party.leader===selfId&&party.members.length===1&&!pending.size){party=null;changed=true}
    return changed;
  };
  const snapshot=()=>{
    expire();
    return {
      party:party?{id:party.id,leader:party.leader,members:[...party.members],isLeader:party.leader===selfId,revision:party.revision}:null,
      invites:invites.map(item=>({...item})),
      pending:[...pending.keys()]
    };
  };
  const broadcast=()=>{
    if(!party||party.leader!==selfId)return;
    party.revision=(Number.isSafeInteger(party.revision)?party.revision:0)+1;
    const members=[...party.members];
    for(const to of members){
      if(to===selfId)continue;
      emit('partyState',{to,partyId:party.id,leader:selfId,members,revision:party.revision,issuedAt:now()});
    }
  };

  function invite(peerId,leaderName=''){
    expire();
    const target=cleanId(peerId);
    if(!target||target===selfId||!online(target))return false;
    if(!party)party={id:selfId.slice(0,80)+':'+now().toString(36)+':'+Math.random().toString(36).slice(2,8),leader:selfId,members:[selfId],revision:0};
    if(party.leader!==selfId||party.members.length>=MAX_MEMBERS||party.members.includes(target)||pending.has(target))return false;
    const expiresAt=now()+INVITE_TTL_MS;
    pending.set(target,expiresAt);
    const sent=emit('partyInvite',{to:target,partyId:party.id,leader:selfId,leaderName:String(leaderName||'Jogador').slice(0,24),expiresAt});
    if(!sent){
      pending.delete(target);
      if(party.members.length===1&&!pending.size)party=null;
      return false;
    }
    notify();
    return true;
  }

  function accept(partyId){
    expire();
    const index=invites.findIndex(item=>item.partyId===partyId);
    if(index<0)return false;
    const invite=invites[index];
    if(party&&party.id!==invite.partyId)return false;
    if(!online(invite.fromPeer)){invites.splice(index,1);notify();return false}
    party={id:invite.partyId,leader:invite.fromPeer,members:[invite.fromPeer,selfId],revision:0};
    invites.splice(index,1);
    emit('partyAccept',{to:invite.fromPeer,partyId:invite.partyId});
    notify();
    return true;
  }

  function decline(partyId){
    expire();
    const index=invites.findIndex(item=>item.partyId===partyId);
    if(index<0)return false;
    const invite=invites[index];
    invites.splice(index,1);
    emit('partyDecline',{to:invite.fromPeer,partyId:invite.partyId});
    notify();
    return true;
  }

  function leave(){
    if(!party)return false;
    const current=party;
    if(current.leader===selfId){
      current.members.filter(id=>id!==selfId).forEach(to=>emit('partyDisband',{to,partyId:current.id,leader:selfId}));
    }else{
      emit('partyLeave',{to:current.leader,partyId:current.id});
    }
    party=null;
    invites.splice(0,invites.length);
    pending.clear();
    notify();
    return true;
  }

  function receive(type,peerId,data={}){
    const from=cleanId(peerId);
    if(!from||from===selfId||!data||typeof data!=='object')return false;
    expire();

    if(type==='partyInvite'){
      const partyId=cleanId(data.partyId),expiresAt=Number(data.expiresAt);
      if(data.to!==selfId||data.leader!==from||!partyId||!online(from)||
          !Number.isFinite(expiresAt)||expiresAt<=now()||expiresAt>now()+INVITE_TTL_MS+5000||
          (party&&party.id!==partyId))return false;
      if(party&&party.id===partyId)return false;
      const item={partyId,fromPeer:from,leaderName:String(data.leaderName||'Jogador').slice(0,24),expiresAt};
      const old=invites.findIndex(invite=>invite.partyId===partyId);
      if(old>=0)invites[old]=item;else invites.push(item);
      notify();
      return true;
    }

    if(type==='partyAccept'){
      const expiry=pending.get(from);
      if(!party||party.leader!==selfId||data.to!==selfId||data.partyId!==party.id||!expiry||expiry<=now())return false;
      pending.delete(from);
      if(!online(from)||party.members.includes(from)||party.members.length>=MAX_MEMBERS){
        emit('partyReject',{to:from,partyId:party.id,leader:selfId});
        notify();
        return false;
      }
      party.members.push(from);
      broadcast();
      notify();
      return true;
    }

    if(type==='partyDecline'){
      const expiry=pending.get(from);
      if(!party||party.leader!==selfId||data.to!==selfId||data.partyId!==party.id||!expiry)return false;
      pending.delete(from);
      if(party.members.length===1&&!pending.size)party=null;
      notify();
      return true;
    }

    if(type==='partyState'){
      if(!party||party.id!==data.partyId||party.leader!==from||data.to!==selfId||data.leader!==from||
          !Array.isArray(data.members)||data.members.length<2||data.members.length>MAX_MEMBERS)return false;
      const revision=data.revision;
      const currentRevision=Number.isSafeInteger(party.revision)?party.revision:0;
      if(!Number.isSafeInteger(revision)||revision<=currentRevision)return false;
      const members=[];
      for(const raw of data.members){
        const id=cleanId(raw);
        if(!id||members.includes(id))return false;
        members.push(id);
      }
      if(!members.includes(selfId)||!members.includes(from))return false;
      party.members=members;
      party.revision=revision;
      notify();
      return true;
    }

    if(type==='partyLeave'){
      if(!party||party.leader!==selfId||data.to!==selfId||data.partyId!==party.id||!party.members.includes(from))return false;
      party.members=party.members.filter(id=>id!==from);
      if(party.members.length<=1&&!pending.size)party=null;
      else broadcast();
      notify();
      return true;
    }

    if(type==='partyDisband'||type==='partyReject'){
      if(!party||party.id!==data.partyId||party.leader!==from||data.to!==selfId)return false;
      party=null;
      invites.splice(0,invites.length);
      pending.clear();
      notify();
      return true;
    }
    return false;
  }

  function onPeers(peers){
    expire();
    const ids=new Set((Array.isArray(peers)?peers:[]).map(peer=>cleanId(peer&&peer.peer)).filter(Boolean));
    ids.add(selfId);
    if(!party)return;
    if(party.leader===selfId){
      const members=party.members.filter(id=>ids.has(id));
      if(members.length!==party.members.length){
        party.members=members;
        if(party.members.length<=1&&!pending.size)party=null;
        else broadcast();
        notify();
      }
    }else if(!ids.has(party.leader)){
      party=null;
      notify();
    }
  }

  return Object.freeze({invite,accept,decline,leave,receive,onPeers,snapshot});
}

return Object.freeze({create,MAX_MEMBERS,INVITE_TTL_MS});
});
