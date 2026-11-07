# Mundo de fantasia do Super Hero

O mapa continua sendo o RPG de exploração existente. Esta camada adiciona cenário 3D real ao redor do terreno e acompanha o personagem conforme ele avança; não substitui combate, missões, monstros, água, terreno ou controles.

## Regiões e ambientação

- **Campos de Valdora / Bosque Rubro:** árvores, arbustos e pequenos pontos de acampamento.
- **Selva Tropical / Pântano Sombrio:** palmeiras e vegetação mais densa.
- **Deserto Dourado / Savana Dourada:** dunas, palmeiras e arcos de templo.
- **Vulcão / Cristais Brilhantes:** formações de cristais.
- **Ruínas Antigas:** arcos, colunas quebradas, paredes em ruínas e marcos de castelo.

## Assets 3D importados

Os modelos estão em `assets/world/` e são carregados por Three.js GLTFLoader:

- 3 árvores e 1 arbusto.
- 1 marco de castelo/fortificação.
- 1 duna, 1 palmeira, 1 arco de templo e 1 tocha.
- 2 formações de cristal.
- 1 arco, 1 coluna quebrada e 1 parede em ruínas.
- 1 carrinho, 1 barril, 1 lampião e 1 entrada de feira/vila.
- Pacote Cave and Crystal Caverns: 94 peças modulares CC0 (túneis, curvas, câmaras, entradas, cristais, estalactites e estruturas) mais uma cena de rede de cavernas montada.

Total: 18 modelos GLB de ambiente, mais 94 peças modulares de masmorra e 1 cena montada. Os arquivos são binários GLB reais, não ponteiros Git LFS.

## Masmorras e cavernas

Três ambientes de masmorra aparecem em diferentes trechos da exploração: Caverna Antiga, Gruta dos Cristais e Galeria Alagada. Ao chegar à entrada, pressione E para entrar; pressione E novamente para voltar à superfície. Dentro de cada masmorra há três cristais coletáveis que concedem ouro e EXP, com progresso salvo para não repetir o saque completo. Ao entrar, três guardiões (abóbora assombrada, fantasma e esqueleto, com modelos GLB aleatórios do catálogo) protegem a câmara. Derrotar os três libera um tesouro secreto de +150 ouro, 120 EXP e equipamento raro; a conclusão fica salva. Se o jogador sair antes de vencer, os guardiões restantes são removidos e reaparecem na próxima visita. Também existem dois baús por masmorra: um comum (+65 ouro e 45 EXP) e um raro (+120 ouro e 85 EXP), ambos entregam equipamento e salvam o saque. O personagem fica limitado à área interna para não escapar do cenário. Essa é uma barreira lógica de movimento; colisão física detalhada com cada parede/túnel ainda precisa ser implementada e testada. O pacote modular também fica disponível individualmente para construir masmorras adicionais, salas de chefes, túneis e câmaras. Os modelos são CC0 1.0 e usam GLB com texturas incorporadas.

Fonte: https://3dassets.dev/packs/cave-and-crystal-networks

## Desempenho

- Os cenários são divididos em trechos de 90 m ao redor do jogador.
- Trechos distantes são removidos e os próximos são carregados conforme a exploração.
- Em aparelhos com pouca memória, a densidade de árvores e o raio de trechos ativos são reduzidos.
- Sombras dos objetos de ambiente são desativadas no perfil de pouca memória.
- Os modelos não são carregados de uma só vez em todo o mundo.

## Licenças e procedência

- Quaternius Stylized Nature: CC0 1.0.
- Polygonal Mind CC0 GLB collection: CC0, conforme a licença declarada pelo publicador.
- Medieval Castle Construction: CC0 1.0, conforme a licença declarada pelo publicador.

As fontes, links e notas de licença estão em [assets/world/README.md](../assets/world/README.md).
O importador está em `scripts/import_rpg_world_assets.py`. A importação é manual, não diária.
A integridade dos GLBs é verificada por `scripts/validate_rpg_world_assets.py`.
A integridade do áudio CC0 (quantidade por pacote, caminhos, tamanho, SHA-256 e cabeçalho OGG das três faixas musicais) é verificada por `scripts/validate_rpg_audio.py` no workflow de integridade.


## Áudio, combate e efeitos visuais

O motor de efeitos existente usa partículas GPU/Three.js, anéis, brilhos, feixes e explosões leves, respeitando a preferência de movimento reduzido do sistema. Foram adicionados efeitos de impacto para inimigos, morte de monstros, acerto e chegada de chefes, derrota de chefes, dano recebido, passos, entrada em masmorras, abertura de baús e ativação de habilidades.

Os monstros com clips GLB agora alternam entre idle, caminhada, ataque e morte: ataques corpo a corpo e investidas telegrafadas acionam o clip de ataque em reprodução única; ao morrer, o clip de morte é reproduzido por até 950 ms antes da remoção do modelo. Modelos sem clip compatível continuam usando o modelo-base sem interromper o combate.

Os efeitos sonoros têm fallback sintetizado via Web Audio para funcionar mesmo sem os arquivos externos. Quando o catálogo de áudio estiver presente, o jogo tenta selecionar automaticamente sons reais por categoria (golpes, monstros, magia, baús, moedas e níveis).

### Pacotes CC0 preparados para importação

- Kenney — 50 RPG sound effects, CC0: https://opengameart.org/content/50-rpg-sound-effects
- rubberduck — 80 CC0 RPG SFX: https://opengameart.org/content/80-cc0-rpg-sfx
- rubberduck — 80 CC0 creature SFX: https://opengameart.org/content/80-cc0-creature-sfx

O importador `scripts/import_rpg_audio.py` baixa os arquivos OGG/WAV/MP3/FLAC/M4A, guarda os arquivos por pacote em `assets/audio/` e gera `assets/audio/catalog.json` com hashes SHA-256 e procedência. Já foram importados **211 arquivos de áudio (cerca de 4,77 MB)**: 51 arquivos Kenney, 80 efeitos RPG e 80 efeitos de criaturas. O jogo escolhe sons por nome/categoria no catálogo e mantém sons sintetizados como fallback. A importação futura está disponível em **Actions → Import CC0 RPG audio packs → Run workflow**. Esse workflow voltou a ser manual, sem agenda e sem gatilho por push.


### Música de fundo CC0

Foram adicionadas três faixas OGG CC0: tema de menu de qubodup, música de exploração/batalha de qubodup e ambiência contínua de caverna de Paul Wortmann. O jogo inicia a música após o primeiro toque/tecla (restrição de autoplay dos navegadores), faz transição suave entre menu, mundo e masmorras e respeita os controles existentes de som, música e volume musical. A música de exploração também acompanha as batalhas de chefe; a masmorra usa a faixa de caverna. Fontes: https://opengameart.org/content/two-simple-game-music-loops e https://opengameart.org/content/dark-cavern-ambient.


## Texturas PBR do mundo

O jogo agora inclui 12 materiais PBR CC0 da Poly Haven em resolução 1K: grama, chão de floresta, folhas e lama, areia compactada, terreno rochoso, neve, rocha, concreto, paralelepípedo, madeira envelhecida, casca de árvore e metal. O manifesto `assets/textures/polyhaven/manifest.json` registra os mapas e hashes.

O terreno voxel recebe UVs e troca o conjunto diffuse/albedo, normal e roughness conforme o bioma: pradaria, floresta/selva, deserto/savana, pântano, vulcão, cristais, montanha nevada e ruínas. Props de madeira e pedra sem textura embutida também recebem mapas diffuse CC0; texturas originais de GLBs não são substituídas. Os mapas são carregados sob demanda por bioma e reutilizados em cache para limitar memória em celulares.

Fonte e licença: [Poly Haven](https://polyhaven.com/) — CC0 1.0 Universal. O workflow de importação foi restaurado para execução manual (`workflow_dispatch`).
