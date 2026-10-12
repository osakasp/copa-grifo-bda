# Ativação segura do Firebase no portal

## Situação entregue

O adaptador foi implementado e testado com transporte simulado e regras no emulador. `portal-config.js` mantém `enabled: false`; nenhuma conta, domínio, segredo, regra de produção ou dado remoto foi alterado. O portal não carrega o SDK quando a sincronização está desligada.

O contrato novo usa **`portalV2`**. Não ativar o antigo contrato `portalChampionships` nem reaproveitar a sincronização de listas do legado para esta interface. `firebase.json`, `firestore.rules` e `storage.rules` permanecem como estavam no início deste trabalho. `docs/firestore-portal-v2.rules` é uma proposta isolada para revisão e homologação.

## Contrato de dados

| Caminho | Campos e comportamento |
| --- | --- |
| `portalV2/{id}` | `calendar`: serialização exata de `ArenaPortalCore.calendar(torneio)`; `allowedMatchKeys`: saída de `matchKeys(torneio)`; `revision`: inteiro crescente; `updatedAt`, `updatedBy` |
| `portalV2/{id}/results/{rodada:jogo}` | `home`, `away`: inteiros 0–99; `cleared`: booleano; `revision`, `updatedAt`, `updatedBy` |
| `portalV2/{id}/events/{revisão}` | Registro imutável da revisão, autor, horário e `keys` dos jogos alterados |

Os índices de rodada/jogo começam em zero. Cada transação confere calendário e revisão anteriores, grava somente os jogos editados, incrementa a revisão e cria o evento correspondente. Remover um placar exige `cleared: true` com gols zero; nenhum documento é excluído. A revisão permite rejeitar rascunhos antigos e alterações concorrentes.

Leitura de resultados é pública; eventos administrativos exigem administrador. Escritas exigem usuário autenticado, e-mail verificado e endereço na lista administrativa já existente no repositório. A interface não concede permissões: as regras são a autoridade. Contas comuns e não verificadas são recusadas. Persistência de login: sessão do navegador.

O cliente não cria a raiz da competição nem altera calendários. Documento ausente, calendário divergente, snapshot apenas de cache, falha de rede, sessão inválida e conflito bloqueiam a escrita. A confirmação de publicação depende do retorno da transação do servidor.

## Homologação e aprovação necessárias

1. Exportar backup e armazenamento bruto de cada dispositivo relevante. Guardar também uma exportação autorizada do Firestore existente; não limpar armazenamento dos navegadores.
2. Conciliar placares, edições, nomes e confrontos. Eleger a fonte oficial com a organização. Os seeds não substituem essa conferência.
3. Confirmar projeto Firebase, domínio autorizado e identidades administrativas. Habilitação de provedores, mudanças na lista de administradores e demais configurações sensíveis precisam de autorização explícita.
4. Em ambiente separado, revisar e integrar **somente** o bloco de regras de `portalV2` às regras existentes. Não substituir o arquivo inteiro de regras de produção pela proposta: ela nega as coleções não especificadas.
5. Preparar uma importação administrativa revisável, idempotente e com modo de simulação. Deve recusar documentos existentes divergentes e nunca remover coleções. Esse importador e a importação de dados reais não foram executados nem autorizados neste PR.
6. Criar os documentos de metadados e resultados reconciliados no ambiente de homologação. Conferir os 202 confrontos das Ligas A/B e as demais competições incluídas na migração.
7. Configurar o frontend de homologação com configuração **pública** do projeto, `expectedProjectId` igual ao projeto confirmado e `enabled: true`. Nunca incluir senha, token administrativo ou chave de conta de serviço no JavaScript.
8. Testar dois navegadores: leitura anônima; login permitido/negado; edição; atualização remota; rascunho concorrente; logout; perda de rede; calendário ausente/divergente; backup anterior à publicação. Testar também REST/SDK contra as regras, sem depender dos botões da interface.
9. Após homologação, obter aprovação explícita para implantação de regras, migração e ativação no domínio oficial. São operações distintas do merge e da publicação dos arquivos estáticos.

## Executar os testes isolados

```sh
npm ci
npm test
npm run test:rules
npm run test:browser
```

Java 21 e Node 24 são necessários para a configuração de teste. `firebase.test.json` usa apenas o emulador local. A suíte recusa conexão a um projeto real.

## Backup, recuperação e retorno à versão anterior

- Antes de cada gravação local, uma cópia do estado anterior é guardada; falha de quota impede confirmação de sucesso. Essas cópias não substituem arquivos baixados: limpar dados do navegador também as remove.
- Baixar uma cópia anterior, selecioná-la na central, revisar a prévia e confirmar a restauração. O calendário precisa coincidir. O portal cria uma cópia do estado substituído.
- Se os dados atuais estiverem inválidos, exportar o armazenamento bruto e preservar o navegador. Não usar `localStorage.clear()` nem inserir seeds. A recuperação de JSON corrompido exige análise assistida; não existe correção automática segura.
- No modo oficial, restaurações locais e cadastro/escudos locais ficam bloqueados. A recuperação remota exige reconciliação e operação administrativa separada, com aprovação.
- Em rollback de interface, conservar os dados e backups; não restaurar regras permissivas nem apagar `portalV2`. Revisar compatibilidade do esquema e caches antes de reativar uma versão anterior.

Referências técnicas: [transações do Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions) e [testes de regras](https://firebase.google.com/docs/rules/unit-tests).
