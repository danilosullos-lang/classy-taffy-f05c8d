(function(){
'use strict';
function boot(){
if(!window.AetheriaAccount||!window.AetheriaGameBridge||!window.AetheriaCloudSyncQueue)return;
const api=window.AetheriaAccount.create();
const AUTO_SYNC_PREFIX='aetheria.cloud.autosync.v2:';
const PENDING_SYNC_PREFIX='aetheria.cloud.pending.v2:';
// The old v1 keys were shared by every account in a browser profile. Keep them untouched,
// but never import them into an account-scoped queue or checkpoint.
function scopedStorageKey(prefix){const accountId=api.accountId;return accountId?prefix+accountId:'';}
const el=(tag,attrs,parent)=>{
  const node=document.createElement(tag);
  Object.entries(attrs||{}).forEach(([key,value])=>key==='text'?node.textContent=value:node.setAttribute(key,value));
  if(parent)parent.appendChild(node);
  return node;
};
const css=el('style',{},document.head);
css.textContent='#aetheria-account{position:fixed;z-index:12000;inset:0;display:none;align-items:center;justify-content:center;background:#080611ed;padding:16px;color:white;font:14px system-ui}#aetheria-account section{width:min(420px,100%);max-height:90dvh;overflow:auto;background:#20162f;border:1px solid #b99b58;border-radius:16px;padding:18px}#aetheria-account input,#aetheria-account select{display:block;width:100%;padding:11px;margin:8px 0;background:#120d1b;color:white;border:1px solid #655477;border-radius:8px}#aetheria-account button{padding:10px;margin:5px 4px 5px 0;border:0;border-radius:8px;background:#75502b;color:white;font-weight:700}#aetheria-account button:focus-visible,#aetheria-account input:focus-visible,#aetheria-account select:focus-visible{outline:2px solid #ffd36b;outline-offset:2px}#aetheria-auto-sync{display:flex;align-items:center;gap:9px;margin:12px 0;padding:10px;border:1px solid #655477;border-radius:9px;background:#171020}#aetheria-auto-sync input{width:20px;height:20px;margin:0;flex:0 0 auto}#aetheria-auto-sync span{line-height:1.35}#aetheria-auto-sync input:disabled+span{opacity:.55}';
const modal=el('div',{id:'aetheria-account','role':'dialog','aria-modal':'true','aria-label':'Conta Aetheria'},document.body);
const card=el('section',{},modal);
el('h2',{text:'Conta Aetheria'},card);
el('p',{text:'O save local continua funcionando. A sincronização automática é opcional; antes de ativá-la, salve ou restaure o personagem para confirmar a cópia inicial.'},card);
const email=el('input',{type:'email',placeholder:'E-mail',autocomplete:'username','aria-label':'E-mail'},card);
const pass=el('input',{type:'password',placeholder:'Senha (mínimo 10 caracteres)',minlength:'10',autocomplete:'current-password','aria-label':'Senha'},card);
const status=el('p',{text:'Modo offline ativo. O progresso local não será alterado.'},card);
const cloud=el('div',{},card);
const slots=el('select',{'aria-label':'Personagem ou espaço de save'},cloud);
const autoLabel=el('label',{id:'aetheria-auto-sync'},cloud);
const autoSync=el('input',{type:'checkbox',id:'aetheria-auto-sync-toggle'},autoLabel);
const autoText=el('span',{text:'Sincronizar automaticamente as alterações locais na nuvem'},autoLabel);
function readAutoPreference(){const key=scopedStorageKey(AUTO_SYNC_PREFIX);if(!key)return false;try{return localStorage.getItem(key)==='1';}catch(_){return false;}}
function writeAutoPreference(value){const key=scopedStorageKey(AUTO_SYNC_PREFIX);if(!key)return false;try{localStorage.setItem(key,value?'1':'0');return true;}catch(_){return false;}}
function readPending(){const key=scopedStorageKey(PENDING_SYNC_PREFIX);if(!key)return null;try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:null;}catch(_){return null;}}
function writePending(value){const key=scopedStorageKey(PENDING_SYNC_PREFIX);if(!key)return false;try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
function clearPending(){const key=scopedStorageKey(PENDING_SYNC_PREFIX);if(!key)return false;try{localStorage.removeItem(key);return true;}catch(_){return false;}}
function fingerprint(payload){
  const source=JSON.stringify({v:payload&&payload.v,sv:payload&&payload.sv,inv:payload&&payload.inv,uid:payload&&payload.uid});
  let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<source.length;i++){const code=source.charCodeAt(i);a=Math.imul(a^code,16777619);b=Math.imul(b^(code+i),2246822519);}
  return source.length.toString(36)+':'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
function localFingerprint(){return fingerprint(window.AetheriaGameBridge.getSave());}
autoSync.checked=readAutoPreference();
const button=(label,parent,fn)=>{
  const node=el('button',{type:'button',text:label},parent);
  node.onclick=fn;
  return node;
};
function setAuthView(authenticated){
  const accountScoped=authenticated&&!!api.accountId;
  email.style.display=accountScoped?'none':'block';
  pass.style.display=accountScoped?'none':'block';
  cloud.style.display=authenticated?'block':'none';
  autoSync.disabled=!accountScoped;
  autoSync.checked=accountScoped&&readAutoPreference();
  autoText.textContent=!authenticated?'Entre para habilitar a sincronização automática':!api.accountId?'Entre novamente para associar a sessão à conta antes de sincronizar':'Sincronizar automaticamente as alterações locais na nuvem';
}
let baselineReady=false,baselineSlot='',lastSyncedFingerprint='',lastScheduledFingerprint='';
function reconcileBaseline(){
  const selected=slots.selectedOptions&&slots.selectedOptions[0];
  if(!selected){baselineReady=false;baselineSlot='';return 'mismatch';}
  const local=localFingerprint();
  let cloudData={};try{cloudData=JSON.parse(selected.dataset.data||'{}')||{};}catch(_){}
  const cloudFp=cloudData&&cloudData.sv?fingerprint(cloudData):'';
  const pending=readPending();
  baselineSlot=selected.value;
  if(cloudFp&&cloudFp===local){
    clearPending();
    lastSyncedFingerprint=local;
    lastScheduledFingerprint='';
    baselineReady=true;
    return 'matched';
  }
  const pendingMatches=!!(pending&&Number(pending.slot)===Number(selected.dataset.slot)&&
    Number(pending.revision)===Number(selected.dataset.revision)&&pending.fingerprint===local&&
    ((pending.id&&String(pending.id)===selected.value)||(!pending.id&&selected.value.startsWith('new:'))));
  if(pendingMatches){
    baselineReady=true;
    lastScheduledFingerprint=local;
    return 'pending';
  }
  baselineReady=false;
  lastSyncedFingerprint=cloudFp;
  lastScheduledFingerprint='';
  return 'mismatch';
}
function disableAutoSync(message){
  autoSync.checked=false;
  writeAutoPreference(false);
  queue.pause();
  if(message)status.textContent=message;
}
async function list(){
  const accountId=api.accountId;
  const previous=slots.value;
  try{
    const characters=await api.listCharacters();
    if(accountId!==api.accountId)return [];
    slots.replaceChildren();
    const occupied=new Set();
    characters.forEach(character=>{
      const slot=Number(character.slot);
      occupied.add(slot);
      const option=el('option',{value:character.id,text:character.name+' · Nv.'+character.level+' · '+character.classId},slots);
      option.dataset.data=JSON.stringify(character.data||{});
      option.dataset.revision=String(Number(character.revision)||1);
      option.dataset.slot=String(slot);
    });
    for(let slot=0;slot<6;slot++){
      if(occupied.has(slot))continue;
      const option=el('option',{value:'new:'+slot,text:'Novo personagem · espaço '+(slot+1)},slots);
      option.dataset.data='';
      option.dataset.revision='0';
      option.dataset.slot=String(slot);
    }
    const pending=readPending();
    const pendingOption=pending&&Array.from(slots.options).find(option=>Number(option.dataset.slot)===Number(pending.slot)&&(!pending.id||option.value===String(pending.id)));
    if(pendingOption)slots.value=pendingOption.value;
    else if(Array.from(slots.options).some(option=>option.value===previous))slots.value=previous;
    else if(characters.length)slots.value=String(characters[0].id);
    else slots.value='new:0';
    status.textContent='Conta conectada. '+characters.length+' personagem(ns) na nuvem.';
    const baseline=reconcileBaseline();
    if(autoSync.checked){
      if(baseline==='matched')queue.resume({schedule:false});
      else if(baseline==='pending')queue.resume({schedule:true});
      else disableAutoSync('O save local e o da nuvem são diferentes. Restaure a cópia desejada ou faça um salvamento manual antes de reativar a sincronização automática.');
    }
    return characters;
  }catch(error){
    status.textContent='Não foi possível atualizar a lista: '+error.message;
    throw error;
  }
}
let cloudSaveInFlight=null;
function saveCloudCore({automatic=false}={}){
  if(cloudSaveInFlight)return cloudSaveInFlight;
  const task=(async()=>{
    const accountId=api.accountId;
    const selected=slots.selectedOptions&&slots.selectedOptions[0];
    if(!selected)throw new Error('Selecione um espaço de personagem.');
    const payload=window.AetheriaGameBridge.getSave();
    const localFp=fingerprint(payload);
    const state=payload.sv||{},checkpoint=state.cp||{};
    const name=String(state.name||'Aventureiro').replace(/[<>]/g,'').trim().slice(0,20)||'Aventureiro';
    const slot=Number(selected.dataset.slot),expectedRevision=Number(selected.dataset.revision);
    if(!Number.isInteger(slot)||slot<0||slot>5||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
      throw new Error('Espaço de save inválido.');
    if(automatic){
      const pending=readPending();
      if(!baselineReady||baselineSlot!==selected.value||!pending||Number(pending.slot)!==slot||Number(pending.revision)!==expectedRevision||pending.fingerprint!==localFp||
        (pending.id&&String(pending.id)!==selected.value))
        throw Object.assign(new Error('cloud_sync_checkpoint_mismatch'),{status:409});
    }
    const character={
      slot,name:name.length>=3?name:'Aventureiro',race:state.race||'human',classId:state.job||'novice',
      level:Math.max(1,Math.min(80,Math.floor(Number(state.lv)||1))),
      mapId:/^[a-z0-9_-]{2,64}$/.test(String(state.mapId||''))?String(state.mapId):'talking_island',
      position:{x:Number(checkpoint.x)||0,y:Number(checkpoint.y)||0,z:Number(checkpoint.z)||0},
      vitals:{
        hp:Number.isFinite(Number(state.hp))?Math.max(0,Number(state.hp)):100,
        mp:Number.isFinite(Number(state.mp))?Math.max(0,Number(state.mp)):50
      },
      data:payload,
      expectedRevision
    };
    if(!selected.value.startsWith('new:'))character.id=selected.value;
    const wasDisabled=slots.disabled;
    slots.disabled=true;
    try{
      let result;
      try{result=await api.saveCharacter(character);}
      catch(error){
        if(error.status===409||error.message==='character_revision_conflict'){
          try{await list();}catch(_){}
        }
        throw error;
      }
      if(accountId!==api.accountId)throw Object.assign(new Error('cloud_account_changed_during_save'),{status:409});
      const saved=result||{};
      const revision=Number.isSafeInteger(saved.revision)?saved.revision:expectedRevision+1;
      if(saved.id){
        selected.value=String(saved.id);
        selected.textContent=(saved.name||character.name)+' · Nv.'+(saved.level||character.level)+' · '+(saved.classId||character.classId);
        selected.dataset.slot=String(Number.isInteger(saved.slot)?saved.slot:slot);
        slots.value=String(saved.id);
      }
      selected.dataset.revision=String(revision);
      selected.dataset.data=JSON.stringify(saved.data&&typeof saved.data==='object'?saved.data:payload);
      baselineReady=true;
      baselineSlot=selected.value;
      lastSyncedFingerprint=localFp;
      const pendingAfter=readPending();
      if(pendingAfter&&Number(pendingAfter.slot)===slot){
        if(pendingAfter.fingerprint===localFp)clearPending();
        else if(Number(pendingAfter.revision)===expectedRevision){
          writePending({id:selected.value.startsWith('new:')?null:selected.value,slot,revision,fingerprint:pendingAfter.fingerprint});
        }
      }
      if(lastScheduledFingerprint===localFp)lastScheduledFingerprint='';
      status.textContent='Save sincronizado. Revisão '+revision+'.';
      return saved;
    }finally{slots.disabled=wasDisabled;}
  })();
  cloudSaveInFlight=task;
  return task.finally(()=>{if(cloudSaveInFlight===task)cloudSaveInFlight=null;});
}
function reportCloudError(error){
  if(error.status===409||error.message==='character_revision_conflict'||error.message==='cloud_sync_checkpoint_mismatch'||error.message==='cloud_account_changed_during_save'){
    status.textContent='Conflito de revisão: a cópia da nuvem mudou. A lista foi atualizada; confira o personagem antes de tentar novamente.';
  }else if(error.status===413){
    status.textContent='Save local preservado. O conteúdo excede o limite atual de 24 KB da API.';
  }else if(error.status===401||error.status===403){
    status.textContent='Sessão da nuvem inválida ou expirada. Entre novamente; o save local foi preservado.';
  }else{
    status.textContent='Save local preservado; erro na nuvem: '+error.message;
  }
}
async function saveCloud(){
  try{await saveCloudCore({automatic:false});}
  catch(error){reportCloudError(error);}
}
const queue=new window.AetheriaCloudSyncQueue.CloudSyncQueue({
  run:async()=>{
    if(!api.authenticated||!api.accountId)throw Object.assign(new Error('cloud_session_scope_required'),{status:401});
    if(!autoSync.checked)return null;
    return saveCloudCore({automatic:true});
  },
  delay:1600,
  maxRetries:5,
  retryBase:1000,
  maxDelay:30000,
  onState:(state,error,result)=>{
    if(state==='scheduled')status.textContent='Alterações locais aguardando sincronização…';
    else if(state==='syncing')status.textContent='Sincronizando uma cópia do progresso…';
    else if(state==='synced'&&result)status.textContent='Nuvem atualizada. Revisão '+result.revision+'.';
    else if(state==='retry')status.textContent='Falha temporária na nuvem. Nova tentativa automática em instantes; save local preservado.';
    else if(state==='blocked'){
      autoSync.checked=false;
      writeAutoPreference(false);
      queue.pause();
      reportCloudError(error||new Error('cloud_sync_blocked'));
      if(!error||![409,413,401,403,400].includes(Number(error.status)))status.textContent+=' Sincronização automática pausada; o marcador pendente foi preservado para recuperação após revisão.';
    }
  }
});
function scheduleCloudSync(){
  if(!api.authenticated||!api.accountId||!autoSync.checked)return false;
  const selected=slots.selectedOptions&&slots.selectedOptions[0];
  if(!selected||!baselineReady||baselineSlot!==selected.value){
    disableAutoSync('Selecione e sincronize manualmente o personagem antes de usar a sincronização automática.');
    return false;
  }
  const payload=window.AetheriaGameBridge.getSave(),localFp=fingerprint(payload);
  if(localFp===lastSyncedFingerprint||localFp===lastScheduledFingerprint)return false;
  const slot=Number(selected.dataset.slot),revision=Number(selected.dataset.revision);
  if(!Number.isInteger(slot)||!Number.isSafeInteger(revision))return false;
  if(!writePending({id:selected.value.startsWith('new:')?null:selected.value,slot,revision,fingerprint:localFp})){
    disableAutoSync('Não foi possível guardar o marcador de sincronização neste aparelho. O save local continua ativo; libere espaço e reative a opção.');
    return false;
  }
  lastScheduledFingerprint=localFp;
  return queue.schedule();
}
autoSync.addEventListener('change',()=>{
  if(!autoSync.checked){
    writeAutoPreference(false);
    queue.pause();
    status.textContent='Sincronização automática desativada. O save local continua ativo.';
    return;
  }
  if(!api.authenticated||!api.accountId){
    autoSync.checked=false;
    writeAutoPreference(false);
    status.textContent='Entre na conta antes de ativar a sincronização automática.';
    return;
  }
  const baseline=reconcileBaseline();
  if(baseline==='mismatch'){
    autoSync.checked=false;
    writeAutoPreference(false);
    status.textContent='Faça primeiro um salvamento manual ou restaure a cópia da nuvem para confirmar a versão inicial.';
    return;
  }
  writeAutoPreference(true);
  if(baseline==='pending')queue.resume({schedule:true});
  else queue.resume({schedule:false});
  status.textContent='Sincronização automática ativada. As próximas alterações locais serão enviadas após uma pausa curta.';
});
slots.addEventListener('change',()=>{
  const baseline=reconcileBaseline();
  if(autoSync.checked&&baseline==='mismatch')disableAutoSync('O personagem selecionado difere da cópia local. Faça um salvamento manual ou restaure a nuvem antes de continuar.');
});
button('Entrar',card,async()=>{
  const previousAccountId=api.accountId;
  queue.pause();
  try{await api.login(email.value,pass.value);setAuthView(true);await list();}
  catch(error){
    if(api.authenticated&&api.accountId===previousAccountId){setAuthView(true);if(autoSync.checked&&readPending())queue.resume({schedule:true});else queue.resume({schedule:false});}
    status.textContent='Erro ao entrar: '+error.message;
  }
});
button('Criar conta',card,async()=>{
  const previousAccountId=api.accountId;
  queue.pause();
  try{await api.register(email.value,pass.value);setAuthView(true);await list();}
  catch(error){
    if(api.authenticated&&api.accountId===previousAccountId){setAuthView(true);if(autoSync.checked&&readPending())queue.resume({schedule:true});else queue.resume({schedule:false});}
    status.textContent='Erro ao criar conta: '+error.message;
  }
});
button('Salvar na nuvem',cloud,saveCloud);
button('Restaurar selecionado',cloud,()=>{
  try{
    const option=slots.selectedOptions&&slots.selectedOptions[0];
    const saved=JSON.parse(option&&option.dataset.data||'{}');
    if(!saved.sv)throw new Error('Este espaço ainda não possui um save para restaurar.');
    if(confirm('Substituir o progresso local pelo save da nuvem?'))window.AetheriaGameBridge.applySave(saved);
  }catch(error){status.textContent=error.message;}
});
button('Atualizar lista',cloud,()=>list().catch(()=>{}));
button('Sair',cloud,()=>{
  queue.pause();
  api.logout();
  setAuthView(false);
  status.textContent='Sessão encerrada. Save local preservado.';
});
button('Fechar',card,()=>{modal.style.display='none';});
setAuthView(api.authenticated);
const go=document.getElementById('go');
if(go&&go.parentElement){
  const open=button('☁️ Conta / Nuvem',go.parentElement,()=>{
    modal.style.display='flex';
    if(api.authenticated){setAuthView(true);list().catch(()=>{});}
    else setAuthView(false);
  });
  open.className='big alt';
  open.setAttribute('aria-label','Abrir conta e sincronização na nuvem');
}
window.AetheriaAccountCloudSync=Object.freeze({
  save:saveCloud,
  list:()=>list(),
  schedule:scheduleCloudSync,
  pause:()=>queue.pause(),
  get authenticated(){return api.authenticated;},
  get autoSyncEnabled(){return autoSync.checked;}
});
const originalSave=window.save;
if(typeof originalSave==='function'&&!window.__aetheriaCloudSaveHooked){
  window.save=function(force,options){
    const result=originalSave.apply(this,arguments);
    if(result&&!(options&&options.skipCloudSync))scheduleCloudSync();
    return result;
  };
  window.__aetheriaCloudSaveHooked=true;
}
}
if(window.AetheriaCloudSyncQueue)boot();
else{
  const loader=document.createElement('script');
  loader.src='assets/engine/cloud-sync-queue.js';
  loader.onload=boot;
  loader.onerror=()=>console.warn('[Aetheria] Fila de sincronização opcional indisponível; save local permanece ativo.');
  document.head.appendChild(loader);
}
})();
