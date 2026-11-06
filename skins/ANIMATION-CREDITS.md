# Player character animations

O personagem jogável usa as animações gratuitas KayKit Character Animations 1.1, CC0 1.0, exportadas para o rig humanoide Rig_Medium.

- Criador e fonte oficial: https://kaylousberg.itch.io/kaykit-character-animations
- Arquivos GLB distribuídos: https://github.com/GeorgeQLe/assets-kaykit-3d-characters
- Licença original CC0: https://creativecommons.org/publicdomain/zero/1.0/
- O pipeline importa 8 conjuntos: General, Movement Basic, Movement Advanced, Combat Melee, Combat Ranged, Simulation, Special e Tools.
- O validador compara os nomes dos ossos dos quatro modelos com os alvos de animação antes de publicar os arquivos.
- Foram validados 139 clipes e 23 alvos de osso em comum com o rig do personagem.
- O jogo carrega conjuntos comuns de movimento e reações e seleciona o conjunto de combate corpo a corpo ou à distância de acordo com o arquétipo.
- Tracks de posição e escala são filtrados no personagem jogável para impedir root motion indevido, deformações e desaparecimento do modelo.

As bibliotecas Quaternius UAL1/UAL2 permanecem no repositório como material de referência; o personagem jogável usa os clipes KayKit porque compartilham diretamente o rig Rig_Medium dos modelos de classe.
