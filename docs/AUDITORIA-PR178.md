# Auditoria e melhorias do Arena BDA — PR #178

Data: 12/10/2026. Branch: `fix/portal-resultados-seguros-20261011`. Base de preservação: `4f944b100b2f75e6c5d60322a9b65665b64be252`.

## Resultado e limites

O portal recebeu interface nova, domínio testável, gravação local protegida, recuperação por backups e sincronização opcional. O trabalho também corrigiu rotinas destrutivas encontradas nas ferramentas antigas. Não houve merge, deploy, alteração de configuração sensível, login em produção, migração nem escrita/exclusão de dados de produção.

A auditoria cobre o código disponível, calendários versionados e cenários automatizados descritos abaixo. Não certifica placares oficiais, todas as telas históricas ou dados presentes em outros navegadores/projetos remotos. A publicação e a ativação oficial do Firebase permanecem pendentes de aprovação.

## Funcionalidades e correções

| Área | Entregue |
| --- | --- |
| Design e navegação | Tema escuro em verde/dourado, cartões responsivos, busca e filtros por situação, navegação inferior, links por campeonato, botão voltar e foco de teclado |
| Rodadas e desempenho | Uma rodada inicial; todas as rodadas carregadas progressivamente; filtros por clube e resultado; folgas e contagem de jogos |
| Classificação | J/V/E/D, gols pró/contra, saldo, aproveitamento e pontos; empate 0×0 válido; jogos não disputados excluídos; critérios existentes preservados e explicados |
| Placares | Inteiros 0–99; rejeição de campos parciais e coerções indevidas; confirmação antes de salvar; rascunho exportável; desfazer; falhas de quota sem falso sucesso |
| Concorrência | Web Locks quando disponíveis, comparação do estado anterior, sincronização entre abas e rejeição de edições obsoletas |
| Clubes e escudos | Solicitações pendentes, normalização de espaços, rejeição de duplicatas, bloqueio de inclusão em calendário fechado; PNG/JPEG/WebP até 2 MB redimensionado para 160 px; rejeição de imagem danificada |
| Backup e recuperação | Backup versionado, exportação bruta, prévia de restauração, validação integral, preservação de calendário, cinco cópias anteriores e histórico de dez salvamentos |
| Segurança | Validação em todas as entradas, escape de texto, CSP no portal, bloqueio de escrita sobre estado corrompido, nenhuma inicialização automática do Firebase |
| Firebase opcional | Login administrativo verificado, leitura pública, transação por revisão, calendário imutável, registro de alterações, conflitos e falhas de rede tratados, atualização remota do editor |
| Acessibilidade | Rótulos, regiões semânticas, foco visível, atalho para conteúdo, mensagens de status, alvos de toque, tabela rolável, movimento reduzido e verificações axe |
| CI | Node 24/Java 21, dependências fixadas, Actions atuais, permissões somente leitura, execução concorrente cancelável, relatórios e imagens do Playwright, emulador isolado, auditoria de dependências |

O portal inicial usa 9 recursos locais, aproximadamente **79 kB sem compressão / 27 kB gzip**, abaixo dos limites de 160/50 kB. A abertura da Liga B renderiza **8 jogos em vez de 136** (94,1% menos cartões iniciais). Esses números medem recursos/DOM; não representam uma medição de latência ou Lighthouse em aparelho físico. Não há SDK Firebase ou fontes externas no modo local.

## Calendários e dados preservados

| Competição | Clubes | Rodadas | Jogos | Verificação |
| --- | ---: | ---: | ---: | --- |
| Liga A | 12 | 11 | 66 | Todos contra todos em turno único, sem pares duplicados |
| Liga B | 17 | 17 | 136 | Turno único, 8 jogos e uma folga por rodada; uma folga por clube |

A suíte compara os seeds inteiros com o commit original, incluindo ordem e mando de todos os confrontos. A primeira rodada da Liga B continua com Real City × Esperança e folga do Cruzeiro FC BDA. Os seeds não possuem placares oficiais; os resultados são validados por estrutura e cálculo, sem inventar ou publicar placares. A conferência com súmulas/organização depende de uma fonte oficial ainda não fornecida.

Estados locais válidos, campeonatos adicionais e campos desconhecidos são conservados. Arquivos incompatíveis ou corrompidos não são substituídos silenciosamente. Bases locais do portal e das ferramentas antigas são distintas; não ocorreu importação automática entre elas.

## Demais competições e ferramentas anteriores

- **Copa Grifo e Copa Francos:** registros originais mantidos. Não foi inventado calendário para edições sem confrontos; a interface informa essa ausência. Cadastro/solicitações exercitados sem alterar calendários existentes.
- **Copas Flash:** sorteio, preliminares, folgas, determinismo, avanço, pênaltis, WO e campeão cobertos por regressões. Corrigida coerção de placar vazio/inválido no motor de mata-mata.
- **Super League:** retirada a geração automática de finais ao abrir o módulo; visitante não regrava configuração ou calendário. O motor atual de três classificados foi preservado. Guardas antigos forçavam dois classificados e apagavam Supercopa: essas migrações automáticas foram retiradas, preservando a configuração já registrada. Há divergência histórica entre regulamentos de duas/três vagas; a organização deve confirmar o formato antes de gerar fases de uma edição real.
- **Catálogo e sincronização legados:** removidos descarte automático de Supercopa/Copa Águia/edições da Liga A, reinjeção de seeds e imposição de 12 clubes/dois turnos à Liga B. Leitura não grava; estado inválido bloqueia persistência do catálogo. O antigo botão de reset não apaga registros.
- **Ferramentas de artes, mídia, campeões e perfis:** acesso mantido em `arena-completo.html`; bundles passam na verificação de reprodução. Não receberam cobertura ponta a ponta integral nem migração para `portalV2`. Não são carregados na página inicial leve.

## Evidências de teste

- `npm test`: **23 testes de domínio/persistência/sincronização aprovados**, além das três suítes de regressão Flash/sorteio/Super League.
- `npm run check` e `bash scripts/check-site.sh`: sintaxe, referências locais, orçamento de recursos e reprodução dos bundles aprovados.
- [Execução intermediária #50](https://github.com/osakasp/copa-grifo-bda/actions/runs/38268027563): os quatro jobs aprovados; **32/32 testes Playwright**, sem retries, e **7/7 testes de regras** no Firestore Emulator.
- A suíte final acrescenta atualização remota tardia do editor e conflitos no modo sincronizado: **36 cenários** (9 por perfil). Perfis: Pixel 7/Chromium, iPhone 13/WebKit, 320×740/Chromium e desktop 1366×900.
- Axe verifica WCAG 2 A/AA e 2.1 AA em cinco telas por perfil, junto de overflow, limite de DOM e erros de JavaScript. Os perfis são emulados; validação em aparelhos físicos e leitor de tela continua recomendada antes da publicação.
- Regras: leitura pública, anonimato, usuário comum, e-mail não verificado, administrador, limites de placar, calendário, revisão, autor, evento de auditoria, remoção explícita de placar e negação de exclusão.
- Os testes não acessam Firebase de produção. Navegadores bloqueiam rede HTTPS, exceto respostas simuladas do cenário de sincronização.

A primeira execução de navegador expôs espera incorreta nos testes de persistência assíncrona e uma imagem PNG de teste inválida; os testes passaram após aguardar as confirmações visíveis e usar uma imagem válida. A rejeição de escudo corrompido passou a ter mensagem em português e teste próprio.

**Execução final de código:** [Actions #51](https://github.com/osakasp/copa-grifo-bda/actions/runs/38268628996), commit `b972759`: quatro jobs aprovados; **36/36 testes Playwright em 30,2 s, sem falhas ou retries; 7/7 regras; 23/23 domínio/sincronização**. [Artifact com relatório e capturas](https://github.com/osakasp/copa-grifo-bda/actions/runs/38268628996/artifacts/11755862459), retenção até 26/10/2026. As alterações posteriores deste relatório são somente documentação.

## Dependências e pendências

A auditoria de dependências de runtime (`npm audit --omit=dev`) passou, sem vulnerabilidades reportadas. A auditoria completa de desenvolvimento ainda reporta **7 ocorrências: 3 altas e 4 moderadas**, na cadeia do Firebase CLI (`braces/chokidar`, OpenTelemetry, gaxios/uuid e dependentes). Overrides compatíveis corrigiram `@grpc/grpc-js` e `basic-ftp`; não foi usado `npm audit fix --force`, cuja sugestão rebaixava o CLI. O JSON completo fica no artifact `dependency-audit`. Essas ferramentas não são servidas pelo portal, mas a pendência precisa ser acompanhada no desenvolvimento.

Outras pendências: conciliar resultados reais entre dispositivos; confirmar regulamentos, acessos e rebaixamentos; testar aparelhos físicos/leitor de tela; auditar ponta a ponta os módulos legados não migrados; configurar e homologar Auth/Firestore no projeto autorizado; preparar importador e recuperação remota aprovados. O adaptador está desligado e não é anunciado como sincronização oficial ativa.

## Publicação, somente após autorização

1. Revisar o diff e os relatórios do PR; exigir os quatro jobs verdes na revisão escolhida.
2. Baixar backups de cada navegador e exportação remota autorizada. Conferir resultados oficiais e diferenças entre bases.
3. Publicar primeiro em origem de homologação separada, com Firebase desativado. Verificar navegação, 202 confrontos, edição local, backups, atualização do service worker e ferramentas antigas.
4. Para publicar apenas o portal local, manter `portal-config.js` desativado. Confirmar o provedor de hospedagem antes de preparar o comando de publicação: este `firebase.json` não configura Hosting.
5. Para resultados oficiais compartilhados, seguir integralmente [MIGRACAO-FIREBASE-PORTAL.md](MIGRACAO-FIREBASE-PORTAL.md), com aprovação separada para regras, dados e configuração.
6. Só após aprovação explícita fazer merge e deploy. Guardar o SHA da versão anterior e os arquivos de backup. Em rollback, reverter os arquivos da interface sem limpar dados, rebaixar regras ou apagar coleções.
