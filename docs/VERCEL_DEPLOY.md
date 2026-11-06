# Deploy do Super Hero na Vercel

O projeto está preparado como site estático. A aplicação é servida diretamente por `index.html`; não precisa de Node.js, npm, bundler ou comando de build.

## Configuração do projeto Vercel

- Repositório: `danilosullos-lang/classy-taffy-f05c8c`
- Branch de produção: `main`
- Framework Preset: **Other**
- Root Directory: `./`
- Build Command: deixar vazio / **Override desativado**
- Output Directory: `.` (raiz do repositório)
- Install Command: deixar vazio / **Override desativado**

O arquivo `vercel.json` define cabeçalhos de cache para assets e evita cache prolongado do `index.html`.

## Publicação automática

Quando a Vercel liberar/conectar o projeto Git, cada push na branch `main` poderá gerar um deployment de produção pela integração Git da Vercel. Não foi incluído token, segredo ou credencial Vercel no repositório.

## Verificações antes de publicar

1. Confirmar que o deployment está usando a branch `main`.
2. Abrir a URL de preview e verificar carregamento de `index.html`.
3. Conferir no navegador se os GLBs e texturas em `/assets/` carregam sem erro 404.
4. Testar animações de idle, caminhada, ataque e morte em alguns monstros.
5. Só então promover/publicar a versão de produção.

## Observação

Os testes do GitHub Actions verificam sintaxe e integridade estrutural dos assets, mas não substituem o teste visual em navegador. A publicação depende da conexão/autorização do projeto na conta Vercel.
