# Arena BDA

Portal de campeonatos do Clã BDA. O `index.html` apresenta competições, rodadas, classificação, clubes, edição local de placares e backups. As ferramentas anteriores continuam em `arena-completo.html`.

**Estado deste PR:** sincronização oficial desativada. Alterações locais pertencem ao navegador e não publicam resultados. Não houve merge, deploy, migração de produção ou alteração das regras de produção.

## Executar e testar

Requisitos de desenvolvimento: Node.js 24.12 ou superior na linha 24; Java 21 para o emulador. O portal estático não depende de Node em produção.

```sh
npm ci
npm run serve
```

Abrir `http://127.0.0.1:4173`. Não usar `file://` para testar armazenamento, navegação ou service worker.

```sh
npm run check
npm test
bash scripts/check-site.sh
npx playwright install --with-deps chromium webkit
npm run test:browser
npm run test:rules
```

O último comando usa apenas o projeto de demonstração `demo-arena-bda` e as regras candidatas de `firebase.test.json`. O teste recusa execução sem emulador. O workflow do PR executa os mesmos testes, sem credenciais de produção nem etapa de publicação.

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `portal-data.js` | Calendários originais preservados |
| `portal-core.js` | Validação, classificação, gravação local, conflitos e backups |
| `portal.js`, `portal.css` | Interface e navegação mobile |
| `portal-sync.js` | Adaptador opcional de Auth/Firestore e transações por revisão |
| `portal-config.js` | Sincronização desligada por padrão |
| `tests/` | Domínio, navegador, acessibilidade e regras no emulador |
| `docs/firestore-portal-v2.rules` | Regras candidatas; não são as regras implantadas |

## Operação

- Antes de editar ou publicar, exportar um backup de **cada navegador** que contenha resultados relevantes.
- A central de backups oferece prévia de restauração, exportação bruta e as últimas cinco cópias anteriores às gravações. O histórico permite desfazer os últimos dez salvamentos de placares.
- Calendários divergentes bloqueiam a restauração. Dados inválidos são preservados, com gravação bloqueada, para análise e recuperação assistida.
- Um novo clube fica pendente. Competições com calendário fechado não recebem participantes automaticamente.
- As ferramentas legadas e o portal usam bases locais distintas. Abrir o portal não importa nem substitui automaticamente os dados antigos.

Consulte o [relatório da auditoria](docs/AUDITORIA-PR178.md) e o [procedimento de ativação do Firebase](docs/MIGRACAO-FIREBASE-PORTAL.md) antes de publicar.
