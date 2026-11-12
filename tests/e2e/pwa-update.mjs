// Real service-worker lifecycle on one origin. No page.route(), synthetic worker,
// fake caches, or HTTP-cache substitute. `npm run test:pwa` builds the candidate.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rm,symlink,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,webkit,devices} from 'playwright';

const repo=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const PREVIOUS='fbcc68d4efbaa86be1bc56eab1c2424c6b0cf5fb';
const PUBLISHED='eb46fdd2403a3e407dc9daeba9e0df0776c7ebac';
const PREFIX='architectonica-public-';
const OLD=PREFIX+'exchange-20261021-r1';
const CURRENT=PREFIX+'integration-20261110-r1';
const CANDIDATE=PREFIX+'sc5-offline-20261112-r1';
const SC5='gdeya.sc5.research.v1';
const DOSSIERS='architectonica.certification.dossiers.v1';
const BASE='/Game-GDEYA/';
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.md':'text/markdown'};
const temporary=await mkdtemp(resolve(tmpdir(),'gdeya-pwa-'));
const results=[];
const evidenceRoot=resolve(repo,'outputs/pwa-update');
await mkdir(evidenceRoot,{recursive:true});

async function historicalBuild(ref) {
  const root=resolve(temporary,ref);
  await mkdir(root);
  // Immutable release sources, including their real HTML, module and CSS versions.
  const archive=execFileSync('git',['archive',ref],{cwd:repo,maxBuffer:64*1024*1024});
  execFileSync('tar',['-x','-C',root],{input:archive});
  await symlink(resolve(repo,'node_modules'),resolve(root,'node_modules'),'dir');
  execFileSync(process.execPath,[resolve(repo,'node_modules/vite/bin/vite.js'),'build','--config','public-web/vite.config.ts'],{cwd:root,stdio:'pipe'});
  return resolve(root,'dist-public');
}

async function serve(roots) {
  const state={stage:'previous',online:true,missing:false,requests:[]};
  const server=createServer(async(req,res)=>{
    if (!state.online) {req.socket.destroy();return;}
    const url=new URL(req.url,'http://127.0.0.1');
    state.requests.push({stage:state.stage,path:url.pathname});
    try {
      assert.ok(url.pathname.startsWith(BASE));
      let relative=decodeURIComponent(url.pathname.slice(BASE.length));
      if (!relative||relative.endsWith('/')) relative+='index.html';
      if (state.missing && relative==='labs/sc5-chronos/temporal-replay.mjs') {
        res.writeHead(503,{'Cache-Control':'no-store'}).end('Deliberately unavailable update resource');return;
      }
      const root=roots[state.stage],file=resolve(root,relative);
      assert.ok(file.startsWith(root+sep));
      assert.ok((await stat(file)).isFile());
      res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});
      res.end(await readFile(file));
    } catch {res.writeHead(404,{'Cache-Control':'no-store'}).end('Not found');}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  return {state,url:(path='')=>`http://127.0.0.1:${server.address().port}${BASE}${path}`,close:()=>new Promise(done=>{server.closeAllConnections();server.close(done)})};
}

async function waitWorker(page,key) {
  // Playwright's waitForFunction treats a returned Promise as truthy before it
  // resolves. Poll the resolved boolean, so a merely created cache cannot pass.
  const deadline=Date.now()+30000;
  while(Date.now()<deadline) {
    if(await page.evaluate(async expected=>{
      const registration=await navigator.serviceWorker.getRegistration();
      const shells=(await caches.keys()).filter(key=>key.startsWith('architectonica-public-'));
      return !!navigator.serviceWorker.controller && registration?.active?.state==='activated' &&
        navigator.serviceWorker.controller===registration.active && !registration.installing && !registration.waiting &&
        shells.length===1 && shells[0]===expected;
    },key)) return;
    await delay(50);
  }
  assert.fail(`Worker did not activate and claim the page: ${key}; caches=${JSON.stringify(await keys(page))}`);
}
async function keys(page) {return page.evaluate(()=>caches.keys());}
async function snapshot(page) {
  return page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])));
}
async function saveAssessment(page,site,phase='before') {
  await page.goto(site.url(`labs/sc5-chronos/?cycleId=cycle-pwa-test-20261112&phase=${phase}`));
  await page.waitForSelector('.question');
  assert.equal(await page.locator('.question').count(),15);
  for(const question of await page.locator('.question').all()) await question.getByRole('button',{name:'0,5',exact:true}).click();
  await page.locator('#context').fill('Synthetic offline upgrade audit');
  await page.locator('#consent').check();
  await page.locator('#save').click();
  assert.match(await page.locator('#status').innerText(),/Запись сохранена/u);
}
async function saveDossier(page,site) {
  await page.goto(site.url('labs/certification/'));
  const fields={candidate_name:'PWA synthetic candidate',candidate_role:'Practice facilitator',requested_scope:'One practice',method_scope:'GDEYA',prerequisite_trace:'Training notes',supervision_plan:'Three observed cases',object:'PWA audit dossier',subject_manifestation:'One synthetic dossier',reflected_image:'Ready for a test',target_relation:'Preserve the journal',context:'Isolated browser',invariant:'Keep authorship',canon_reference:'draft/canon',competency_version:'draft-0.1',ethics_reference:'draft/ethics'};
  for(const [field,value] of Object.entries(fields)) await page.locator(`#dossier-form [name="${field}"]`).fill(value);
  for(const field of ['authorship_ack','consent_ack','boundary_ack','authorization_ack'])await page.locator(`#dossier-form [name="${field}"]`).check();
  await page.getByRole('button',{name:'Собрать досье готовности →'}).click();
  await page.waitForSelector('#dashboard:not([hidden])');
  assert.ok(await page.evaluate(key=>!!localStorage.getItem(key),DOSSIERS));
}
async function offline(context,site,value) {
  site.state.online=!value; // Also blocks worker-originated fetches independently of browser emulation.
  if(site.state.emulateOffline) await context.setOffline(value);
}

// Distinguish an application failure from WebKit's offline-emulation defect:
// https://github.com/microsoft/playwright/issues/42775 . No app code runs here.
async function probeOfflineFlag(browser) {
  const worker=`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(new Response('<h1>Offline probe</h1>',{headers:{'Content-Type':'text/html'}})));`;
  const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':req.url==='/sw.js'?'text/javascript':'text/html','Cache-Control':'no-store'});res.end(req.url==='/sw.js'?worker:'<h1>Online probe</h1>')});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const context=await browser.newContext({serviceWorkers:'allow'});
  try {
    const page=await context.newPage();await page.goto(origin);
    await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready});
    await page.waitForFunction(()=>navigator.serviceWorker.controller?.state==='activated');
    const online=await page.goto(origin+'/online-probe');
    assert.equal(online.fromServiceWorker(),true);
    assert.equal(await page.locator('h1').innerText(),'Offline probe');
    await context.setOffline(true);
    try {
      const response=await page.goto(origin+'/offline-probe',{timeout:10000});
      assert.equal(response.fromServiceWorker(),true);
      assert.equal(await page.locator('h1').innerText(),'Offline probe');
      return {supported:true};
    } catch(error) {return {supported:false,error:String(error)};}
  } finally {await context.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
}
async function expectUnavailable(page,url) {
  // A navigation error or non-lab document is a failure to launch the lab.
  let opened=false;
  try {await page.goto(url,{timeout:10000});opened=await page.locator('.question').count()===15;} catch {}
  assert.equal(opened,false,'Baseline unexpectedly supports cold offline SC-5; re-audit the release');
}
async function assertLab(page,url,count) {
  const response=await page.goto(url);
  assert.equal(response.status(),200);
  assert.equal(response.fromServiceWorker(),true);
  await page.waitForSelector('.question');
  assert.equal(await page.locator('.question').count(),15);
  assert.match(await page.locator('#count').innerText(),new RegExp(`: ${count}$`,'u'));
  assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=1,'Mobile SC-5 horizontal overflow');
  assert.equal(JSON.parse(await page.locator('#replay').innerText()).eventCount,count);
}

try {
  const roots={previous:await historicalBuild(PREVIOUS),published:await historicalBuild(PUBLISHED),candidate:resolve(repo,'dist-public')};
  for(const name of (process.env.E2E_BROWSERS??'chromium,webkit').split(',')) {
    assert.ok(['chromium','webkit'].includes(name),'Unknown E2E_BROWSERS entry');
    const engine={chromium,webkit}[name];
    const browser=await engine.launch(name==='chromium' && process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{});
    const site=await serve(roots);
    const context=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'allow',acceptDownloads:true});
    const result={engine:name,browser:browser.version(),profile:'iPhone 13',previous:PREVIOUS,published:PUBLISHED,checks:[]};
    results.push(result);
    const record=message=>{result.checks.push(message);console.log(`${name}: ${message}`)};
    context.setDefaultTimeout(15000);
    const errors=[];
    context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
    let page=await context.newPage();
    try {
      result.offlineFlagProbe=await probeOfflineFlag(browser);
      if(name==='chromium') assert.equal(result.offlineFlagProbe.supported,true,'Required Chromium offline emulation is unavailable');
      site.state.emulateOffline=result.offlineFlagProbe.supported;
      result.offlineMode=site.state.emulateOffline?'browser-offline-and-origin-disconnected':'origin-disconnected-only';
      if(!site.state.emulateOffline) console.log(`${name}: offline flag rejects even a literal worker response; origin-disconnection control only, not iOS airplane-mode evidence`);
      await page.goto(site.url('platform/'));
      await waitWorker(page,OLD);
      await saveAssessment(page,site);
      await saveDossier(page,site);
      await page.waitForLoadState('networkidle');
      const original=await snapshot(page);
      assert.ok(original[SC5] && original[DOSSIERS]);
      await page.evaluate(async()=>{
        const cache=await caches.open('unrelated-audit-cache');await cache.put('./sentinel',new Response('keep'));
        await new Promise((done,fail)=>{const request=indexedDB.open('pwa-audit-sentinel',1);request.onupgradeneeded=()=>request.result.createObjectStore('journal');request.onerror=()=>fail(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('journal','readwrite');tx.objectStore('journal').put('keep','record');tx.oncomplete=()=>{db.close();done()};tx.onerror=()=>fail(tx.error);};});
      });
      record('previous worker installed; real SC-5 and certification journals created through UI');

      site.state.stage='published';
      await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update()});
      await waitWorker(page,CURRENT);
      assert.deepEqual(await snapshot(page),original);
      assert.equal((await keys(page)).includes(OLD),false);
      // Warm the current lab and prove that even this is insufficient for a new navigation.
      await page.goto(site.url('labs/sc5-chronos/?cycleId=cycle-pwa-test-20261112&phase=before'));
      await page.waitForSelector('.question');
      await offline(context,site,true);
      // An already loaded page can save locally, without reloading any resources.
      await page.locator('#consent').check();await page.locator('#save').click();
      assert.match(await page.locator('#count').innerText(),/: 2$/u);
      const updated=await snapshot(page);
      const failed=await context.newPage();
      await expectUnavailable(failed,site.url('labs/sc5-chronos/?cycleId=cycle-cold-offline-001&phase=after'));
      await expectUnavailable(page,site.url('labs/sc5-chronos/?cycleId=cycle-pwa-test-20261112&phase=before'));
      await offline(context,site,false);
      await page.goto(site.url('platform/'));
      assert.deepEqual(await snapshot(page),updated);
      await failed.close();
      record('published worker update preserves bytes; cold and warm/query offline navigation fail; loaded-page save succeeds');

      // Interrupted update must keep the previous active worker and its caches/data.
      site.state.stage='candidate';site.state.missing=true;
      await page.evaluate(async()=>{
        const registration=await navigator.serviceWorker.getRegistration();
        await new Promise((done,fail)=>{
          const timer=setTimeout(()=>fail(Error('No failed candidate install observed')),30000);
          registration.addEventListener('updatefound',()=>{
            const worker=registration.installing;
            worker.addEventListener('statechange',()=>{if(worker.state==='redundant'){clearTimeout(timer);done()}});
          },{once:true});
          registration.update().catch(fail);
        });
      });
      assert.ok((await keys(page)).includes(CURRENT));
      assert.deepEqual(await snapshot(page),updated);
      assert.equal(await page.evaluate(async ({key,url})=>{const cache=await caches.open(key);return !!await cache.match(url)},{key:CURRENT,url:site.url('platform/index.html')}),true);
      // The old worker is really still controlling the lab: the new query still cannot launch offline.
      await offline(context,site,true);
      const interrupted=await context.newPage();
      await expectUnavailable(interrupted,site.url('labs/sc5-chronos/?cycleId=cycle-interrupted-001&phase=after'));
      await interrupted.close();await offline(context,site,false);
      record('missing required module rejects update; published worker/cache/journals remain active');

      site.state.missing=false;
      await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update()});
      await waitWorker(page,CANDIDATE);
      const cacheKeys=await keys(page);
      assert.ok(!cacheKeys.includes(CURRENT)&&!cacheKeys.includes(OLD));
      assert.ok(cacheKeys.includes('unrelated-audit-cache'));
      assert.deepEqual(await snapshot(page),updated);
      assert.equal(await page.evaluate(async()=>new Promise((done,fail)=>{const request=indexedDB.open('pwa-audit-sentinel',1);request.onerror=()=>fail(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction('journal').objectStore('journal').get('record');read.onsuccess=()=>{db.close();done(read.result)};read.onerror=()=>fail(read.error)}})),'keep');
      const candidateCache=await page.evaluate(async key=>(await(await caches.open(key)).keys()).map(r=>new URL(r.url).pathname),CANDIDATE);
      for(const file of ['index.html','sc5-core.mjs','temporal-replay.mjs'])assert.ok(candidateCache.includes(BASE+'labs/sc5-chronos/'+file));
      record('successful candidate activation deletes obsolete shell caches only; localStorage and IndexedDB unchanged');

      await offline(context,site,true);
      const serverRequests=site.state.requests.length;
      const resourceResponses=[];
      context.on('response',r=>{if(/sc5-chronos\/(sc5-core|temporal-replay)\.mjs$/u.test(r.url()))resourceResponses.push({url:r.url(),status:r.status(),worker:r.fromServiceWorker(),type:r.headers()['content-type']})});
      page=await context.newPage();
      try {
        await assertLab(page,site.url('labs/sc5-chronos/?cycleId=cycle-pwa-test-20261112&phase=after'),2);
      } catch(error) {
        result.offlineDiagnostics=await context.pages()[0].evaluate(async ({key,url})=>{
          const cache=await caches.open(key),cached=await cache.match(url);
          let fetched;try{const r=await fetch(url);fetched={status:r.status(),type:r.headers.get('content-type')}}catch(e){fetched={error:String(e)}}
          return {controlled:!!navigator.serviceWorker.controller,caches:await caches.keys(),cachedStatus:cached?.status,fetched};
        },{key:CANDIDATE,url:site.url('labs/sc5-chronos/index.html')});
        throw error;
      }
      assert.deepEqual(await snapshot(page),updated);
      // New query and explicit index, not an exact-URL cache hit.
      await assertLab(page,site.url('labs/sc5-chronos/index.html?cycleId=cycle-pwa-test-20261112&phase=before'),2);
      assert.ok(resourceResponses.length>=2);
      assert.ok(resourceResponses.every(r=>r.status===200&&r.worker&&r.type.includes('javascript')));
      const moduleResult=await page.evaluate(async()=>{try{const r=await fetch('./absent.mjs');return {status:r.status(),type:r.headers.get('content-type')}}catch{return {failed:true}}});
      assert.ok(moduleResult.failed||moduleResult.status>=400);
      assert.equal(moduleResult.type?.includes('html')??false,false);
      record('cold offline SC-5 directory/index/query launch; real ES modules execute; no HTML fallback for missing module');

      // Create a complete new observation offline, download and re-import its export.
      for(const q of await page.locator('.question').all())await q.getByRole('button',{name:'0,5',exact:true}).click();
      await page.locator('#context').fill('Synthetic offline upgrade audit');await page.locator('#consent').check();await page.locator('#save').click();
      assert.match(await page.locator('#count').innerText(),/: 3$/u);
      const saved=await snapshot(page);
      const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
      const download=await downloadPromise,exported=await readFile(await download.path(),'utf8');
      assert.deepEqual(JSON.parse(exported).records,JSON.parse(saved[SC5]).records);
      await page.locator('#file').setInputFiles({name:'sc5-audit.json',mimeType:'application/json',buffer:Buffer.from(exported)});
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Импортировано 3'));
      assert.match(await page.locator('#status').innerText(),/Импортировано 3/u);
      assert.deepEqual(JSON.parse((await snapshot(page))[SC5]).records,JSON.parse(saved[SC5]).records);
      assert.equal((await snapshot(page))[DOSSIERS],original[DOSSIERS]);
      // Close every document; no in-memory app state can satisfy the next launch.
      for(const tab of context.pages())await tab.close();
      page=await context.newPage();
      await assertLab(page,site.url('labs/sc5-chronos/?cycleId=cycle-pwa-test-20261112&phase=after'),3);
      assert.deepEqual(JSON.parse((await snapshot(page))[SC5]).records,JSON.parse(saved[SC5]).records);
      await mkdir(resolve(repo,'outputs/pwa-update'),{recursive:true});
      await page.screenshot({path:resolve(repo,`outputs/pwa-update/${name}-sc5-offline.png`),fullPage:true});
      await page.goto(site.url('labs/certification/?offline=1'));
      await page.locator('#journal-list [data-dossier]').first().click();
      await page.waitForSelector('#dashboard:not([hidden])');
      assert.match(await page.locator('#dashboard').innerText(),/certificate_issued=false/u);
      const dossier=JSON.parse((await snapshot(page))[DOSSIERS])[0];
      assert.ok(Object.values(dossier.flags).every(v=>v===false));assert.equal(dossier.q,null);assert.equal(dossier.tensor.Q,null);
      assert.equal(site.state.requests.length,serverRequests,'Network server received a request while offline');
      // WebKit emits these transport messages for the deliberate failed
      // navigations and absent-module check. Keep them in the evidence.
      const expectedTransport=message=>name==='webkit' && ['Cannot load .','Response served by service worker is an error'].includes(message);
      result.transportDiagnostics=errors.filter(expectedTransport);
      assert.deepEqual(errors.filter(message=>!expectedTransport(message)),[],'Unexpected application page errors');
      record('offline save/export/import and closed-tab relaunch preserve records; certification flags remain false, Q remains null');
      // Full-game root is deliberately outside this bounded offline fix.
      const root=await context.newPage();let gameOpened=false;
      try{await root.goto(site.url('?offline-audit=1'),{timeout:10000});gameOpened=await root.locator('#root').count()>0}catch{}
      result.boundaries={fullGameColdOffline:gameOpened};
      record(`full React game cold offline launch observed: ${gameOpened}`);
      // A clean installation has never visited SC-5 and has no old module cache.
      await offline(context,site,false);
      const clean=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'allow'});
      try {
        const first=await clean.newPage();
        await first.goto(site.url('platform/'));await waitWorker(first,CANDIDATE);
        await offline(clean,site,true);
        const cold=await clean.newPage();
        await assertLab(cold,site.url('labs/sc5-chronos/?cycleId=cycle-first-offline-001&phase=before'),0);
        assert.equal(await cold.evaluate(key=>localStorage.getItem(key),SC5),null);
        record('clean candidate installation launches SC-5 offline before its first visit');
      } finally {await clean.close();site.state.online=true;}
      result.status='passed';console.log(`✓ ${name}: ${result.checks.length} PWA lifecycle checks`);
    } catch(error) {result.status='failed';result.error=String(error);throw error;}
    finally {await context.close();await browser.close();await site.close();}
  }
} finally {
  await writeFile(resolve(evidenceRoot,'results.json'),JSON.stringify({createdAt:new Date().toISOString(),scope:'Mobile browser emulation and real service workers; OS Add to Home Screen not simulated',results},null,2));
  await rm(temporary,{recursive:true,force:true});
}
