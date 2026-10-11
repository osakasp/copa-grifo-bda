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
check('Publicação restaura histórico e data em falha', html.includes('t.resultHistory=previousHistory;t.lastResultUpdate=previousUpdated;return'));
check('Não publica resultados de jogos inexistentes', html.includes('keys.some(key=>!validKeys.has(key))'));
check('Inscrição reverte se salvar falhar', html.includes('t.pendingTeams=previousPending;return'));
check('Restauração de backup disponível', html.includes("importButton.textContent='Restaurar backup'"));
check('Importação valida origem e versão do backup', html.includes("payload?.source!=='arena-bda-local'"));
check('Importação restringe resultados aos jogos cadastrados', html.includes('!validKeys.has(key)||!res'));
check('Importação bloqueia competições desconhecidas', html.includes('Backup contém competição desconhecida'));
check('Importação bloqueia edição de placares pendente', html.includes('Há placares em edição. Salve ou descarte'));
check('Importação bloqueia competições duplicadas', html.includes('if(seenIds.has(t.id))'));
check('Importação valida histórico de resultados', html.includes('const snapshot=validateResults(item?.results)'));
check('Importação rejeita histórico inválido', html.includes('Histórico de resultados inválido'));
check('Importação reverte alterações quando armazenamento falha', html.includes('if(!persist()){for(const {t,results,history,updated} of previous)'));
check('Auditoria de tabelas disponível', html.includes("auditButton.textContent='Verificar tabelas'"));
check('Auditoria detecta confrontos repetidos', html.includes('pairSeen.has(key)'));
check('Auditoria detecta resultados órfãos', html.includes('resultado órfão de jogo'));
check('Auditoria detecta folgas ausentes', html.includes('folga não informada'));
check('Auditoria confere quantidade de jogos', html.includes('quantidade de confrontos incompatível'));
check('Auditoria detecta folgas inconsistentes', html.includes('folga inconsistente'));
// Verifica também a sintaxe JavaScript do script embutido, sem executar o DOM.
const vm = require('node:vm');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(Boolean);
check('Script embutido presente', inlineScripts.length > 0);
inlineScripts.forEach((script, index) => {
  assert.doesNotThrow(() => new vm.Script(script, {filename:'index.html:inline-'+index}), 'Sintaxe JavaScript inválida');
});
check('Sintaxe JavaScript válida', true);
// Exercita a mesma função de validação usada pela interface, não apenas a presença do texto.
const scoreMatch = html.match(/const scoreValue=(v=>\{[^\n]+\});/);
check('Validador de placares encontrado', Boolean(scoreMatch));
const scoreValue = vm.runInNewContext('('+scoreMatch[1]+')');
for (const [value, expected] of [[0,0],['0',0],['12',12],[99,99],['',null],[' ',null],['-1',null],['100',null],['1.5',null],['1e1',null],['0x10',null],[null,null],[undefined,null],[true,null]]) {
  assert.equal(scoreValue(value),expected,'Placar inválido: '+String(value));
}
check('Validação funcional de placares aprovada', true);
check('Falha de leitura inicial do armazenamento tratada', html.includes("console.warn('Armazenamento indisponível:'"));
check('Salvamento detecta alterações concorrentes', html.includes('localStorage.getItem(PORTAL_KEY)!==lastPersistedRaw'));
check('Evento entre abas atualiza versão conhecida', html.includes('lastPersistedRaw=event.newValue'));
check('Abas locais recebem alterações de armazenamento', html.includes("window.addEventListener('storage',event=>"));
check('Rascunhos protegidos de alterações externas', html.includes('if(Object.keys(draftResults).length)'));
check('Histórico restaurado após recarga', html.includes('resultHistory:Array.isArray(old.resultHistory)'));
check('Última atualização restaurada após recarga', html.includes('lastResultUpdate:Number.isFinite(old.lastResultUpdate)'));
const rules = fs.readFileSync(require('node:path').join(__dirname, '..', 'firestore.rules'), 'utf8');
check('Coleção de campeonatos protegida', rules.includes('match /portalChampionships/{championshipId}'));
check('E-mail verificado obrigatório para escrita', rules.includes('request.auth.token.email_verified == true'));
check('Exclusão de campeonatos bloqueada', /match \/portalChampionships\/\{championshipId\}[\s\S]*?allow delete: if false;/.test(rules));
// Executa os confrontos do calendário e verifica rodadas e folgas.
const fixtureSource = html.match(/const ligaAMatches=([\s\S]*?);\s*const ligaBMatches=([\s\S]*?);\s*const ligaBByes=([\s\S]*?);\s*const seeds=/);
check('Calendários das ligas encontrados', Boolean(fixtureSource));
const [ligaA, ligaB, ligaBByes] = vm.runInNewContext('['+fixtureSource[1]+','+fixtureSource[2]+','+fixtureSource[3]+']');
const verifyFixture = (name, rounds, clubs, byes) => {
  assert.equal(rounds.length, clubs-1+(clubs%2), name+': quantidade de rodadas');
  const allPairs=new Set(), allClubs=new Set();
  rounds.forEach((round, r)=>{
    assert.equal(round.length, Math.floor(clubs/2),name+': jogos na rodada '+(r+1));
    const used=new Set();
    round.forEach(pair=>{
      assert.equal(pair.length,2,name+': confronto inválido');
      assert.notEqual(pair[0],pair[1],name+': clube enfrenta a si mesmo');
      pair.forEach(team=>{assert.ok(!used.has(team),name+': clube repetido na rodada');used.add(team);allClubs.add(team)});
      const key=[...pair].sort().join('|');
      assert.ok(!allPairs.has(key),name+': confronto duplicado '+key);
      allPairs.add(key);
    });
    if(byes){assert.ok(!used.has(byes[r]),name+': folga conflitante');allClubs.add(byes[r])}
  });
  assert.equal(allClubs.size,clubs,name+': quantidade de clubes');
  assert.equal(allPairs.size,clubs*(clubs-1)/2,name+': todos contra todos');
};
verifyFixture('Liga A',ligaA,12);
verifyFixture('Liga B',ligaB,17,ligaBByes);
assert.equal(ligaBByes[0],'Cruzeiro FC BDA','Liga B: folga da rodada 1');
assert.ok(ligaB[0].some(pair=>pair[0]==='Real City BDA'&&pair[1]==='Esperança BDA'),'Liga B: Real City x Esperança na rodada 1');
check('Calendários de Liga A e Liga B consistentes',true);
console.log('Testes estáticos concluídos. Testes reais de navegador ainda necessários.');
