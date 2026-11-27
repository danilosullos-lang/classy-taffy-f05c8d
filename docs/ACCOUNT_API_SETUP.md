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

O endpoint `PUT /api/characters` usa compare-and-swap pela coluna `revision`: criações enviam `expectedRevision: 0` e não sobrescrevem um slot ocupado; atualizações enviam o `id` e a revisão retornada no último `GET`. A API só atualiza quando usuário, ID e revisão coincidem, incrementa a revisão e retorna HTTP `409 character_revision_conflict` se outro dispositivo salvou primeiro. Atualize a lista e confira o personagem antes de tentar novamente. Não é necessária migração adicional: a coluna `revision` já existe no schema atual.

## Uso no jogo

Na tela inicial, abra **☁️ Conta / Nuvem**, registre-se ou entre e escolha **Salvar na nuvem**. **Restaurar selecionado** substitui o save local atual somente após confirmação. O save local continua disponível offline.

A API retorna HTTP 503 até que `DATABASE_URL`, `JWT_SECRET` e o schema/migration necessários estejam configurados. Nenhuma credencial ou segredo de banco fica versionado no projeto.

## Sincronização automática opcional

No painel Conta / Nuvem, primeiro faça um salvamento manual ou restaure a cópia escolhida. Isso estabelece a versão inicial e evita que um save local antigo seja enviado automaticamente sobre uma cópia diferente da nuvem. Depois, marque Sincronizar automaticamente as alterações locais na nuvem. A opção vem desligada por padrão e pode ser desativada a qualquer momento.

O cliente espera 1,6 segundo após a última gravação local antes de enviar uma cópia, serializa os pedidos e repete falhas temporárias com backoff limitado. Respostas de conflito de revisão, autenticação inválida ou limite de tamanho pausam a sincronização automática; o save local não é removido nem substituído.

Um marcador pequeno em localStorage registra slot, ID, revisão e impressão do save pendente. Após reload, o cliente compara o marcador com a revisão e os dados atuais da nuvem. Se o servidor já recebeu a cópia, o marcador é limpo; se a revisão continua igual, a mesma cópia local pode ser reenviada; se a nuvem mudou, a sincronização é pausada para revisão manual. O marcador não contém token nem senha.

A fila automática é uma conveniência de cópia, não um mecanismo de merge de inventário. Se o mesmo personagem for alterado em dois dispositivos, o controle expectedRevision continua rejeitando a gravação concorrente com HTTP 409. Confira a versão desejada antes de salvar novamente.
