# Arquivos grandes do jogo

Este projeto usa duas formas de guardar arquivos grandes sem dividir modelos 3D.

## 1. Pelo navegador do celular: GitHub Releases (mais simples)

Use Releases para arquivos maiores que o limite de upload de arquivos comuns do repositório.

1. Abra https://github.com/danilosullos-lang/classy-taffy-f05c8c/releases
2. Toque em **Create a new release** (ou **Draft a new release**).
3. Crie uma tag, por exemplo `assets-2026-11-02`.
4. Dê um título, por exemplo `Modelos e animações 3D`.
5. Em **Attach binaries**, selecione o arquivo GLB, FBX, ZIP ou pacote.
6. Publique a release.
7. Copie o link do arquivo anexado e use esse endereço no projeto ou registre-o no inventário de assets.

O GitHub Releases aceita arquivos individuais de até 2 GiB. Releases são downloads anexados à versão; não aparecem automaticamente dentro da pasta do repositório.

## 2. Git LFS: arquivos que precisam acompanhar o histórico do projeto

O arquivo `.gitattributes` deste repositório já marca formatos binários grandes (GLB, FBX, BLEND, Unitypackage, ZIP, 7Z, RAR, MP4 e WAV) para Git LFS.

Para enviar esses arquivos pelo Git, o computador ou Termux precisa ter Git LFS instalado e inicializado:

```bash
git lfs install
git lfs track "*.glb" "*.fbx" "*.blend" "*.unitypackage" "*.zip"
git add .gitattributes
git add caminho/do/arquivo.glb
git commit -m "Add large 3D asset with Git LFS"
git push
```

**Importante:** a configuração no `.gitattributes` não transforma um upload comum do navegador em Git LFS. Para usar LFS, envie pelo cliente Git com Git LFS instalado. Git LFS tem cotas de armazenamento e transferência conforme o plano da conta; confira o consumo antes de subir muitos arquivos.

## Qual método usar?

- Está no Android e quer evitar comandos: **GitHub Releases**.
- Quer que o asset seja versionado junto com o código: **Git LFS**.
- Não divida arquivos GLB/FBX em partes; mantenha o arquivo original íntegro.

## Referenciar assets hospedados em Releases

Prefira manter no código uma URL estável e documentada para cada asset. Não coloque arquivos grandes diretamente no HTML como base64. Registre nome, formato, tamanho, licença e URL do arquivo para facilitar a manutenção.
