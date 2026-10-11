// Testes de regressão sem dependências externas: node tests/portal-regression.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const check = (name, condition) => { assert.ok(condition, name); console.log('OK:', name); };
check('Página mantém idioma pt-BR', html.includes('lang="pt-BR"'));
check('Liga A preservada', html.includes("id:'liga-a'"));
check('Liga B preservada', html.includes("id:'liga-b'"));
check('Backup JSON disponível', html.includes("backupButton.textContent='Exportar backup'"));
check('Não interpreta campos vazios como zero', html.includes("String(v).trim()===''"));
check('Limite de gols aplicado', html.includes('n>=0&&n<=99'));
check('Erros de persistência comunicados', html.includes('Falha ao salvar dados locais'));
check('Desfazer placares reverte alterações se salvar falhar', html.includes('t.results=previousResults;t.resultHistory=previousHistory'));
check('Inscrição reverte se salvar falhar', html.includes('t.pendingTeams=previousPending;return'));
check('Auditoria de tabelas disponível', html.includes("auditButton.textContent='Verificar tabelas'"));
check('Auditoria detecta confrontos repetidos', html.includes('pairSeen.has(key)'));
check('Auditoria detecta folgas inconsistentes', html.includes('folga inconsistente'));
console.log('Testes estáticos concluídos. Testes reais de navegador ainda necessários.');
