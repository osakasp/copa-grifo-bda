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
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
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
  await page.locator('[data-view="admin"]').click();
  await page.locator('[data-undo-results]').click();
  assert.ok(await page.evaluate(()=>!JSON.parse(localStorage.getItem('bda-portal-state-v2')).find(t=>t.id==='liga-b').results['0:0']));
  await page.locator('[data-close]').click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar backup'}).click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/arena-bda-backup-.*\.json/);
  assert.deepEqual(errors,[],'Erros JavaScript no navegador: '+errors.join('; '));
  console.log('OK: navegador Chromium mobile, placar, recarga, classificação, desfazer e exportação');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
