# Aetheria RPG — QA de exploração (04/11/2026)

URL testada: https://classy-taffy-f05c8d.onrender.com
Versão observada: Crônicas de Elyndor v52 / v5.2.
Método: sessões de navegador isoladas; nenhuma gravação da conta pessoal foi alterada.

## Cobertura comprovada
- Fluxo de termos, início, seleção e criação de personagem Guerreiro/Humano.
- Entrada no mundo 3D e renderização do canvas.
- Região observada: Talking Island / Campos de Valdora.
- Caminhada parcial em terreno gramado; árvores dispersas; estruturas externas; NPCs e monstros; interação com NPC de missão; combate com Cobra.
- Sistema de combo e autosave observados.
- HUD, minimapa, barra de habilidades e menus examinados.
- Cobertura do mapa: estimativa visual de 15–20%; NÃO é uma varredura completa.
- Outras quatro classes e outras regiões não foram confirmadas em jogo nesta rodada.

## Bugs e pendências encontrados

### QA-001 — Distância inválida no botão Continuar
Severidade: alta (interface; não bloqueia o jogo).
Evidência: a interface exibiu Continuar (NaN m).
Causa provável: startLabels() formatava sv.cp.z sem validar se era número finito.
Correção aplicada: validar Number.isFinite; quando não houver coordenada válida, mostrar posição salva.
Status: corrigido no código; aguardando confirmação após deploy.

### QA-002 — Nome incorreto na prévia do Guerreiro
Severidade: média (texto de classe).
Evidência: classe Guerreiro mostrava Bárbaro — KayKit.
Correção aplicada: rótulo agora é Guerreiro — KayKit e esclarece que Barbarian é o modelo-base.
Status: corrigido no código; aguardando confirmação após deploy.

### QA-003 — Inconsistência entre ícones e nomes das habilidades
Severidade: média (clareza da interface).
Evidência observada: nomes/ícones no seletor e na barra durante o jogo não coincidem em algumas habilidades (C, H, T e V).
Status: pendente de revisão da tabela única de habilidades; não alterado sem rastrear os efeitos reais de cada tecla.

### QA-004 — Prévia 3D indisponível em modo leve
Severidade: baixa / limitação de dispositivo.
Evidência: mensagem informa que a prévia 3D foi desativada para proteger memória.
Status: investigar; não forçar WebGL extra em dispositivos de pouca memória.

### QA-005 — Diferença racial não comprovada
Severidade: média / pendente de validação.
Evidência: existem cinco raças selecionáveis; a rodada não conseguiu confirmar visualmente cada combinação raça/classe.
Status: testar cinco raças e comparar modelo, proporção, cor e equipamento.

### QA-006 — Nomes de personagem automáticos
Severidade: baixa / melhoria de UX.
Evidência: nomes como Herói### são gerados automaticamente.
Status: avaliar campo de nome; não é falha de renderização.

### QA-007 — Contador de chefe com duas apresentações
Severidade: baixa / possível inconsistência.
Evidência: foram observadas mensagens por distância e por quantidade de abates.
Status: verificar se são estados distintos do mesmo sistema antes de alterar.

### QA-008 — Botão Mundo oculto por CSS
Severidade: pendente; não classificado como bug confirmado.
Evidência: fldBtn começa com display:none; existe também entrada Mapa do mundo no menu.
Status: verificar fluxo pretendido e acessibilidade do mapa antes de mudar.

## Animações, combate, VFX e colisões — checklist pendente
- Guerreiro, Mago, Arqueiro, Ladino e Sacerdote: modelos e armas exclusivos.
- Raças: Humano, Elfo, Elfo Negro, Orc e Anão.
- Idle, andar, correr, pular, aterrissar, esquiva, ataque básico, skill, dano/hit e morte.
- Skills: validar tecla, cooldown, custo, alvo, animação, dano/cura/buff e partículas.
- VFX: impacto, projétil, aura, cura, escudo, fogo, gelo, raio, área e morte.
- NPCs: modelos, animações, nomes, duplicatas e colisões.
- Monstros e chefes: escala, skin, hitbox, IA, telegraph de ataques, morte e loot.
- Mundo: limites, árvores, rochas, paredes, água, pontes, construções e interiores.
- Menus: inventário, equipamento, loja, mapa/teleporte, missões e configurações.
- Mobile: toque, joystick, câmera, safe areas, memória e estabilidade.

## Limites da rodada
A automação conseguiu entrar no mundo e inspecionar a região inicial, mas não completou a troca entre as cinco classes nem a travessia de todas as regiões. Elementos de movimento e combate são desenhados no canvas e parte da automação não conseguiu inspecionar diretamente suas interações. Não declarar o jogo livre de bugs até executar a matriz pendente e repetir os testes após cada correção.