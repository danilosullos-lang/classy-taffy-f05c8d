# Relatório de QA exploratório — Aetheria RPG
Data: 2026-11-04
Build observado: Aventura RPG — Crônicas de Elyndor v52
URL: https://classy-taffy-f05c8d.onrender.com

## Escopo realmente percorrido
- Tela inicial e carregamento de personagem salvo.
- Talking Island / Talking Island Village / Campos de Valdora.
- Campo aberto, árvores, arbustos, grama, flores, terreno, colinas, fogueira, estruturas geométricas, placas, NPCs e HUD.
- Menu Mapa do mundo: apenas Acampamento apareceu como destino de viagem rápida.
- Não foi possível percorrer outras regiões, pois não estavam acessíveis no fluxo explorado.
- Multiplayer: nenhum outro jogador foi encontrado; teleporte entre jogadores e PvP não foram testados.

## Defeitos e suspeitas observados
### QA-2026-11-04-01 — Aparência do personagem não combina com Guerreiro
- Evidência observacional: o personagem carregado como Guerreiro J1 foi descrito visualmente como criatura semelhante a urso, com mochila e cajado.
- Severidade: alta para identidade visual / média para jogabilidade.
- Código relacionado: `PLAYABLE_CLASS_SKINS.guerreiro` aponta para `/skins/classes/Barbarian.glb`.
- Próximo passo: conferir o modelo GLB e a montagem da arma/equipamento; não substituir sem validar compatibilidade do rig e escala.

### QA-2026-11-04-02 — Geometria branca em blocos
- Região: canto inferior direito da viewport em Campos de Valdora.
- Aparência: forma geométrica branca grande, semelhante a placeholder ou rocha não finalizada.
- Severidade: média.
- Próximo passo: identificar o objeto e sua origem no gerador de cenário antes de remover/substituir.

### QA-2026-11-04-03 — Nome do Xamã inconsistente na tela
- Região: Talking Island Village.
- Observação: durante a navegação o rótulo apareceu como “Xamã das Missões” e em outro quadro como “Xamã Assões”.
- O código contém uma única definição de NPC com o nome “Xamã das Missões”; portanto, truncamento/sobreposição/renderização do rótulo é hipótese, não erro de texto confirmado.
- Severidade: baixa.

### QA-2026-11-04-04 — Texturas/estilo excessivamente pixelados
- Região: árvores e estruturas geométricas em Talking Island / Campos de Valdora.
- Observação: aparência pixelada em close; pode ser estilo low-poly/voxel intencional.
- Não classificado como defeito confirmado até comparar com os arquivos fonte.

## Auditoria do repositório
- `index.html` centraliza o runtime do jogo.
- Modelos de classe KayKit estão versionados: Barbarian.glb, Knight.glb, Mage.glb e Rogue_Hooded.glb.
- O Guerreiro é explicitamente mapeado para Barbarian.glb.
- O runtime tem carregamento de animações KayKit por conjuntos separados (locomoção básica/avançada, combate melee/ranged, geral, simulação, especiais e ferramentas).
- Os arquivos KayKit usados pelo runtime são GLB reais no repositório.
- Os GLB Quaternius UAL1/UAL2 em `assets/animations/quaternius/` aparecem no Git como ponteiros Git LFS de 132 bytes. Não devem ser tratados como arquivos GLB diretamente servíveis sem resolver o armazenamento LFS. O runtime auditado usa os conjuntos KayKit, não esses caminhos UAL diretamente.
- Catálogo de monstros: 220 entradas, incluindo assets animados. A existência no catálogo não prova que cada monstro está corretamente atribuído ou visível em cada zona.
- Texturas PBR Poly Haven: 240 arquivos na pasta, aproximadamente 326,6 MB. Há manifest e fallback de texturas no runtime.
- Mundo: 656 arquivos na pasta assets/world, aproximadamente 74,3 MB.
- Armas KayKit: 82 arquivos na pasta assets/weapons, aproximadamente 1,6 MB.

## Não testado / pendente
- Outras regiões e dungeons.
- Chefes e ataques de todas as classes.
- Animações de todas as classes em runtime.
- Colisão detalhada contra paredes, árvores e objetos.
- Inventário/equipamentos em profundidade.
- PvP e multiplayer.
- Água, interiores, ciclos de clima/noite e interações ambientais.
- Verificação visual asset por asset em toda a lista de 220 monstros.

## Conclusão
A inspeção confirma três pontos que merecem investigação/correção, mas não encontrou prova de ausência generalizada de texturas. O escopo foi limitado a Talking Island / Campos de Valdora. Não declarar o jogo “100% pronto” até percorrer as demais regiões e validar cada classe/monstro/skill.
