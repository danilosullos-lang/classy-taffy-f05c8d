(function(){
'use strict';
if(!window.AetheriaAccount||!window.AetheriaGameBridge)return;
const api=window.AetheriaAccount.create();
const el=(tag,attrs,parent)=>{const n=document.createElement(tag);Object.entries(attrs||{}).forEach(([k,v])=>k==='text'?n.textContent=v:n.setAttribute(k,v));if(parent)parent.appendChild(n);return n;};
const css=el('style',{},document.head);css.textContent='#aetheria-account{position:fixed;z-index:12000;inset:0;display:none;align-items:center;justify-content:center;background:#080611ed;padding:16px;color:white;font:14px system-ui}#aetheria-account section{width:min(420px,100%);max-height:90dvh;overflow:auto;background:#20162f;border:1px solid #b99b58;border-radius:16px;padding:18px}#aetheria-account input,#aetheria-account select{display:block;width:100%;padding:11px;margin:8px 0;background:#120d1b;color:white;border:1px solid #655477;border-radius:8px}#aetheria-account button{padding:10px;margin:5px 4px 5px 0;border:0;border-radius:8px;background:#75502b;color:white;font-weight:700}';
const modal=el('div',{id:'aetheria-account'},document.body),card=el('section',{},modal);
el('h2',{text:'Conta Aetheria'},card);el('p',{text:'O save local continua funcionando. Entre para sincronizar uma cópia na nuvem.'},card);
const email=el('input',{type:'email',placeholder:'E-mail',autocomplete:'username'},card),pass=el('input',{type:'password',placeholder:'Senha (mínimo 10 caracteres)',minlength:'10',autocomplete:'current-password'},card);
const status=el('p',{text:'Modo offline ativo.'},card),cloud=el('div',{},card),slots=el('select',{},cloud);
const button=(label,parent,fn)=>{const b=el('button',{type:'button',text:label},parent);b.onclick=fn;return b;};
async function list(){try{slots.replaceChildren();const chars=await api.listCharacters();chars.forEach(c=>{const o=el('option',{value:c.id,text:c.name+' · Nv.'+c.level+' · '+c.classId},slots);o.dataset.data=JSON.stringify(c.data||{});});if(!chars.length)el('option',{value:'',text:'Nenhum save na nuvem'},slots);status.textContent='Conta conectada. '+chars.length+' personagem(ns) na nuvem.';}catch(e){status.textContent='Erro ao listar: '+e.message;}}
async function saveCloud(){try{const p=window.AetheriaGameBridge.getSave(),s=p.sv||{},cp=s.cp||{};const result=await api.saveCharacter({slot:0,name:String(s.name||'Aventureiro').slice(0,20),race:s.race||'human',classId:s.job||'novice',level:Math.max(1,Math.min(80,Number(s.lv)||1)),mapId:'talking_island',position:{x:Number(cp.x)||0,y:Number(cp.y)||0,z:Number(cp.z)||0},vitals:{hp:Number(s.hp)||100,mp:Number(s.mp)||50},data:p});status.textContent='Save sincronizado. Revisão '+result.revision+'.';await list();}catch(e){status.textContent='Save local preservado; erro na nuvem: '+e.message;}}
button('Entrar',card,async()=>{try{await api.login(email.value,pass.value);email.style.display=pass.style.display='none';status.textContent='Login concluído.';await list();}catch(e){status.textContent='Erro: '+e.message;}});
button('Criar conta',card,async()=>{try{await api.register(email.value,pass.value);email.style.display=pass.style.display='none';await list();}catch(e){status.textContent='Erro: '+e.message;}});
button('Salvar na nuvem',cloud,saveCloud);
button('Restaurar selecionado',cloud,()=>{try{const o=slots.selectedOptions[0],p=JSON.parse(o&&o.dataset.data||'{}');if(!p.sv)throw Error('Save inválido');if(confirm('Substituir o progresso local pelo save da nuvem?'))window.AetheriaGameBridge.applySave(p);}catch(e){status.textContent=e.message;}});
button('Atualizar lista',cloud,list);button('Sair',cloud,()=>{api.logout();email.style.display=pass.style.display='block';status.textContent='Sessão encerrada. Save local preservado.';});
button('Fechar',card,()=>modal.style.display='none');
cloud.style.display='none';
const go=document.getElementById('go');if(go&&go.parentElement)button('☁️ Conta / Nuvem',go.parentElement,()=>{modal.style.display='flex';if(api.authenticated){email.style.display=pass.style.display='none';cloud.style.display='block';list();}});
window.AetheriaAccountCloudSync={save:saveCloud};
})();