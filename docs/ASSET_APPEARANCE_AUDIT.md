# Auditoria de aparência dos assets RPG

Última auditoria automatizada: 2026-11-03.

## Resultado verificado

- 5 modelos de vegetação com materiais e texturas: tree1, tree2, tree3, bush e PalmTree.
- 64 modelos de monstros no catálogo, todos com materiais, imagens e referências de spawn verificadas.
- 5 skins jogáveis com material e textura: Lyra/arqueira, Barbarian/guerreiro, Knight/cavaleiro-paladino, Mage/mago e Rogue/ladino.
- 29 modelos de cenário chamados diretamente pelo carregador do mundo, com arquivos existentes e estrutura glTF válida.
- 289 modelos de mundo (113 GLB e 176 glTF) percorridos na auditoria completa; somente `castle_ruins.glb` não tem mapa de cor próprio, e recebe fallback PBR de concreto no carregador.
- 113 modelos GLB de cenário e 176 modelos modulares glTF da vila disponíveis no repositório.
- Os modelos de árvores principais usam imagens WebP incorporadas no GLB; o carregador Three.js do projeto contém suporte à extensão EXT_texture_webp.

## Correções aplicadas

- O carregamento de árvores registra falhas e cria uma árvore/arbusto de reserva com texturas PBR quando um GLB não carrega.
- O modelo `castle_ruins.glb`, único dos 289 modelos do mundo sem mapa de cor próprio, recebe material PBR de concreto; o teste Chromium agora verifica esse fallback.
- Os monstros procedurais de reserva agora recebem mapas PBR de cor, normal e rugosidade enquanto o modelo animado é carregado ou se houver falha.
- Casas, telhados, muralhas e NPCs procedurais da praça também recebem mapas PBR; o fallback das casas agora texturiza as paredes de reboco, portas, telhados, janelas e chaminés.
- O diagnóstico do mundo expõe quais árvores carregaram, quais usaram fallback e os erros dos assets em `window.__rpgWorldDebug`.
- O carregamento de monstros expõe os arquivos solicitados, carregados e com falha em `window.__rpgMonsterAssetDebug`.
- O workflow `Game integrity checks` executa `scripts/audit_rpg_appearance.py` para conferir materiais, texturas, imagens, dependências, catálogo e referências reais no runtime.
- A auditoria agora percorre todos os modelos importados em `assets/world` (GLB e glTF), além dos modelos realmente carregados no mapa, e lista os arquivos sem mapa de cor próprio para garantir que recebam fallback PBR quando usados.
- A descoberta automática de texturas CC0 foi ampliada para materiais de musgo, mármore, ardósia, gelo, rocha vulcânica, armaduras, tecidos e madeira escura. Os papéis são associados aos nomes dos materiais glTF quando encontrados.

## Observação

O catálogo contém mais modelos de cenário do que os 29 carregados diretamente pelo mundo. Os demais são peças modulares de vila/masmorra disponíveis para composições adicionais. Os NPCs de serviço da praça ainda são personagens procedurais de baixa geometria; não fazem parte das 5 skins jogáveis.

## Biblioteca PBR atualizada

- 57 materiais CC0 completos da Poly Haven.
- 172 mapas de textura verificados no manifesto (difuse/base color, normal, roughness e mapas metálicos quando disponíveis).
- A última atualização baixou 10 materiais novos: mármore, musgo, ardósia, rocha escura, rocha natural, piso e madeira escura, entre outros.

## Fontes e licença

As texturas importadas pelo pipeline são da Poly Haven, sob CC0 1.0: https://polyhaven.com/license. A descoberta de materiais é feita pela API pública do Poly Haven e as texturas são baixadas com verificação MD5.
