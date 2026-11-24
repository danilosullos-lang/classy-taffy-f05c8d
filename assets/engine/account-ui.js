(function(){
'use strict';
if(!window.AetheriaAccount||!window.AetheriaGameBridge)return;
const api=window.AetheriaAccount.create();
const el=(tag,attrs,parent)=>{
  const node=document.createElement(tag);
  Object.entries(attrs||{}).forEach(([key,value])=>key==='text'?node.textContent=value:node.setAttribute(key,value));
  if(parent)parent.appendChild(node);
  return node;
};
const css=el('style',{},document.head);
css.textContent='#aetheria-account{position:fixed;z-index:12000;inset:0;display:none;align-items:center;justify-content:center;background:#080611ed;padding:16px;color:white;font:14px system-ui}#aetheria-account section{width:min(420px,100%);max-height:90dvh;overflow:auto;background:#20162f;border:1px solid #b99b58;border-radius:16px;padding:18px}#aetheria-account input,#aetheria-account select{display:block;width:100%;padding:11px;margin:8px 0;background:#120d1b;color:white;border:1px solid #655477;border-radius:8px}#aetheria-account button{padding:10px;margin:5px 4px 5px 0;border:0;border-radius:8px;background:#75502b;color:white;font-weight:700}#aetheria-account button:focus-visible,#aetheria-account input:focus-visible,#aetheria-account select:focus-visible{outline:2px solid #ffd36b;outline-offset:2px}';
const modal=el('div',{id:'aetheria-account','role':'dialog','aria-modal':'true','aria-label':'Conta Aetheria'},document.body);
const card=el('section',{},modal);
el('h2',{text:'Conta Aetheria'},card);
el('p',{text:'O save local continua funcionando. Entre para sincronizar uma cópia na nuvem.'},card);
const email=el('input',{type:'email',placeholder:'E-mail',autocomplete:'username','aria-label':'E-mail'},card);
const pass=el('input',{type:'password',placeholder:'Senha (mínimo 10 caracteres)',minlength:'10',autocomplete:'current-password','aria-label':'Senha'},card);
const status=el('p',{text:'Modo offline ativo. O progresso local não será alterado.'},card);
const cloud=el('div',{},card);
const slots=el('select',{'aria-label':'Personagem ou espaço de save'},cloud);
const button=(label,parent,fn)=>{
  const node=el('button',{type:'button',text:label},parent);
  node.onclick=fn;
  return node;
};
async function list(){
  const previous=slots.value;
  try{
    const characters=await api.listCharacters();
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
    if(Array.from(slots.options).some(option=>option.value===previous))slots.value=previous;
    else if(characters.length)slots.value=String(characters[0].id);
    else slots.value='new:0';
    status.textContent='Conta conectada. '+characters.length+' personagem(ns) na nuvem.';
    return characters;
  }catch(error){
    status.textContent='Não foi possível atualizar a lista: '+error.message;
    throw error;
  }
}
async function saveCloud(){
  try{
    const selected=slots.selectedOptions&&slots.selectedOptions[0];
    if(!selected)throw new Error('Selecione um espaço de personagem.');
    const payload=window.AetheriaGameBridge.getSave();
    const state=payload.sv||{},checkpoint=state.cp||{};
    const name=String(state.name||'Aventureiro').replace(/[<>]/g,'').trim().slice(0,20)||'Aventureiro';
    const slot=Number(selected.dataset.slot),expectedRevision=Number(selected.dataset.revision);
    if(!Number.isInteger(slot)||slot<0||slot>5||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
      throw new Error('Espaço de save inválido.');
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
    const result=await api.saveCharacter(character);
    await list();
    if(result&&result.id)slots.value=result.id;
    status.textContent='Save sincronizado. Revisão '+result.revision+'.';
  }catch(error){
    if(error.status===409||error.message==='character_revision_conflict'){
      try{await list();}catch(_){}
      status.textContent='Conflito: o save mudou em outro dispositivo. A lista foi atualizada; confira o personagem antes de tentar novamente.';
    }else if(error.status===413){
      status.textContent='Save local preservado. O conteúdo excede o limite atual de 24 KB da API.';
    }else{
      status.textContent='Save local preservado; erro na nuvem: '+error.message;
    }
  }
}
button('Entrar',card,async()=>{
  try{await api.login(email.value,pass.value);email.style.display=pass.style.display='none';cloud.style.display='block';await list();}
  catch(error){status.textContent='Erro ao entrar: '+error.message;}
});
button('Criar conta',card,async()=>{
  try{await api.register(email.value,pass.value);email.style.display=pass.style.display='none';cloud.style.display='block';await list();}
  catch(error){status.textContent='Erro ao criar conta: '+error.message;}
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
  api.logout();
  cloud.style.display='none';
  email.style.display=pass.style.display='block';
  status.textContent='Sessão encerrada. Save local preservado.';
});
button('Fechar',card,()=>{modal.style.display='none';});
cloud.style.display='none';
const go=document.getElementById('go');
if(go&&go.parentElement){
  const open=button('☁️ Conta / Nuvem',go.parentElement,()=>{
    modal.style.display='flex';
    if(api.authenticated){email.style.display=pass.style.display='none';cloud.style.display='block';list().catch(()=>{});}
  });
  open.className='big alt';
  open.setAttribute('aria-label','Abrir conta e sincronização na nuvem');
}
window.AetheriaAccountCloudSync=Object.freeze({save:saveCloud,list:()=>list(),get authenticated(){return api.authenticated;}});
})();