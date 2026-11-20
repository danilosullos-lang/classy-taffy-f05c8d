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

## Arquitetura do mapa — inspeção estática do código
- O modo Campo Aberto gera células dinamicamente ao redor do jogador e remove as células distantes; portanto, não é um mapa finito com um único perímetro a percorrer.
- O terreno é procedural e escolhe biomas por coordenadas: Campos de Valdora, Floresta Sombria, Tundra Gelada, Deserto Escaldante e Terras Vulcânicas.
- Pontos de interesse também são gerados por região: vilarejos, ruínas e totens; totens descobertos alimentam a viagem rápida.
- Há água/lagos/rios e elevações no gerador de terreno, mas sua colisão e travessia ainda precisam ser verificadas em execução.
- Consequência para QA: a validação correta deve cobrir rotas representativas e cada bioma/POI gerado, não afirmar que um mundo procedural potencialmente ilimitado foi totalmente percorrido.


### QA-009 — Modelos-base compartilhados entre classes
Severidade: média/alta (identidade visual das classes).
Evidência por inspeção do catálogo local: há quatro modelos de personagem na pasta skins/classes (Barbarian, Knight, Mage e Rogue_Hooded). A tabela PLAYABLE_CLASS_SKINS reutiliza Mage para Mago/Sacerdote, Rogue_Hooded para Ladino/Arqueiro e Knight para Cavaleiro/Paladino/Templário. As classes podem variar por arma, animação e tintura, mas não têm um GLB exclusivo cada uma.
Status: confirmado por inspeção de arquivos/código; precisa de modelos distintos ou de variações visuais substanciais antes de considerar as classes visualmente finalizadas.

### QA-010 — Efeitos de habilidades ainda genéricos
Severidade: média (polimento visual; mecânica de classe já tem roteamento próprio).
Evidência por inspeção do código: lineageSkill() seleciona conjuntos de habilidades por papel (fighter, tank, archer, dagger, mage, healer, support, crafter), porém grande parte usa o mesmo helper genérico de anel + explosão (fxRing/fxBurst). Isso não prova ausência de partículas, mas indica pouca diferenciação visual entre fogo, flechas, veneno, cura, escudo, gelo/raio e ultimates.
Status: pendente de teste visual por classe e de VFX específicos por habilidade.


## Regressão após correções — 04/11/2026
- Deploy do commit 7ed0e8996d2cdf109bb80476358ed33310223d46 ficou LIVE no Render.
- Teste visual não destrutivo no site publicado confirmou o rótulo da prévia do Guerreiro como “Guerreiro — KayKit” e a descrição corrigida.
- Prévia do Mago também foi lida como “Mago — KayKit”. Arqueiro, Ladino e Sacerdote apareceram na grade, mas não foram selecionados individualmente nesta rodada; não marcar como testados.
- Modo leve do navegador móvel desativa a prévia 3D para todas as classes, mantendo a criação disponível.
- Nenhum texto literal “NaN” apareceu na tela inicial/termos/seletor. O cenário específico de save antigo com coordenada inválida ainda requer teste de retomada; a correção no código já valida o número e usa “posição salva” como fallback.
- Deploy dos documentos de QA também ficou LIVE; último registro no Render confirma atualização automática a cada commit.


## QA-011 — Áudio dos monstros (04/11/2026)

- Catálogo já presente no repositório: 234 arquivos de áudio CC0 em 6 pacotes; 100 arquivos pertencem a pacotes de criaturas/monstros.
- Mapa de áudio existente: 220 perfis por caminho de modelo, cada um com pools de ataque, aggro, dano, morte e ocioso.
- Causa encontrada no código: um caminho de ataque chamava o som sem passar a referência do monstro, fazendo cair no pool genérico; além disso, sons próximos usavam até 82% do volume do controle e havia limitação global por tipo de som.
- Correção publicada: passar a referência do monstro em todos os ataques; aguardar o mapa individual antes de usar fallback; manter fallback se o mapa falhar; volume dos sons de criaturas reduzido por evento (ocioso 13%, alerta 24%, ataque 28%, dano 22%, morte 30%, multiplicados pelo controle geral e distância); variação leve de pitch e cooldown por criatura/evento.
- Deploy Render: commit `1833cab6b30c673e1e9ea233a63b366e63ed05fc`, status LIVE.
- Regressão automatizada: `catalog.json` e `audio-map.json` responderam HTTP 200. Não havia monstro visível na área de teste, portanto não foi possível confirmar auditivamente a diferença de timbre nem o volume real durante combate. Marcar como correção de código publicada, validação auditiva pendente.


## QA-012 — PvP e arena (04/11/2026)

### Sistemas encontrados
- PvP de mundo aberto é ativado quando o personagem está em execução, nível 20 ou superior e `abs(st.d) >= 110`; a zona mostra o painel de alvos próximos (até 40 unidades) e usa CP antes de HP.
- Dano PvP é transmitido por mensagens P2P via Trystero/WebRTC; o cliente receptor aplica limite por pacote e reduz dano recebido. Isso não é um servidor autoritativo: clientes modificados ainda podem tentar falsificar mensagens.
- A arena atual é um minijogo de turnos Pedra-Papel-Tesoura (Ataque/Magia/Defesa), não combate 3D em tempo real. Exige dois jogadores online na mesma sala e itens para apostar; o perdedor transfere o item.
- A tela de título não expõe a Arena. O acesso fica na aba Arena do inventário/menu após entrar no mundo. O teste visual automatizado ficou na tela de título e contou somente um jogador; não foi possível realizar duelo real nem validar painel em combate.

### Problemas corrigidos no código
- QA-012a: o resultado do abate não enviava o estado completo da vítima; um jogador que estava violeta podia ser contado como PK e receber karma indevido. Agora o estado de flag no instante da morte é enviado e só vítima pacífica gera karma.
- QA-012b: o receptor de dano não verificava distância nem elegibilidade completa do atacante. Agora exige presença no mundo aberto, flag PvP ativo, nível mínimo e distância de até 40 unidades antes de aplicar dano.

### Pendências de validação
- Teste real com duas sessões/dispositivos e personagens nível 20+ em zona PvP.
- Verificar CP absorvendo dano antes de HP, flags pacífico/violeta/vermelho, mortes, karma, cooldown de drop e transferência de itens.
- Arena: testar convite, aceitar/recusar, rodadas, empate, vitória/derrota e consistência de inventário dos dois lados.
- Recomenda-se backend autoritativo para combate e inventário antes de abrir PvP competitivo com recompensas valiosas; a implementação P2P atual não impede adulteração do cliente.
- Nenhum pacote de áudio/modelo foi baixado nesta etapa: o problema identificado é de regra/validação de rede, não falta de assets.
