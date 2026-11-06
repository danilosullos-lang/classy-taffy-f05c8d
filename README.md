# Aetheria RPG

Base inicial do cliente MMORPG 3D web/mobile. O projeto prioriza bibliotecas maduras e assets com licenças verificáveis.

## Módulo 1 — cliente 3D
- Babylon.js para renderização 3D e carregamento de modelos glTF/GLB.
- Vite + TypeScript para desenvolvimento e build.
- Controles WASD/setas e joystick virtual para telas sensíveis ao toque.
- Colisões básicas do mundo e câmera de acompanhamento.
- Canvas responsivo com viewport mobile e áreas seguras.

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

## Próximas integrações
1. Autenticação e persistência: Supabase Auth + PostgreSQL, com políticas RLS.
2. Classes e progressão: dados de classe/skills separados do cliente.
3. Navegação e combate: Recast Navigation e sistema autoritativo no servidor.
4. UI: inventário, grupo, status e habilidades.
5. Mundo: spawners, NPCs e Raid Bosses.

> O cliente atual é um protótipo de fundação visual e movimentação. Não contém ainda servidor multiplayer, persistência, combate ou assets finais.
