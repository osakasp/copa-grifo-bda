// Testes de regressão sem dependências externas: node tests/portal-regression.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const check = (name, condition) => { assert.ok(condition, name); console.log('OK:', name); };
check('Página mantém idioma pt-BR', html.includes('lang="pt-BR"'));
check('Liga A preservada', html.includes("id:'liga-a'"));
check('Liga B preservada', html.includes("id:'liga-b'"));
check('Backup JSON disponível', html.includes("backupButton.textContent='Exportar backup'"));
check('Não interpreta campos vazios como zero', html.includes('if(!/^(0|[1-9][0-9]?)$/.test(raw))return null'));
check('Limite de gols aplicado', html.includes('n>=0&&n<=99'));
check('Erros de persistência comunicados', html.includes('Falha ao salvar dados locais'));
check('Desfazer placares reverte alterações se salvar falhar', html.includes('t.results=previousResults;t.resultHistory=previousHistory'));
check('Inscrição reverte se salvar falhar', html.includes('t.pendingTeams=previousPending;return'));
check('Auditoria de tabelas disponível', html.includes("auditButton.textContent='Verificar tabelas'"));
check('Auditoria detecta confrontos repetidos', html.includes('pairSeen.has(key)'));
check('Auditoria detecta folgas inconsistentes', html.includes('folga inconsistente'));
// Verifica também a sintaxe JavaScript do script embutido, sem executar o DOM.
const vm = require('node:vm');
const inlineScripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)].map(m => m[1]).filter(Boolean);
check('Script embutido presente', inlineScripts.length > 0);
inlineScripts.forEach((script, index) => {
  assert.doesNotThrow(() => new vm.Script(script, {filename:'index.html:inline-'+index}), 'Sintaxe JavaScript inválida');
});
check('Sintaxe JavaScript válida', true);
check('Histórico restaurado após recarga', html.includes('resultHistory:Array.isArray(old.resultHistory)'));
check('Última atualização restaurada após recarga', html.includes('lastResultUpdate:Number.isFinite(old.lastResultUpdate)'));
console.log('Testes estáticos concluídos. Testes reais de navegador ainda necessários.');
