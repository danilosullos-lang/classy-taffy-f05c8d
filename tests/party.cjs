const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const moduleSandbox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(require.resolve('../assets/social/party.js'), 'utf8'), moduleSandbox);
const Party = moduleSandbox.module.exports;

let clock = 1000;
const online = new Set(['leader','member-a','member-b','member-c','member-d']);
const make = id => {
  const sent = [];
  const changes = [];
  const api = Party.create({
    selfId:id,
    now:()=>clock,
    peerExists:peer=>online.has(peer),
    send:(type,data)=>sent.push({type,data}),
    onChange:snapshot=>changes.push(snapshot)
  });
  return {api,sent,changes};
};

const leader=make('leader');
assert.equal(Party.MAX_MEMBERS,5);
assert.equal(leader.api.invite('member-a','Líder Aetheria'),true);
const inviteA=leader.sent.at(-1);
assert.equal(inviteA.type,'partyInvite');
assert.equal(inviteA.data.to,'member-a');
assert.equal(leader.api.snapshot().party.isLeader,true);

const memberA=make('member-a');
assert.equal(memberA.api.receive('partyInvite','leader',inviteA.data),true);
assert.equal(memberA.api.snapshot().invites.length,1);
assert.equal(memberA.api.accept(inviteA.data.partyId),true);
const acceptA=memberA.sent.at(-1);
assert.equal(leader.api.receive(acceptA.type,'member-a',acceptA.data),true);
const stateA=leader.sent.filter(x=>x.type==='partyState'&&x.data.to==='member-a').at(-1);
assert.equal(memberA.api.receive(stateA.type,'leader',stateA.data),true);
assert.deepEqual(Array.from(leader.api.snapshot().party.members),['leader','member-a']);
assert.deepEqual(Array.from(memberA.api.snapshot().party.members),['leader','member-a']);

assert.equal(leader.api.invite('member-b','Líder Aetheria'),true);
const inviteB=leader.sent.at(-1);
const memberB=make('member-b');
assert.equal(memberB.api.receive('partyInvite','leader',inviteB.data),true);
assert.equal(memberB.api.accept(inviteB.data.partyId),true);
assert.equal(leader.api.receive(memberB.sent.at(-1).type,'member-b',memberB.sent.at(-1).data),true);
const stateB=leader.sent.filter(x=>x.type==='partyState'&&x.data.to==='member-b').at(-1);
assert.equal(memberB.api.receive(stateB.type,'leader',stateB.data),true);
const updateA=leader.sent.filter(x=>x.type==='partyState'&&x.data.to==='member-a').at(-1);
assert.equal(memberA.api.receive(updateA.type,'leader',updateA.data),true);
assert.equal(leader.api.snapshot().party.members.length,3);

assert.equal(leader.api.invite('member-c','Líder Aetheria'),true);
const inviteC=leader.sent.at(-1),memberC=make('member-c');
assert.equal(memberC.api.receive('partyInvite','leader',inviteC.data),true);
assert.equal(memberC.api.accept(inviteC.data.partyId),true);
assert.equal(leader.api.receive(memberC.sent.at(-1).type,'member-c',memberC.sent.at(-1).data),true);
assert.equal(leader.api.invite('member-d','Líder Aetheria'),true);
const inviteD=leader.sent.at(-1),memberD=make('member-d');
assert.equal(memberD.api.receive('partyInvite','leader',inviteD.data),true);
assert.equal(memberD.api.accept(inviteD.data.partyId),true);
assert.equal(leader.api.receive(memberD.sent.at(-1).type,'member-d',memberD.sent.at(-1).data),true);
assert.equal(leader.api.snapshot().party.members.length,5);
assert.equal(leader.api.invite('offline','Líder Aetheria'),false);
assert.equal(leader.api.invite('member-a','Líder Aetheria'),false);
assert.equal(leader.api.invite('missing','Líder Aetheria'),false);

assert.equal(memberA.api.leave(),true);
const leaveA=memberA.sent.at(-1);
assert.equal(leaveA.type,'partyLeave');
assert.equal(leader.api.receive(leaveA.type,'member-a',leaveA.data),true);
assert.equal(leader.api.snapshot().party.members.includes('member-a'),false);
assert.equal(memberA.api.snapshot().party,null);

const refreshedB=leader.sent.filter(x=>x.type==='partyState'&&x.data.to==='member-b').at(-1);
assert.equal(memberB.api.receive(refreshedB.type,'leader',refreshedB.data),true);
assert.equal(memberB.api.snapshot().party.members.length,4);

assert.equal(leader.api.leave(),true);
assert.equal(leader.api.snapshot().party,null);
const disbandB=leader.sent.filter(x=>x.type==='partyDisband'&&x.data.to==='member-b').at(-1);
assert.ok(disbandB);
assert.equal(memberB.api.receive(disbandB.type,'leader',disbandB.data),true);
assert.equal(memberB.api.snapshot().party,null);

const expLeader=make('leader');
assert.equal(expLeader.api.invite('member-a','Líder'),true);
const expInvite=expLeader.sent.at(-1);
const expMember=make('member-a');
assert.equal(expMember.api.receive('partyInvite','leader',expInvite.data),true);
clock += Party.INVITE_TTL_MS + 1;
assert.equal(expMember.api.accept(expInvite.data.partyId),false);
assert.equal(expMember.api.snapshot().invites.length,0);
assert.equal(expLeader.api.snapshot().pending.length,0);

const declineLeader=make('leader');
assert.equal(declineLeader.api.invite('member-c','Líder'),true);
const declineInvite=declineLeader.sent.at(-1),declineMember=make('member-c');
assert.equal(declineMember.api.receive('partyInvite','leader',declineInvite.data),true);
assert.equal(declineMember.api.decline(declineInvite.data.partyId),true);
assert.equal(declineMember.sent.at(-1).type,'partyDecline');
assert.equal(declineLeader.api.receive(declineMember.sent.at(-1).type,'member-c',declineMember.sent.at(-1).data),true);
assert.equal(declineLeader.api.snapshot().pending.length,0);
assert.equal(declineLeader.api.snapshot().party,null);

const cleanupLeader=make('leader');
assert.equal(cleanupLeader.api.invite('member-a','Líder'),true);
const cleanupInvite=cleanupLeader.sent.at(-1);
const cleanupMember=make('member-a');
assert.equal(cleanupMember.api.receive('partyInvite','leader',cleanupInvite.data),true);
assert.equal(cleanupMember.api.accept(cleanupInvite.data.partyId),true);
assert.equal(cleanupLeader.api.receive(cleanupMember.sent.at(-1).type,'member-a',cleanupMember.sent.at(-1).data),true);
online.delete('member-a');
cleanupLeader.api.onPeers([{peer:'leader',isMe:true}]);
assert.equal(cleanupLeader.api.snapshot().party,null);

const invalid=make('member-a');
assert.equal(invalid.api.receive('partyInvite','leader',{to:'other',partyId:'x',leader:'leader',expiresAt:clock+1000}),false);
assert.equal(invalid.api.receive('partyState','leader',{to:'member-a',partyId:'x',leader:'leader',members:['leader','other']}),false);
assert.equal(invalid.api.receive('partyDisband','leader',{to:'member-a',partyId:'x'}),false);
assert.ok(leader.changes.length>0);
console.log('party tests: PASS');
