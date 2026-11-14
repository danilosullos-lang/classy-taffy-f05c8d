# Aetheria RPG — conta, API e persistência local

O jogo mantém o save offline do navegador. A conta em nuvem é opcional e não desativa o save local.

## Preparar o PostgreSQL

1. Crie um banco PostgreSQL compatível com o driver `@neondatabase/serverless`.
2. Em um banco novo, execute `database/schema.sql`. Esse arquivo cria as tabelas e aplica a política RLS atual.
3. Em um banco que já recebeu o schema anterior, execute `database/migrations/001_character_rls.sql`. Consulte `database/migrations/README.md` para a ordem das migrações.

A tabela `aetheria_characters` usa Row-Level Security com `ENABLE` e `FORCE`. Cada consulta autenticada de personagens roda em uma transação que define o contexto `app.user_id`; a política permite ler ou alterar somente linhas cujo `user_id` corresponda ao usuário autenticado. A tabela de contas permanece acessível apenas pelo código da API; o navegador nunca recebe credenciais SQL.

Use uma role de banco sem privilégios de superusuário e sem `BYPASSRLS`. Não conceda `DATABASE_URL` ao cliente.

## Executar localmente

No terminal local, configure as variáveis apenas no ambiente da sessão:

```sh
export DATABASE_URL='sua-connection-string-postgresql'
export JWT_SECRET="$(openssl rand -base64 48)"
npm install
npm start
```

O servidor Node inicia em `http://localhost:3000`. O segredo JWT deve ter pelo menos 32 bytes; não o coloque no Git.

## Endpoints

- `POST /api/auth/register` — JSON `{ "email": "...", "password": "mínimo de 10 caracteres" }`.
- `POST /api/auth/login` — retorna token bearer com validade de 12 horas.
- `GET /api/characters` — lista somente os personagens do usuário autenticado.
- `PUT /api/characters` — cria/atualiza um personagem nos slots 0–5.

As senhas são armazenadas com hash scrypt. Os valores SQL são parametrizados. A API valida nome, raça, classe, nível, posição, vitais e tamanho do save. A classe `crafter` é exclusiva da raça `dwarf`.

## Uso no jogo

Na tela inicial, abra **☁️ Conta / Nuvem**, registre-se ou entre e escolha **Salvar na nuvem**. **Restaurar selecionado** substitui o save local atual somente após confirmação. O save local continua disponível offline.

A API retorna HTTP 503 até que `DATABASE_URL`, `JWT_SECRET` e o schema/migration necessários estejam configurados. Nenhuma credencial ou segredo de banco fica versionado no projeto.
