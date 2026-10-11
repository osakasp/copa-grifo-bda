const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>{void dialog.accept().catch(()=>{});});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.evaluate(()=>localStorage.setItem('bda-portal-state-v2',JSON.stringify([{id:'liga-b',participants:{corrompido:true}}])));
  await page.reload();
  assert.ok(await page.locator('[data-open="liga-b"]').count(),'Dados locais malformados não devem impedir abertura');
  await page.evaluate(()=>localStorage.removeItem('bda-portal-state-v2'));
  await page.reload();
  await page.locator('[data-open="liga-b"]').click();
  assert.match(await page.locator('#detail').innerText(),/Cruzeiro FC BDA/);
  await page.locator('[data-view="admin"]').click();
  const inputs=page.locator('[data-results-form] .score-input');
  await inputs.nth(0).fill('2');
  await inputs.nth(1).fill('1');
  await page.locator('[data-results-form] button[type="submit"]').click();
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('bda-portal-state-v2')).find(t=>t.id==='liga-b').results['0:0'].home===2));
  await page.reload();
  await page.locator('[data-open="liga-b"]').click();
  await page.locator('[data-view="table"]').click();
  assert.match(await page.locator('.standing').innerText(),/PTS/i);
  const winner=page.locator('.standing tbody tr').filter({hasText:'Boleiros FC BDA'});
  const loser=page.locator('.standing tbody tr').filter({hasText:'Sport Recife BDA'});
  assert.equal((await winner.locator('td').last().innerText()).trim(),'3','Vitória deve somar três pontos');
  assert.equal((await loser.locator('td').last().innerText()).trim(),'0','Derrota não deve somar pontos');
  await page.locator('[data-view="admin"]').click();
  await page.locator('[data-undo-results]').click();
  assert.ok(await page.evaluate(()=>!JSON.parse(localStorage.getItem('bda-portal-state-v2')).find(t=>t.id==='liga-b').results['0:0']));
  await page.locator('[data-close]').click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar backup'}).click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/arena-bda-backup-.*\.json/);
  // Restaura um backup de placares no navegador sem modificar o calendário.
  const originalFixtures=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('bda-portal-state-v2')).find(t=>t.id==='liga-b').matches));
  const fixtureBackup=await page.evaluate(()=>{
    const tournaments=JSON.parse(localStorage.getItem('bda-portal-state-v2'));
    const liga=tournaments.find(t=>t.id==='liga-b');
    liga.results={'0:0':{home:3,away:2}};
    liga.resultHistory=[];
    return {schemaVersion:1,source:'arena-bda-local',tournaments};
  });
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({
    name:'arena-bda-validacao.json',
    mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(fixtureBackup))
  });
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bda-portal-state-v2')).find(t=>t.id==='liga-b').results['0:0'].home),3);
  assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('bda-portal-state-v2')).find(t=>t.id==='liga-b').matches)),originalFixtures);
  const badBackup=structuredClone(fixtureBackup);
  badBackup.tournaments.find(t=>t.id==='liga-b').results={'999:999':{home:8,away:0}};
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({
    name:'arena-bda-invalido.json',
    mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(badBackup))
  });
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bda-portal-state-v2')).find(t=>t.id==='liga-b').results['0:0'].home),3);
  // Duas abas: a segunda deve detectar que seu estado ficou desatualizado.
  const second=await page.context().newPage();
  try{
    const alerts=[];
    second.on('dialog',dialog=>{alerts.push(dialog.message());void dialog.accept().catch(()=>{});});
    await second.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await second.locator('[data-open="liga-b"]').click();
    await second.locator('[data-view="admin"]').click();
    await page.locator('[data-open="liga-b"]').click();
    await page.locator('[data-view="admin"]').click();
    const firstScores=page.locator('[data-results-form] .score-input');
    await firstScores.nth(0).fill('1');
    await firstScores.nth(1).fill('0');
    await page.locator('[data-results-form] button[type="submit"]').click();
    await second.waitForFunction(()=>JSON.parse(localStorage.getItem('bda-portal-state-v2')).find(t=>t.id==='liga-b').results['0:0']?.home===1);
    assert.equal(await second.evaluate(()=>JSON.parse(localStorage.getItem('bda-portal-state-v2')).find(t=>t.id==='liga-b').results['0:0'].home),1);
    assert.equal(alerts.length,0,'Sincronização entre abas sem rascunho não deve gerar alerta');
  }finally{await second.close()}
  assert.deepEqual(errors,[],'Erros JavaScript no navegador: '+errors.join('; '));
  console.log('OK: navegador Chromium mobile, placar, recarga, classificação, desfazer, exportação e restauração válida/inválida');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
