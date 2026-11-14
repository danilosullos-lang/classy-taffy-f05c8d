/*!
 * Aetheria RPG — Interlude skill catalog
 * Original game data retained from the existing Three.js client.
 * Names and gameplay descriptions only; no third-party client data.
 */
(function(root,factory){
  const catalog=factory();
  if(typeof module==='object'&&module.exports)module.exports=catalog;
  if(root)root.AetheriaSkillCatalog=catalog;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const catalog={
 fighter:{q:['⚔️','Power Strike','Golpe físico'],e:['🗡️','Fatal Strike','Golpe pesado'],c:['💫','War Cry','Dano em área'],f:['💨','Rush','Avanço de combate'],g:['🛡️','Defensive Stance','Reduz dano recebido'],h:['🌪️','Whirlwind','Ataque em área'],t:['🔥','Might','Aumenta o ataque'],v:['⚔️','Final Secret','Explosão de dano']},
 tank:{q:['🗡️','Power Strike','Golpe físico'],e:['🛡️','Shield Stun','Atordoa o alvo'],c:['📢','Aggression','Provocação e impacto'],f:['💨','Shield Charge','Investida defensiva'],g:['🔰','Ultimate Defense','Defesa elevada'],h:['✨','Holy Armor','Dano sagrado em área'],t:['🛡️','Fortitude','Resistência elevada'],v:['⚜️','Sacred Judgment','Julgamento sagrado']},
 archer:{q:['🏹','Double Shot','Disparo duplo'],e:['🎯','Stunning Shot','Flecha atordoante'],c:['🌧️','Burst Shot','Chuva de flechas'],f:['↩️','Backstep','Recuo rápido'],g:['🦅','Hawk Eye','Aumenta precisão e crítico'],h:['🏹','Deadly Arrow','Flecha perfurante'],t:['🎯','Focused Aim','Aumenta dano à distância'],v:['🌠','Rain of Arrows','Tempestade de flechas']},
 dagger:{q:['🗡️','Deadly Blow','Ataque rápido'],e:['🌑','Backstab','Ataque pelas costas'],c:['☠️','Poison Blade','Veneno em área'],f:['👤','Shadow Step','Passo das sombras'],g:['👻','Ultimate Evasion','Esquiva elevada'],h:['🩸','Lethal Blow','Golpe letal'],t:['🎯','Focus Death','Aumenta crítico'],v:['☠️','Assassination','Execução']},
 mage:{q:['🔥','Prominence','Magia de fogo'],e:['🌪️','Hurricane','Magia de vento'],c:['🌙','Sleep','Controle arcano'],f:['✨','Blink','Deslocamento arcano'],g:['💚','Vampiric Claw','Drena vida'],h:['⚡','Hurricane Burst','Explosão elemental'],t:['🔮','Empower','Aumenta poder mágico'],v:['☄️','Meteor','Chuva de meteoros']},
 healer:{q:['✨','Holy Bolt','Raio sagrado'],e:['💚','Greater Heal','Cura poderosa'],c:['🌟','Might of Heaven','Dano sagrado em área'],f:['🕊️','Blessed Step','Movimento protegido'],g:['💚','Major Heal','Grande cura'],h:['☀️','Divine Flash','Explosão sagrada'],t:['🙏','Blessing','Bênção defensiva'],v:['🌈','Mass Resurrection','Milagre restaurador']},
 support:{q:['✨','Holy Strike','Golpe espiritual'],e:['💠','Seal of Binding','Selo de controle'],c:['📯','War Chant','Impacto em área'],f:['💨','Swift Retreat','Recuo'],g:['🙏','Prophecy','Bênção de grupo'],h:['🌩️','Spirit Burst','Explosão espiritual'],t:['🛡️','Chant of Victory','Buff de combate'],v:['🌟','Grand Prophecy','Poder supremo']},
 crafter:{q:['🔨','Hammer Crush','Golpe de martelo'],e:['⛏️','Spoil','Marca um monstro para coleta'],c:['🧹','Sweep','Recolhe materiais de um monstro derrotado e marcado'],f:['💨','Dwarven Dash','Avanço'],g:['🛠️','Create Item','Abre a oficina para fabricar equipamentos'],h:['⚒️','Earth Shatter','Impacto pesado'],t:['🧱','Hard Tanning','Defesa reforçada'],v:['💎','Treasure Mastery','Golpe e saque extra']}
};
  Object.values(catalog).forEach(set=>{
    Object.values(set).forEach(skill=>Object.freeze(skill));
    Object.freeze(set);
  });
  return Object.freeze(catalog);
});
