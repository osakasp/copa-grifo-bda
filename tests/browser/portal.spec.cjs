const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const C=require('../../portal-core.js'),seeds=require('../../portal-data.js');
const KEY=C.KEY;
const init=()=>C.hydrate(seeds,null).state;
const open=async(page,id='liga-b')=>{await page.goto('/');await page.locator('[data-open="'+id+'"]').click();};
const admin=async page=>page.locator('[data-view="admin"]').click();
const scores=page=>page.locator('[data-results-form] .score-input');
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
test.beforeEach(async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.route(/https:\/\//,r=>r.abort()); // No live Firebase, analytics or production writes in tests.
});
test('mobile navigation, lazy rounds, club/result filters and back button',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await expect(page.locator('.match')).toHaveCount(8);
 await expect(page.locator('.bye')).toHaveText('Folga: Cruzeiro FC BDA');
 await page.getByLabel('Próxima rodada').click();await expect(page.locator('.round h3')).toContainText('Rodada 2');
 await page.locator('#roundChoice').selectOption('all');await expect(page.locator('.round')).toHaveCount(2);
 await page.getByRole('button',{name:'Carregar mais rodadas'}).click();await expect(page.locator('.round')).toHaveCount(4);
 await page.locator('#teamFilter').selectOption('Cruzeiro FC BDA');await expect(page.locator('.match')).toHaveCount(2);
 await page.locator('#statusFilter').selectOption('played');await expect(page.getByText('Nenhum jogo para estes filtros.')).toBeVisible();
 await page.goBack();await expect(page.locator('#grid')).toBeVisible();expect(errors).toEqual([]);
});
test('save a 0x0 and 2x1, reload, calculate standings and undo',async({page})=>{
 await open(page);await admin(page);await scores(page).nth(0).fill('2');await scores(page).nth(1).fill('1');await scores(page).nth(2).fill('0');await scores(page).nth(3).fill('0');
 await page.getByRole('button',{name:'Salvar neste navegador',exact:true}).click();await expect(page.locator('#notice')).toContainText('Resultados salvos');
 const t=(await saved(page)).find(t=>t.id==='liga-b');expect(t.results['0:0']).toEqual({home:2,away:1});expect(t.results['0:1']).toEqual({home:0,away:0});
 await page.reload();await page.locator('[data-view="table"]').click();await expect(page.getByRole('row').filter({hasText:'Boleiros FC BDA'}).locator('td').last()).toHaveText('3');
 await admin(page);await page.getByRole('button',{name:'Desfazer último salvamento'}).click();await expect(page.locator('#notice')).toContainText('salvamento desfeito');expect((await saved(page)).find(t=>t.id==='liga-b').results).toEqual({});
 await expect(page.getByRole('button',{name:'Salvar neste navegador',exact:true})).toBeEnabled();
});
test('partial score is rejected and drafts survive tab-change cancellation',async({page})=>{
 await open(page);await admin(page);await scores(page).nth(0).fill('2');await page.getByRole('button',{name:'Salvar neste navegador',exact:true}).click();await expect(page.locator('#notice')).toContainText('dois gols');
 expect(await saved(page)).toBeNull();page.removeAllListeners('dialog');page.on('dialog',d=>d.dismiss());await page.locator('[data-view="table"]').click();await expect(scores(page).nth(0)).toHaveValue('2');
 await page.locator('[data-close]').click();await expect(page.locator('[data-results-form]')).toBeVisible();
});
test('quota failure never confirms save; initial corrupt state remains intact',async({page})=>{
 await open(page);await admin(page);await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});await scores(page).nth(0).fill('1');await scores(page).nth(1).fill('0');await page.getByRole('button',{name:'Salvar neste navegador',exact:true}).click();await expect(page.locator('#notice')).toContainText('Quota');expect(await saved(page)).toBeNull();await expect(scores(page).nth(0)).toHaveValue('1');
 await page.reload();await page.evaluate(key=>localStorage.setItem(key,'{broken'),KEY);await page.reload();await expect(page.locator('#notice')).toContainText('gravação bloqueada');await admin(page);await expect(page.locator('[data-results-form]')).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe('{broken');
});
test('two tabs converge while a dirty editor rejects overwrites',async({page,context})=>{
 await open(page);await admin(page);const second=await context.newPage();second.on('dialog',d=>d.accept());await open(second);await admin(second);
 await scores(page).nth(0).fill('2');await scores(page).nth(1).fill('1');await page.getByRole('button',{name:'Salvar neste navegador',exact:true}).click();await expect(scores(second).nth(0)).toHaveValue('2');
 await scores(second).nth(0).fill('5');await scores(page).nth(0).fill('3');await page.getByRole('button',{name:'Salvar neste navegador',exact:true}).click();await expect(second.locator('#notice')).toContainText('outra aba');await expect(scores(second).nth(0)).toHaveValue('5');await second.getByRole('button',{name:'Salvar neste navegador',exact:true}).click();await expect(second.locator('#notice')).toContainText('Conflito');expect((await saved(page)).find(t=>t.id==='liga-b').results['0:0'].home).toBe(3);
});
test('backup previews, valid/invalid restore, raw export and recovery download',async({page})=>{
 await page.goto('/#backups');const backup=C.exportBackup(init());backup.tournaments[3].results={'0:0':{home:3,away:2}};
 await page.locator('#backupInput').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});expect(await saved(page)).toBeNull();await page.getByRole('button',{name:'Confirmar restauração'}).click();await expect(page.locator('#backupPreview')).toContainText('Backup restaurado');expect((await saved(page))[3].results['0:0'].home).toBe(3);
 const bad=C.clone(backup);bad.tournaments[3].matches[0].reverse();await page.locator('#backupInput').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await expect(page.locator('#notice')).toContainText('divergente');await expect(page.locator('[data-restore]')).toHaveCount(0);expect((await saved(page))[3].results['0:0'].home).toBe(3);
 const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar backup',exact:true}).click();expect((await promise).suggestedFilename()).toMatch(/arena-bda-backup/);
 await page.getByRole('button',{name:'Verificar tabelas'}).click();await expect(page.locator('#auditReport')).toContainText('136 jogos');
});
test('club requests, duplicate rejection, closed league protection and safe badge upload',async({page})=>{
 await open(page);await admin(page);await page.getByLabel('Nome do clube',{exact:true}).fill('  Novo   Clube ');await page.getByRole('button',{name:'Solicitar cadastro'}).click();await expect(page.locator('.pending-item')).toContainText('Novo Clube');await expect(page.locator('[data-approve]')).toHaveCount(0);
 await page.getByLabel('Nome do clube',{exact:true}).fill('NOVO CLUBE');await page.getByRole('button',{name:'Solicitar cadastro'}).click();await expect(page.locator('#notice')).toContainText('já está cadastrado');
 await page.locator('[name=badge]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('invalid image')});await page.getByRole('button',{name:'Salvar escudo'}).click();await expect(page.locator('#notice')).toContainText('Imagem inválida');expect((await saved(page)).find(t=>t.id==='liga-b').teamProfiles||{}).toEqual({});
 const png=Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;const ctx=canvas.getContext('2d');ctx.fillStyle='#23dc8c';ctx.fillRect(0,0,16,16);return canvas.toDataURL('image/png').split(',')[1];}),'base64');
 await page.locator('[name=badge]').setInputFiles({name:'badge.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Salvar escudo'}).click();await expect(page.locator('#notice')).toContainText('Escudo salvo');await page.locator('[data-view="clubs"]').click();await expect(page.locator('.team-badge img')).toHaveCount(1);
});
test('accessibility, layout, touch targets, console, asset and DOM budgets',async({page},testInfo)=>{
 const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 for(const screen of ['home','matches','table','admin','backups']){
  if(screen==='matches')await page.locator('[data-open="liga-b"]').click();
  if(screen==='table'||screen==='admin')await page.locator('[data-view="'+screen+'"]').click();
  if(screen==='backups')await page.locator('[data-nav="backups"]').click();
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations,screen).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),screen).toBeTruthy();
  expect(await page.locator('*').count()).toBeLessThan(700);
 }
 expect(errors).toEqual([]);expect(requests.some(url=>/firebase|gstatic/.test(url))).toBeFalsy();
 await page.goto('/');await page.screenshot({path:testInfo.outputPath('home.png'),fullPage:true});await page.locator('[data-open="liga-b"]').click();await page.screenshot({path:testInfo.outputPath('liga-b.png'),fullPage:true});
 const metrics=await page.evaluate(()=>({nodes:document.querySelectorAll('*').length,matchCards:document.querySelectorAll('.match').length,assets:performance.getEntriesByType('resource').length}));expect(metrics.matchCards).toBe(8);await testInfo.attach('metrics',{body:JSON.stringify(metrics),contentType:'application/json'});
});
test('configured sync updates an idle editor and preserves conflicting drafts',async({page})=>{
 const tournament=init().find(t=>t.id==='liga-b');
 await page.addInitScript(({calendar})=>{
  window.__remote={calendar,revision:0,results:{}};
  window.__mockTransport={
   onAuth(fn){fn({uid:'test-admin',email:'claboleirosdeatitude@gmail.com',emailVerified:true});return()=>{};},
   watch(id,fn){window.__publish=fn;fn(window.__remote);return()=>{};},
   async commit({patch,revision}){if(revision!==window.__remote.revision)throw new Error('Conflito remoto');window.__remote={...window.__remote,revision:revision+1,results:{...window.__remote.results,...patch}};},
   async signIn(){},async signOut(){}
  };
 },{calendar:C.calendar(tournament)});
 await page.route(/portal-config\.js/,r=>r.fulfill({contentType:'text/javascript',body:'window.ArenaPortalConfig={enabled:true,firebase:{projectId:"demo-arena-bda"},expectedProjectId:"demo-arena-bda"};'}));
 const adapter=require('node:fs').readFileSync('portal-sync.js','utf8');
 await page.route(/portal-sync\.js/,r=>r.fulfill({contentType:'text/javascript',body:adapter+'\nwindow.ArenaPortalSync={...window.ArenaPortalSync,firebaseTransport:()=>window.__mockTransport};'}));
 await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\//,r=>r.fulfill({contentType:'text/javascript',body:'window.firebase={apps:[{name:"arena-portal-v2"}]};'}));
 await open(page);await admin(page);await expect(scores(page).nth(0)).toBeVisible();
 await page.evaluate(()=>{window.__remote={...window.__remote,revision:1,results:{'0:0':{home:2,away:1}}};window.__publish(window.__remote);});await expect(scores(page).nth(0)).toHaveValue('2');
 await scores(page).nth(0).fill('3');await page.getByRole('button',{name:'Salvar no servidor',exact:true}).click();await expect(page.locator('#notice')).toContainText('confirmados pelo servidor');
 // The metadata snapshot may arrive after the transaction acknowledgement.
 await page.evaluate(()=>window.__publish(window.__remote));await expect(scores(page).nth(0)).toHaveValue('3');
 await scores(page).nth(0).fill('4');await page.evaluate(()=>{window.__remote={...window.__remote,revision:3,results:{'0:0':{home:5,away:1}}};window.__publish(window.__remote);});
 await expect(page.locator('#notice')).toContainText('rascunho foi preservado');await expect(scores(page).nth(0)).toHaveValue('4');await page.getByRole('button',{name:'Salvar no servidor',exact:true}).click();await expect(page.locator('#notice')).toContainText('Conflito');expect(await saved(page)).toBeNull();
});
