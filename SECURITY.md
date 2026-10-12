# Segurança do Arena BDA

O portal público e as ferramentas antigas possuem modos de armazenamento diferentes. `localStorage` é privado ao navegador, pode ser alterado pelo próprio usuário e não é uma fonte de resultados oficiais.

A sincronização do novo portal é opcional e permanece desligada. Sua ativação exige regras verificadas no servidor, autenticação administrativa, reconciliação de dados e autorização de publicação. Consulte [o procedimento de ativação](docs/MIGRACAO-FIREBASE-PORTAL.md).

Não coloque senhas, tokens, contas de serviço ou backups de produção em arquivos públicos, issues ou logs de CI. A configuração pública do SDK Firebase não substitui regras de acesso.

Para relatar uma vulnerabilidade, use o canal privado de segurança do GitHub do repositório, caso habilitado, ou contate o responsável por um canal privado existente. Não publique credenciais, dados pessoais ou detalhes de exploração de produção em uma issue pública. Inclua passos reproduzíveis com dados sintéticos, versão/commit e impacto observado. Não há SLA de resposta definido neste repositório.

As regras em `docs/firestore-portal-v2.rules` são candidatas, usadas apenas pelo emulador; não substituir as regras completas de produção por esse arquivo. O workflow de testes não publica regras nem modifica dados remotos.
