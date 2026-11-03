# Skins de classes e NPCs

Os modelos KayKit abaixo são usados no criador de classes, no personagem jogável e nos NPCs da vila. Os arquivos originais e a licença estão em `skins/classes/`.

| Uso no jogo | Modelo | Origem | Licença |
|---|---|---|---|
| Guerreiro | KayKit Barbarian | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 |
| Cavaleiro, Guardião do Portal e Ferreiro | KayKit Knight | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 |
| Mago, Sacerdote e Mestre de Missões | KayKit Mage | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 |
| Ladino, Assassino e Mercador | KayKit Rogue Hooded | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 |
| Arqueiro e Patrulheiro | Lyra Archer | https://github.com/danilosullos-lang/classy-taffy-f05c8c/tree/main/skins | Conforme créditos do asset original |

KayKit source revision: `672074b73ba276876a19e8816ecdc5241817ab47`.

A licença incluída no pacote declara Creative Commons Zero (CC0), permitindo uso pessoal, educacional e comercial sem exigência de atribuição. O arquivo original está em `skins/classes/KAYKIT-LICENSE.txt`.

## Implementação dos NPCs

- Os NPCs usam clones independentes dos modelos rigged, preservando esqueleto e materiais.
- Quando o modelo inclui um clipe de repouso, o jogo o reproduz com `THREE.AnimationMixer`.
- As cores são aplicadas em materiais clonados para diferenciar funções sem alterar a skin compartilhada.
- Em aparelhos com pouca memória, o jogo carrega somente Knight e Mage para os NPCs; o Mercador usa uma variação do Knight.
- A prévia 3D do criador/editor é desativada no modo leve para evitar criar contextos WebGL extras.

## Otimização de memória

Em aparelhos móveis com até 4 GB de memória reportada, o arqueiro usa temporariamente o modelo KayKit Rogue Hooded com o arco equipado, em vez do GLB Lyra de aproximadamente 40 MB. Em dispositivos com memória suficiente, a skin Lyra original continua disponível.
