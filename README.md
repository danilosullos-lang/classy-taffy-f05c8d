# Aetheria RPG

Base inicial do cliente MMORPG 3D web/mobile. O projeto prioriza bibliotecas maduras e assets com licenças verificáveis.

## Módulo 1 — cliente 3D
- Babylon.js para renderização 3D e carregamento de modelos glTF/GLB.
- Vite + TypeScript para desenvolvimento e build.
- Controles WASD/setas e joystick virtual para telas sensíveis ao toque.
- Colisões básicas do mundo e câmera de acompanhamento.
- Canvas responsivo com viewport mobile e áreas seguras.

## Módulo 2 — autenticação e persistência
- Supabase Auth com e-mail/senha via `@supabase/supabase-js`.
- Migração PostgreSQL para perfis e personagens.
- RLS para isolar os dados por proprietário.
- Progressão de personagem protegida: clientes não recebem permissão de UPDATE em nível/experiência.
- Nenhuma chave secreta incluída no repositório.

### Configuração do Supabase
1. Crie um projeto no Supabase.
2. Copie `.env.example` para `.env.local`.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave pública (publishable/anon) do projeto.
4. Aplique `supabase/migrations/20261106000100_initial_schema.sql` no SQL Editor do Supabase ou usando Supabase CLI após vincular seu projeto.
5. Configure as URLs permitidas de autenticação no painel Supabase para seu domínio local e domínio publicado.

**Segurança:** nunca use `service_role`, secret key ou senha do banco em variáveis `VITE_*`; elas são incorporadas ao JavaScript enviado ao navegador. Operações confiáveis de progressão precisam ser feitas por um servidor de jogo com segredo mantido exclusivamente no servidor.

## Requisitos
- Node.js 20 ou superior
- npm

## Executar
```bash
npm install
npm run dev
```

## Validar
```bash
npm run check
npm run build
```

## Próximos módulos
3. Classes e progressão: Guerreiro, Arqueiro, Mago e Anão com Spoil/Crafting.
4. Navegação e combate: pathfinding, colisão e combate PvE/PvP autoritativo.
5. UI: inventário, grupo, status e habilidades.
6. Mundo: spawners, NPCs e Raid Bosses.

> O cliente atual é uma fundação de protótipo. Ainda não contém servidor multiplayer, integração de sessão visual na UI, mundo final ou assets finais.
