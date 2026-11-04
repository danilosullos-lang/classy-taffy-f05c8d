const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

  try {
    const response = await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    if (!response || !response.ok()) throw new Error('A página principal não respondeu com HTTP 200.');

    await page.waitForFunction(() => {
      const loading = document.querySelector('#loading');
      return loading && loading.classList.contains('hide');
    }, { timeout: 60000 });

    const runtimeLibraries = await page.evaluate(() => ({
      three: !!window.THREE,
      gltfLoader: !!(window.THREE && THREE.GLTFLoader),
      skeletonUtils: !!(window.THREE && THREE.SkeletonUtils),
      postprocessing: !!(window.THREE && THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass && THREE.ShaderPass),
      combatCore: !!window.AetheriaCombatCore,
      monsterProgression: !!(window.AetheriaMonsterProgression && window.AetheriaMonsterProgression.MAX_LEVEL===80)
    }));
    if (!runtimeLibraries.three || !runtimeLibraries.gltfLoader || !runtimeLibraries.skeletonUtils || !runtimeLibraries.postprocessing || !runtimeLibraries.combatCore || !runtimeLibraries.monsterProgression) {
      throw new Error('As bibliotecas 3D locais não carregaram completamente: '+JSON.stringify(runtimeLibraries));
    }

    const canvas = await page.locator('canvas').first();
    await canvas.waitFor({ state: 'attached', timeout: 15000 });
    const canvasSize = await canvas.evaluate(el => ({ width: el.width, height: el.height }));
    if (!canvasSize.width || !canvasSize.height) throw new Error('Canvas 3D foi criado sem dimensões.');

    // First-run users must explicitly accept the game's age gate and terms.
    const terms = page.locator('#tos');
    if (await terms.isVisible()) {
      await page.locator('#tosAge').check();
      await page.locator('#tosOk').check();
      await page.locator('#tosBtn').click();
      await page.waitForFunction(() => {
        const panel = document.querySelector('#tos');
        return panel && getComputedStyle(panel).display === 'none';
      }, { timeout: 10000 });
    }

    // Simulate a legacy saved Apprentice: the old save must not skip class creation.
    await page.evaluate(()=>{sv.charCreated=1;sv.job='novice';sv.charClass='novice';sv.lv=Math.max(1,sv.lv||1);});
    await page.locator('#go').click();

    // First-run accounts now choose a class and see its actual local 3D skin preview.
    const characterPicker = page.locator('#charpick');
    let raceBaseClasses={};
    if(!(await characterPicker.isVisible()))throw new Error('Um save antigo de Aprendiz entrou no mundo sem abrir o seletor de classe.');
    if (await characterPicker.isVisible()) {
      // The five races intentionally have only their Lineage 2 base classes at level 1.
      for(const [race,expected] of Object.entries({
        human:['guerreiro','mago'],elf:['guerreiro','mago'],
        dark_elf:['guerreiro','mago'],orc:['guerreiro','mago'],dwarf:['guerreiro']
      })){
        await page.locator('[data-start-race="'+race+'"]').click();
        raceBaseClasses[race]=await page.locator('#cpGrid [data-start-class]').evaluateAll(nodes=>
          nodes.filter(node=>getComputedStyle(node).display!=='none').map(node=>node.dataset.startClass));
        if(JSON.stringify(raceBaseClasses[race])!==JSON.stringify(expected)){
          throw new Error('Classes iniciais incorretas para '+race+': '+JSON.stringify(raceBaseClasses[race]));
        }
      }
      await page.locator('[data-start-race="elf"]').click();
      const elfClassLabel = await page.locator('#cpGrid [data-start-class="guerreiro"] b').textContent();
      if (!/Elven Fighter/.test(elfClassLabel || '')) throw new Error('A raça élfica não atualizou a classe inicial: '+elfClassLabel);
      if(await page.locator('#cpGrid [data-start-class="arqueiro"]').isVisible()){
        throw new Error('Arqueiro foi exibido como classe inicial; deve ser desbloqueado por transferência.');
      }
      await page.locator('[data-start-race="human"]').click();
      const humanClassLabel = await page.locator('#cpGrid [data-start-class="guerreiro"] b').textContent();
      if (!/^Fighter$/.test((humanClassLabel || '').trim())) throw new Error('A raça humana não atualizou a classe inicial: '+humanClassLabel);
      await page.locator('[data-start-class="guerreiro"]').click();
      await page.waitForFunction(() => {
        const status = document.querySelector('#cpPreviewStatus');
        if (!status) return false;
        return window.__rpgLowMemoryMode
          ? status.textContent.includes('Prévia 3D desativada no modo leve')
          : status.textContent.includes('Prévia 3D carregada');
      }, { timeout: 30000 });
      const lowMemoryMode = await page.evaluate(() => !!window.__rpgLowMemoryMode);
      if (!lowMemoryMode) {
        const previewCanvas = await page.locator('#cpPreviewCanvas').evaluate(el => ({
          width: el.width, height: el.height,
          renderer: !!el.getContext('webgl') || !!el.getContext('webgl2')
        }));
        if (!previewCanvas.width || !previewCanvas.height || !previewCanvas.renderer) {
          throw new Error('A prévia 3D da classe não inicializou: ' + JSON.stringify(previewCanvas));
        }
      }
      await page.locator('#cpConfirm').click();
      const createdCharacter = await page.evaluate(() => ({race:sv.race,lineageClass:sv.lineageClass,job:sv.job}));
      if (createdCharacter.race !== 'human' || !/^Fighter$/.test((createdCharacter.lineageClass || '').trim()) || createdCharacter.job !== 'guerreiro') {
        throw new Error('A criação do personagem não salvou raça/classe Interlude: '+JSON.stringify(createdCharacter));
      }
    }
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#ov');
      return overlay && getComputedStyle(overlay).display === 'none';
    }, { timeout: 15000 });

    // New accounts open the tutorial menu after starting; resume before movement tests.
    const tutorialMenu = page.locator('#mu');
    if (await tutorialMenu.isVisible()) {
      // The first-run tutorial is a separate page; go back to the main menu, then resume.
      const backToMenu = page.locator('#mu [data-a="pg"][data-p="main"]');
      if (await backToMenu.isVisible()) await backToMenu.click();
      const tutorialResume = page.locator('#mu [data-a="resume"]');
      if (await tutorialResume.isVisible()) await tutorialResume.click();
    }
    await page.waitForFunction(() => window.__rpgWeaponDebug && window.__rpgWeaponDebug.loaded === true, { timeout: 20000 });
    const equippedWeaponDebug = await page.evaluate(() => window.__rpgWeaponDebug);
    if (!equippedWeaponDebug.model || !equippedWeaponDebug.family) {
      throw new Error('A arma equipada não carregou um modelo 3D: ' + JSON.stringify(equippedWeaponDebug));
    }

    await page.waitForFunction(() => {
      const d=window.__rpgPlayerAnimationDebug;
      return !!(d&&d.active&&typeof d.skin==='string'&&/\.glb(?:[?#].*)?$/i.test(d.skin));
    }, { timeout: 30000 });
    await page.waitForFunction(() => window.__rpgAnimationAssetDebug && window.__rpgAnimationAssetDebug.clips >= 40, { timeout: 45000 });
    const mappedPlayerClips=await page.evaluate(()=>window.__rpgPlayerAnimationDebug.clipMap||{});
    for(const [key,pattern] of Object.entries({
      idle:/idle/i,walk:/walk/i,run:/run|sprint/i,jump:/jump|hop/i,
      attack:/attack|melee|sword|slash|combo/i,block:/block|parry|guard/i,
      hit:/hit|hurt|damage|react/i,death:/death|defeat|die/i
    })){
      if(!pattern.test(String(mappedPlayerClips[key]||''))){
        throw new Error('O clip KayKit retargetizado não foi ativado para '+key+': '+JSON.stringify(mappedPlayerClips));
      }
    }
    const importedAnimationSets=await page.evaluate(()=>window.__rpgAnimationAssetDebug);
    if(importedAnimationSets.loadedSets.length<6||importedAnimationSets.clips<40){
      throw new Error('Biblioteca de animações KayKit incompleta: '+JSON.stringify(importedAnimationSets));
    }
    await page.waitForFunction(() => window.__rpgPlayerAnimationDebug.gameRunning === true, { timeout: 10000 });
    const initialBossState=await page.evaluate(()=>({
      active:!!boss,visible:!!heron.visible,scale:heron.scale.toArray(),
      maxScale:Math.max(heron.scale.x,heron.scale.y,heron.scale.z)
    }));
    if(initialBossState.active||initialBossState.visible||initialBossState.maxScale>1.25){
      throw new Error('Um chefe gigante foi exibido ao iniciar o mundo: '+JSON.stringify(initialBossState));
    }

    await page.waitForFunction(() => {
      const d=window.__rpgPlayerAnimationDebug;
      return !!(d&&d.active&&typeof d.skin==='string'&&/\.glb(?:[?#].*)?$/i.test(d.skin));
    }, { timeout: 30000 });

    // The imported CC0 town kit must load into the live world, not just exist in the repository.
    try {
      await page.waitForFunction(() => {
        const w=window.__rpgWorldDebug;
        return w&&w.villageAssetsLoaded>=7&&w.townNpcs>=5&&w.townNpcKinds.includes('questmaster');
      }, { timeout: 60000 });
    } catch (error) {
      const diagnostic=await page.evaluate(()=>({world:window.__rpgWorldDebug||null,errors:window.__rpgAssetErrors||null}));
      throw new Error('Vila Interlude não ficou pronta: '+JSON.stringify(diagnostic)+' · '+error.message);
    }
    const townWorldState=await page.evaluate(()=>({...window.__rpgWorldDebug}));
    const collisionAudit=await page.evaluate(()=>{
      const c=window.__rpgCollisionDebug;
      // A vila inicial está no chunk 222 (base Z=19.980). Os pontos
      // abaixo são offsets locais da praça, então convertemos para Z global
      // antes de consultar o mesmo sistema usado pelo movimento do jogador.
      const villageBase=Math.floor(20000/90)*90;
      return c?{
        solidCount:c.solidCount,
        houseWallBlocked:c.blocked(-28,villageBase+20),
        doorwayClear:!c.blocked(-30,villageBase+20),
        watchtowerBlocked:c.blocked(-47,villageBase+42),
        wellBlocked:c.blocked(0,villageBase+2),
        stallBlocked:c.blocked(-18,villageBase+8)
      }:null;
    });
    if(!collisionAudit||collisionAudit.solidCount<47||!collisionAudit.houseWallBlocked||
      !collisionAudit.doorwayClear||!collisionAudit.watchtowerBlocked||
      !collisionAudit.wellBlocked||!collisionAudit.stallBlocked){
      throw new Error('Colisões da vila incompletas ou porta bloqueada: '+JSON.stringify({audit:collisionAudit,debug:window.__rpgCollisionDebug||null,player:window.__rpgWorldDebug?{d:window.__rpgWorldDebug.playerX,z:window.__rpgWorldDebug.playerZ}:null}));
    }
    if(townWorldState.waterVisible||!townWorldState.groundLoaded)throw new Error('O mundo aberto ainda está usando o antigo canal de água: '+JSON.stringify(townWorldState));
    await page.waitForFunction(()=>window.__rpgWorldDebug&&window.__rpgWorldDebug.treeAssetsLoaded>=5,{timeout:30000});
    const treeAppearance=await page.evaluate(()=>{
      const keys=['tree1','tree2','tree3','bush','palm'];
      return keys.map(key=>{
        const root=RPG_WORLD.models[key];let meshes=0,textured=0,materials=0;
        if(root)root.traverse(o=>{if(o.isMesh){meshes++;const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list){if(!m)continue;materials++;if(m.map&&m.map.image)textured++;}}});
        return {key,loaded:!!root,fallback:!!(root&&root.userData.rpgFallback),meshes,materials,textured};
      });
    });
    if(treeAppearance.some(x=>!x.loaded||!x.meshes||!x.materials||!x.textured)){
      throw new Error('Árvore/arbusto sem material ou textura no mundo 3D: '+JSON.stringify(treeAppearance));
    }
    await page.waitForFunction(()=>{
      const root=RPG_WORLD.models.castle;if(!root)return false;
      let meshes=0,loaded=0;
      root.traverse(o=>{if(o.isMesh){meshes++;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m&&m.map&&m.map.image))loaded++;}});
      return meshes>0&&loaded>0;
    },{timeout:30000});
    const castlePbrAppearance=await page.evaluate(()=>{
      const root=RPG_WORLD.models.castle;let meshes=0,textured=0;
      root.traverse(o=>{if(o.isMesh){meshes++;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m&&m.map&&m.map.image))textured++;}});
      return {meshes,textured};
    });
    if(!castlePbrAppearance.meshes||!castlePbrAppearance.textured){
      throw new Error('Ruínas do castelo sem fallback PBR: '+JSON.stringify(castlePbrAppearance));
    }

    const townNpcAppearance=await page.evaluate(()=>{
      return Array.from(RPG_TOWN_NPCS.values()).flat().map(npc=>{
        let meshes=0,textured=0;
        npc.group.traverse(o=>{if(o.isMesh){meshes++;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m&&m.map&&m.map.image))textured++;}});
        return {id:npc.id,meshes,textured};
      });
    });
    if(townNpcAppearance.length<5||townNpcAppearance.some(n=>n.meshes<3||n.textured<3)){
      throw new Error('NPCs da vila sem materiais texturizados: '+JSON.stringify(townNpcAppearance));
    }
    // Force the procedural village fallback and verify that its visible construction meshes
    // receive real PBR maps (the translucent well water is an intentional exception).
    const townFallbackAppearance=await page.evaluate(()=>{
      const keys=['villageWall','villageDoorWall','villageWindowWall','villageRoof','villageChimney','villageWagon','villageCrate'];
      const saved={};keys.forEach(k=>{saved[k]=RPG_WORLD.models[k];RPG_WORLD.models[k]=null;});
      const group=new THREE.Group();rpgWorldBuildTown(group,7777);
      keys.forEach(k=>{RPG_WORLD.models[k]=saved[k];});
      window.__rpgFallbackTownAuditGroup=group;
      let meshes=0,materials=0,expectedTextured=0,waterExceptions=0;
      group.traverse(o=>{if(!o.isMesh)return;meshes++;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{
        if(!m)return;materials++;
        if(m.transparent&&m.opacity<1&&m.color&&m.color.getHex()===0x4e9bb7){waterExceptions++;return;}
        if(m.map)expectedTextured++;
      });});
      return {meshes,materials,expectedTextured,waterExceptions};
    });
    await page.waitForFunction(()=>{
      const g=window.__rpgFallbackTownAuditGroup;if(!g)return false;
      let total=0,loaded=0;
      g.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{
        if(!m||!m.map)return;total++;if(m.map.image)loaded++;
      });});
      return total>0&&loaded===total;
    },{timeout:30000});
    if(townFallbackAppearance.expectedTextured<30||townFallbackAppearance.waterExceptions<1){
      throw new Error('Construção procedural da vila ainda tem superfícies sem PBR: '+JSON.stringify(townFallbackAppearance));
    }

    await page.waitForFunction(()=>window.__rpgMonsterCatalog&&window.__rpgMonsterCatalog.loaded===true,{timeout:20000});
    const monsterCatalogIntegration=await page.evaluate(async()=>{
      const response=await fetch('/assets/monsters/catalog.json');
      if(!response.ok)throw new Error('Catálogo de monstros não respondeu HTTP '+response.status);
      const catalog=await response.json();
      const configured=new Set(Object.values(MONSTER_ASSET_PATHS).flat().map(choice=>
        choice.startsWith('/')?choice:MONSTER_ASSET_ROOT+choice+'.gltf'
      ));
      const urls=catalog.monsters.map(item=>'/'+String(item.path).replace(/^[/]+/,''));
      const missing=urls.filter(url=>!configured.has(url));
      const newGobkit=catalog.monsters.find(item=>
        /gobkit-animal008-pack/.test(String(item.pack||''))&&/tiger/i.test(String(item.name||''))
      );
      return {
        count:catalog.monsters.length,
        additional:window.__rpgMonsterCatalog.additional,
        missing,
        newGobkit:newGobkit?'/'+newGobkit.path:null
      };
    });
    if(monsterCatalogIntegration.count<139||monsterCatalogIntegration.additional<118||monsterCatalogIntegration.missing.length){
      throw new Error('O catálogo CC0 não está integrado por completo aos pools de monstros: '+JSON.stringify(monsterCatalogIntegration));
    }
    const monsterUrls=['/monster_01_pumpkinhead.glb','/assets/monsters/packs/gobkit/gobkit-animal007-pack/scorpion.glb','/assets/monsters/packs/quaternius-cute/Cthulhu.gltf','/assets/monsters/packs/quaternius-ultimate-monsters/Alien.gltf'];
    if(monsterCatalogIntegration.newGobkit)monsterUrls.push(monsterCatalogIntegration.newGobkit);
    const monsterAppearance=await page.evaluate(async(urls)=>{
      const loader=new THREE.GLTFLoader(),results=[];
      for(const url of urls){
        const gltf=await new Promise((resolve,reject)=>loader.load(url,resolve,undefined,reject));
        let meshes=0,textured=0,clips=gltf.animations.length;
        gltf.scene.traverse(o=>{if(o.isMesh){meshes++;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m&&m.map&&m.map.image))textured++;}});
        results.push({url,meshes,textured,clips});
      }
      return results;
    },monsterUrls);
    if(monsterAppearance.some(x=>!x.meshes||!x.textured||!x.clips)){
      throw new Error('Monstro CC0 sem geometria, textura ou animação carregada no Chromium: '+JSON.stringify(monsterAppearance));
    }

    // Exhaustive visual-asset audit: load every catalogued creature in Chromium,
    // not only the handful of representative models above. Dispose each model
    // before continuing so the 220-model sweep remains safe for CI memory.
    const allMonsterAppearance=await page.evaluate(async()=>{
      const response=await fetch('/assets/monsters/catalog.json');
      if(!response.ok)throw new Error('Catálogo de monstros indisponível para auditoria completa');
      const catalog=await response.json(),loader=new THREE.GLTFLoader(),results=[];
      for(const item of catalog.monsters||[]){
        const url='/'+String(item.path||'').replace(/^[/]+/,'');
        try{
          const gltf=await new Promise((resolve,reject)=>loader.load(url,resolve,undefined,reject));
          let meshes=0,materials=0,textured=0,bones=0;
          const textures=new Set(),mats=new Set();
          gltf.scene.traverse(node=>{
            if(node.isBone)bones++;
            if(!node.isMesh)return;
            meshes++;
            const list=Array.isArray(node.material)?node.material:(node.material?[node.material]:[]);
            list.forEach(material=>{
              if(!material)return;
              mats.add(material);materials++;
              if(material.map&&material.map.image){textured++;textures.add(material.map);}
              ['normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'].forEach(k=>{
                if(material[k])textures.add(material[k]);
              });
            });
          });
          results.push({name:item.name,path:item.path,meshes,materials,textured,bones,clips:gltf.animations.length,expectedRig:!!item.rigged});
          gltf.scene.traverse(node=>{if(node.geometry)node.geometry.dispose();});
          mats.forEach(material=>material.dispose());
          textures.forEach(texture=>texture.dispose());
        }catch(error){
          results.push({name:item.name,path:item.path,error:String(error&&error.message||error)});
        }
      }
      const failures=results.filter(x=>x.error||!x.meshes||!x.materials||!x.textured||!x.clips||(x.expectedRig&&x.bones<1));
      return {total:results.length,passed:results.length-failures.length,failures,results};
    });
    if(allMonsterAppearance.total!==monsterCatalogIntegration.count||allMonsterAppearance.failures.length){
      throw new Error('Auditoria completa dos monstros encontrou modelos sem skin/textura/animação/rig válido: '+JSON.stringify({
        total:allMonsterAppearance.total,passed:allMonsterAppearance.passed,
        failures:allMonsterAppearance.failures.slice(0,40)
      }));
    }
    await page.evaluate(()=>spawnEn('mp'));
    await page.waitForFunction(()=>window.__rpgMonsterAssetDebug&&Object.keys(window.__rpgMonsterAssetDebug.loaded).length>=1,{timeout:45000});
    const monsterRuntimeAssets=await page.evaluate(()=>({
      requested:Object.keys(window.__rpgMonsterAssetDebug.requested||{}).length,
      loaded:Object.keys(window.__rpgMonsterAssetDebug.loaded||{}).length,
      failed:window.__rpgMonsterAssetDebug.failed||{}
    }));
    if(!monsterRuntimeAssets.loaded)throw new Error('Nenhum monstro real foi aplicado pelo spawner: '+JSON.stringify(monsterRuntimeAssets));
    const questmasterCheck=await page.evaluate(()=>{
      sv.lv=18;
      // Complete the starter quest arc in this isolated smoke-test profile so the
      // questmaster offers the first-profession trial, not the level-1 tutorial.
      sv.lineageQuests={
        village_patrol:{progress:3,done:true},
        town_contacts:{progress:3,done:true},
        wolves_on_road:{progress:6,done:true},
        gather_supplies:{progress:3,done:true},
        cartographer:{progress:3,done:true},
        lost_relics:{progress:3,done:true},
        orc_threat:{progress:10,done:true}
      };
      sv.lineageQuestActive=null;
      sv.lineageMarks={};
      const npc=Array.from(RPG_TOWN_NPCS.values()).flat().find(n=>n.id==='questmaster');
      if(!npc)return {found:false};
      openRpgTownService(npc);
      const panel=document.querySelector('#rpgTownService');
      const accept=panel&&panel.querySelector('[data-town-action="questaccept"]');
      if(!accept)return {found:true,acceptButton:false,text:panel?panel.textContent:''};
      accept.click();
      const accepted=rpgActiveLineageQuest()?.id||null;
      for(let i=0;i<5;i++)rpgQuestProgress('hunt');
      return {found:true,acceptButton:true,accepted,completed:!!sv.lineageMarks?.first,active:rpgActiveLineageQuest()?.id||null};
    });
    if(!questmasterCheck.found||!questmasterCheck.acceptButton||questmasterCheck.accepted!=='first_hunt'||!questmasterCheck.completed||questmasterCheck.active!==null){
      throw new Error('O Mestre de Missões não completou a prova de transferência: '+JSON.stringify(questmasterCheck));
    }
    await page.evaluate(()=>document.querySelector('#rpgTownService')?.remove());

    // Verify the selected class skin is active, or that the compatibility rig was used when the imported model is not rigged.
    const activePlayerState = await page.evaluate(() => ({ animation: window.__rpgPlayerAnimationDebug, fallback: window.__rpgClassSkinFallback || null }));
    const activePlayerAnimation = activePlayerState.animation;
    if (activePlayerAnimation.skin==='/skins/classes/Knight.glb' && activePlayerAnimation.bones < 8) {
      throw new Error('O modelo de classe foi aplicado sem um rig utilizável: '+JSON.stringify(activePlayerAnimation));
    }
    if (activePlayerAnimation.skin==='/skins/lyra-archer-animated.glb' &&
        (activePlayerAnimation.active !== true || activePlayerAnimation.clips < 150 || activePlayerAnimation.bones < 15)) {
      throw new Error('A skin animada de segurança não carregou corretamente: '+JSON.stringify(activePlayerAnimation));
    }

    const classSkinMap = await page.evaluate(() => ({
      lowMemory: !!window.__rpgLowMemoryMode,
      warrior: playableClassSkin('guerreiro'), mage: playableClassSkin('mago'),
      archer: playableClassSkin('arqueiro'), rogue: playableClassSkin('ladino'), priest: playableClassSkin('sacerdote'),
      knight: playableClassSkin('cavaleiro'), paladin: playableClassSkin('paladino'),
      archmage: playableClassSkin('arquimago'), assassin: playableClassSkin('assassino'), ranger: playableClassSkin('ranger')
    }));
    if (classSkinMap.warrior !== '/skins/classes/Knight.glb' || classSkinMap.mage !== '/skins/classes/Mage.glb' ||
        classSkinMap.archer !== '/skins/classes/Rogue_Hooded.glb' || classSkinMap.rogue !== '/skins/classes/Rogue_Hooded.glb' ||
        classSkinMap.priest !== '/skins/classes/Mage.glb' || classSkinMap.knight !== '/skins/classes/Knight.glb' ||
        classSkinMap.paladin !== '/skins/classes/Knight.glb' || classSkinMap.archmage !== '/skins/classes/Mage.glb' ||
        classSkinMap.assassin !== '/skins/classes/Rogue_Hooded.glb' || classSkinMap.ranger !== '/skins/classes/Rogue_Hooded.glb') {
      throw new Error('O mapeamento de skins por classe está incorreto: '+JSON.stringify(classSkinMap));
    }

    // Parse every other imported class model in Chromium, not just validate its GLB header.
    const otherClassModels = await page.evaluate(async () => {
      const urls = ['/skins/classes/Mage.glb','/skins/classes/Rogue_Hooded.glb','/skins/classes/Knight.glb'];
      const results = [];
      for (const url of urls) {
        const gltf = await new Promise((resolve,reject) => new THREE.GLTFLoader().load(url,resolve,undefined,reject));
        let bones = 0;
        gltf.scene.traverse(node => { if(node.isBone) bones++; });
        const names = gltf.animations.map(clip => clip.name || '');
        const has = re => names.some(name => re.test(name));
        results.push({url,bones,clips:names.length,locomotion:names.length ? (has(/idle/i)&&has(/walk/i)&&has(/run/i)) : false});
        gltf.scene.traverse(node => {
          if(node.geometry)node.geometry.dispose();
          const materials=Array.isArray(node.material)?node.material:(node.material?[node.material]:[]);
          materials.forEach(material=>material.dispose());
        });
      }
      return results;
    });
    for (const model of otherClassModels) {
      if (model.bones < 8 || (model.clips > 0 && !model.locomotion)) {
        throw new Error('Modelo de classe sem rig/animação de locomoção utilizável: '+JSON.stringify(model));
      }
    }

    // Exercise real movement input: an animation library is not enough unless the
    // playable character switches clips while walking and sprinting.
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(3500);
    const backwardWorldState = await page.evaluate(() => ({...window.__rpgWorldDebug}));
    await page.keyboard.up('ArrowDown');
    if (!backwardWorldState.freeRoam || backwardWorldState.waterVisible || !backwardWorldState.groundLoaded || backwardWorldState.playerZ <= 8) {
      throw new Error('A exploração livre/terreno sólido não foi ativada: '+JSON.stringify(backwardWorldState));
    }
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(1500);
    const walkingState = await page.evaluate(() => ({...window.__rpgPlayerAnimationDebug}));
    await page.keyboard.down('Shift');
    await page.waitForTimeout(1500);
    const runningState = await page.evaluate(() => ({...window.__rpgPlayerAnimationDebug}));
    await page.keyboard.up('Shift');
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(800);
    const idleState = await page.evaluate(() => ({...window.__rpgPlayerAnimationDebug}));
    if (walkingState.state !== 'walk' || !/walk|procedural/i.test(walkingState.clip||'')) {
      throw new Error('A personagem não entrou na animação de caminhada ao pressionar W: '+JSON.stringify(walkingState));
    }
    if (runningState.state !== 'run' || !/run|sprint|procedural/i.test(runningState.clip||'')) {
      throw new Error('A personagem não entrou na animação de corrida ao pressionar Shift+W: '+JSON.stringify(runningState));
    }
    if (idleState.state !== 'idle') {
      throw new Error('A personagem não voltou à animação idle ao soltar os controles: '+JSON.stringify(idleState));
    }
    await page.evaluate(()=>{
      st.hp=hpMax();st.y=0;st.vy=0;st.coyote=.2;st.iframe=3;
      frog.userData._animOverride=null;frog.userData._animHp=st.hp;
      EN.forEach(e=>{e.dead=true;if(e.m)e.m.visible=false;});
    });
    await page.keyboard.down('Space');
    await page.waitForTimeout(260);
    const jumpingState=await page.evaluate(()=>({...window.__rpgPlayerAnimationDebug}));
    await page.keyboard.up('Space');
    if(jumpingState.state!=='jump'||!/(jump|land)/i.test(jumpingState.clip||'')){
      throw new Error('O salto não acionou um clip de pulo/aterrissagem válido: '+JSON.stringify(jumpingState));
    }
    const playerVisibility=await page.evaluate(()=>{
      let meshes=0,visibleMeshes=0;
      if(_externalFrogSkin)_externalFrogSkin.traverse(o=>{if(o.isMesh&&o.geometry){meshes++;if(o.visible)visibleMeshes++}});
      return {playerRootVisible:!!(frog&&frog.visible),externalSkinVisible:!!(_externalFrogSkin&&_externalFrogSkin.visible),
        meshes,visibleMeshes,skinStatus:window.__rpgSkinLoadDebug?.status||null};
    });
    if(!playerVisibility.playerRootVisible||!playerVisibility.externalSkinVisible||
      playerVisibility.meshes<1||playerVisibility.visibleMeshes<1){
      throw new Error('O personagem ficou invisível após andar/correr: '+JSON.stringify(playerVisibility));
    }
    const hudNaN=await page.evaluate(()=>/\bNaN\b/.test(document.body.innerText));
    if(hudNaN)throw new Error('O HUD exibiu um valor NaN após a movimentação.');

    // Exercise camera drag on a phone-sized viewport and verify the low-memory
    // renderer keeps its reduced GPU pixel budget without losing WebGL context.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(700);
    const cameraCanvas = await page.locator('canvas').first();
    const cameraBox = await cameraCanvas.boundingBox();
    if (!cameraBox) throw new Error('Canvas 3D não possui área visível para testar a câmera.');
    const startYaw = await page.evaluate(() => CAMV.yaw);
    await page.mouse.move(cameraBox.x + cameraBox.width * 0.72, cameraBox.y + cameraBox.height * 0.48);
    await page.mouse.down();
    await page.mouse.move(cameraBox.x + cameraBox.width * 0.80, cameraBox.y + cameraBox.height * 0.54, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const cameraRuntime = await page.evaluate(() => ({
      yaw: CAMV.yaw,
      lowMemory: !!window.__rpgLowMemoryMode,
      pixelRatio: R.getPixelRatio(),
      contextLost: !!R.getContext().isContextLost(),
      contextStatus: window.__rpgWebGLStatus || 'active'
    }));
    if (Math.abs(cameraRuntime.yaw - startYaw) < 0.001) throw new Error('O arraste não atualizou a câmera 3D.');
    if (cameraRuntime.contextLost) throw new Error('O contexto WebGL foi perdido durante o giro da câmera: '+JSON.stringify(cameraRuntime));
    if (cameraRuntime.lowMemory && cameraRuntime.pixelRatio > 0.651) throw new Error('O perfil móvel excedeu o limite de resolução GPU: '+JSON.stringify(cameraRuntime));
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(700);
    const rotatedViewport=await page.evaluate(()=>({
      width:R.domElement.width,height:R.domElement.height,aspect:C.aspect,
      contextLost:R.getContext().isContextLost(),status:window.__rpgWebGLStatus||'active'
    }));
    if(!rotatedViewport.width||!rotatedViewport.height||rotatedViewport.contextLost||
      Math.abs(rotatedViewport.aspect-(844/390))>.02){
      throw new Error('O jogo falhou ao girar para paisagem: '+JSON.stringify(rotatedViewport));
    }

    // Validate the real Interlude profession transfers at levels 20, 40 and 76.
    await page.evaluate(() => { sv.lineageMarks={first:true,second:true,third:true};sv.lv=20;openBag('cls'); });
    await page.waitForSelector('#bg [data-a="lineageClass"][data-id="warrior"]');
    await page.locator('#bg [data-a="lineageClass"][data-id="warrior"]').click();
    await page.evaluate(() => { sv.lv=40;renderBag(); });
    await page.waitForSelector('#bg [data-a="lineageClass"][data-id="gladiator"]');
    await page.locator('#bg [data-a="lineageClass"][data-id="gladiator"]').click();
    await page.evaluate(() => { sv.lv=76;renderBag(); });
    await page.waitForSelector('#bg [data-a="lineageClass"][data-id="duelist"]');
    await page.locator('#bg [data-a="lineageClass"][data-id="duelist"]').click();
    const classTransferState=await page.evaluate(()=>({name:sv.lineageClass,stage:sv.lineageStage,first:sv.lineageFirstClass,second:sv.lineageSecondClass,third:sv.lineageThirdClass}));
    if(classTransferState.name!=='Duelist'||classTransferState.stage!==3||classTransferState.first!=='warrior'||classTransferState.second!=='gladiator'||classTransferState.third!=='duelist'){
      throw new Error('A árvore de classes 20/40/76 não progrediu corretamente: '+JSON.stringify(classTransferState));
    }
    await page.evaluate(()=>closeBag());

    // The initial two cards are intentional Lineage-style base archetypes.
    // An Elf Fighter unlocks Elven Scout (archer) at level 20 after the first trial.
    const elfArcherTransfer=await page.evaluate(()=>{
      const snapshot=JSON.parse(JSON.stringify(sv)),originalSkinLoader=loadExternalFrogSkin;
      try{
        // Exercise the class-transfer state machine without starting an asynchronous
        // GLB request that could race with restoration of the isolated smoke profile.
        loadExternalFrogSkin=()=>{};
        sv.race='elf';sv.lineageRace='elf';sv.lineageBaseClass='fighter';sv.lineageStage=0;
        sv.lineageMarks={first:true,second:true,third:true};sv.lv=20;sv.job='guerreiro';sv.lineageClass='Elven Fighter';
        sv.lineageRole='fighter';sv.lineageFirstClass=null;sv.frog=sv.frog||{};
        const options=lineageOptions(),scout=options.find(x=>x.id==='elven_scout');
        if(!scout||scout.role!=='archer'||scout.job!=='arqueiro')return {ok:false,options};
        const firstSelected=selectLineageClass('elven_scout');
        const first={selected:firstSelected,job:sv.job,role:sv.lineageRole,classId:sv.lineageClassId,skin:sv.frog.externalSkin};
        sv.lv=40;const secondOptions=lineageOptions(),ranger=secondOptions.find(x=>x.id==='silver_ranger');
        if(!ranger||ranger.role!=='archer'||ranger.job!=='arqueiro')return {ok:false,first,secondOptions};
        const secondSelected=selectLineageClass('silver_ranger');
        sv.lv=76;const thirdOptions=lineageOptions(),sentinel=thirdOptions.find(x=>x.id==='moonlight_sentinel');
        if(!sentinel||sentinel.role!=='archer'||sentinel.job!=='ranger')return {ok:false,first,secondOptions,thirdOptions};
        const thirdSelected=selectLineageClass('moonlight_sentinel');
        return {ok:firstSelected&&secondSelected&&thirdSelected,first,second:{selected:secondSelected,classId:sv.lineageSecondClass},
          third:{selected:thirdSelected,classId:sv.lineageThirdClass,job:sv.job,role:sv.lineageRole,skin:sv.frog.externalSkin},
          options:options.map(x=>x.id)};
      }finally{
        loadExternalFrogSkin=originalSkinLoader;
        Object.keys(sv).forEach(k=>delete sv[k]);
        Object.assign(sv,snapshot);
        save(true);
      }
    });
    if(!elfArcherTransfer.ok||elfArcherTransfer.first.classId!=='elven_scout'||
      elfArcherTransfer.first.job!=='arqueiro'||elfArcherTransfer.first.role!=='archer'||
      elfArcherTransfer.second.classId!=='silver_ranger'||
      elfArcherTransfer.third.classId!=='moonlight_sentinel'||
      elfArcherTransfer.third.job!=='ranger'||elfArcherTransfer.third.role!=='archer'||
      elfArcherTransfer.third.skin!=='/skins/classes/Rogue_Hooded.glb'){
      throw new Error('A transferência Elven Scout não ativa a classe Arqueiro corretamente: '+JSON.stringify(elfArcherTransfer));
    }

    // Load the actual archer skin and ranged animation role in the browser, equip a bow,
    // and verify that a projectile is emitted from a hand/grip rather than the torso.
    const archerRuntime=await page.evaluate(async()=>{
      const snapshot=JSON.parse(JSON.stringify(sv)),inventorySnapshot=JSON.parse(JSON.stringify(inv)),uidSnapshot=uid;
      const waitFor=async(predicate,timeout=30000)=>{
        const start=performance.now();
        while(performance.now()-start<timeout){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,100));}
        return false;
      };
      try{
        sv.job='guerreiro';sv.lineageRole='fighter';
        spawnBowArrow(new THREE.Vector3(frog.position.x,frog.position.y+1,frog.position.z-4),0xffffff);
        const warriorArrowBlocked={...(window.__rpgCombatVisualDebug||{})};
        sv.race='elf';sv.lineageRace='elf';sv.lineageRole='archer';sv.job='arqueiro';
        sv.lineageClass='Elven Scout';sv.lineageClassId='elven_scout';sv.lineageBaseClass='fighter';
        sv.lineageStage=1;sv.lv=20;sv.jlv=1;sv.frog=sv.frog||{};
        sv.frog.externalSkin=playableClassSkin('arqueiro');
        loadExternalFrogSkin(sv.frog.externalSkin,null);
        const skinReady=await waitFor(()=>window.__rpgPlayerAnimationDebug?.skin==='/skins/classes/Rogue_Hooded.glb'&&
          window.__rpgAnimationAssetDebug?.role==='archer'&&window.__rpgAnimationAssetDebug.clips>=20);
        if(!skinReady)return {ok:false,reason:'archer skin/animation timeout',skin:window.__rpgSkinLoadDebug,animation:window.__rpgPlayerAnimationDebug,assets:window.__rpgAnimationAssetDebug};
        rpgEnsureClassWeapon('arqueiro');rpgEquipWeaponVisual(null,'arqueiro');
        const weaponReady=await waitFor(()=>window.__rpgWeaponDebug?.loaded===true);
        const weapon={...(window.__rpgWeaponDebug||{})};
        spawnBowArrow(new THREE.Vector3(frog.position.x,frog.position.y+1.1,frog.position.z-5),0x8ad9ff);
        const projectile={...(window.__rpgCombatVisualDebug||{})};
        updateBowArrows(1);
        const clipMap={...(window.__rpgPlayerAnimationDebug.clipMap||{})};
        const roleAttackMap={};
        for(const role of ['fighter','tank','dagger','mage','healer','support','archer']){
          _mapKayKitPlayerClips(_externalFrogAvailableClips,role);
          roleAttackMap[role]=_externalFrogClips.attack&&_externalFrogClips.attack.name||null;
        }
        _mapKayKitPlayerClips(_externalFrogAvailableClips,'archer');
        playLineageCombatAnimation('archer','q');
        const attackClip=frog.userData._animOverride?.clip?.name||null;
        return {ok:skinReady&&weaponReady,role:window.__rpgPlayerAnimationDebug.role,roleAttackMap,
          skin:window.__rpgPlayerAnimationDebug.skin,clips:window.__rpgAnimationAssetDebug.clips,
          clipMap,attackClip,allClipNames:_externalFrogAvailableClips.map(c=>c.name),weapon,projectile,warriorArrowBlocked};
      }finally{
        Object.keys(sv).forEach(k=>delete sv[k]);Object.assign(sv,snapshot);
        inv.splice(0,inv.length,...inventorySnapshot);uid=uidSnapshot;save(true);
        if(snapshot.frog?.externalSkin){loadExternalFrogSkin(snapshot.frog.externalSkin,null);}
        if(snapshot.job){rpgEnsureClassWeapon(snapshot.job);rpgEquipWeaponVisual(null,snapshot.job);}
      }
    });
    if(!archerRuntime.ok||archerRuntime.role!=='archer'||archerRuntime.skin!=='/skins/classes/Rogue_Hooded.glb'||
      archerRuntime.weapon.family!=='bow'||archerRuntime.projectile.blocked||
      !['bow-grip','right-hand','weapon-rig'].includes(archerRuntime.projectile.originSource)||
      archerRuntime.projectile.origin[1]-archerRuntime.projectile.playerY<.65||
      archerRuntime.warriorArrowBlocked.blocked!==true||
      archerRuntime.clipMap.attack!==archerRuntime.clipMap.shoot||
      archerRuntime.attackClip!==archerRuntime.clipMap.shoot||
      !/(shoot|release|fire)/i.test(archerRuntime.clipMap.attack||'')||
      !/(slash|melee|sword|chop)/i.test(archerRuntime.roleAttackMap.fighter||'')||
      !/(slash|melee|sword|chop)/i.test(archerRuntime.roleAttackMap.tank||'')||
      !/(slash|melee|sword|chop)/i.test(archerRuntime.roleAttackMap.dagger||'')||
      !/(spell|cast)/i.test(archerRuntime.roleAttackMap.mage||'')||
      !/(spell|cast)/i.test(archerRuntime.roleAttackMap.healer||'')||
      !/(spell|cast)/i.test(archerRuntime.roleAttackMap.support||'')||
      !/(shoot|release|fire)/i.test(archerRuntime.roleAttackMap.archer||'')||
      /(running|walking|holding|aiming|reload|draw)/i.test(archerRuntime.clipMap.attack||'')||
      !/(jump|land)/i.test(archerRuntime.clipMap.jump||'')||
      /(attack|slash|melee|sword|shoot|cast)/i.test(archerRuntime.clipMap.jump||'')){
      throw new Error('Skin, animação, arco ou origem do projétil do Arqueiro incorretos: '+JSON.stringify(archerRuntime));
    }

    // Independently inspect the GLB and verify the full imported animation library.
    const playerAnimationCheck = await page.evaluate(async () => {
      if (!window.THREE || !THREE.GLTFLoader) throw new Error('GLTFLoader não está disponível para testar a skin do jogador.');
      const gltf = await new Promise((resolve, reject) => {
        new THREE.GLTFLoader().load('/skins/lyra-archer-animated.glb', resolve, undefined, reject);
      });
      const bones = [];
      gltf.scene.traverse(node => { if (node.isBone) bones.push(node.name); });
      const names = gltf.animations.map(clip => clip.name || '');
      const has = re => names.some(name => re.test(name));
      const result = {
        clips: names.length,
        bones: bones.length,
        locomotion: has(/idle/i) && has(/walk/i) && has(/run/i) && has(/jump/i),
        combat: has(/attack|slash|sword|punch/i) && has(/block|guard|parry/i),
        reaction: has(/hit|damage|hurt|shot/i),
        death: has(/death|dying|die/i)
      };
      if (result.clips < 80) throw new Error('Biblioteca do jogador incompleta: apenas ' + result.clips + ' clipes.');
      if (result.bones < 15) throw new Error('Rig do jogador incompleto: apenas ' + result.bones + ' ossos.');
      if (!result.locomotion) throw new Error('Faltam animações essenciais de idle/walk/run/jump.');
      if (!result.combat) throw new Error('Faltam animações de ataque/defesa.');
      if (!result.reaction || !result.death) throw new Error('Faltam reações de dano ou morte.');
      return result;
    });
    if (pageErrors.length) throw new Error('Erros JavaScript durante a execução:\n' + pageErrors.join('\n'));

    console.log(JSON.stringify({
      status: 'PASS',
      http: response.status(),
      canvas: canvasSize,
      gameStarted: true,
      activePlayerAnimation,
      walkingState,
      runningState,
      idleState,
      jumpingState,
      initialBossState,
      playerVisibility,
      playerAnimationCheck,
      cameraRuntime,
      rotatedViewport,
      treeAppearance,
      townNpcAppearance,
      monsterCatalogIntegration,
      monsterAppearance,
      monsterRuntimeAssets,
      classTransferState,
      raceBaseClasses,
      elfArcherTransfer,
      archerRuntime,
      runtimeErrors: pageErrors.length
    }, null, 2));
  } catch (error) {
    console.error('GAME SMOKE TEST FAILED:', error.stack || error);
    if (pageErrors.length) console.error('PAGE ERRORS:', pageErrors.join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
