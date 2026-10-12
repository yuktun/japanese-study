import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';

// Set PLAYWRIGHT_MODULE to a bundled Playwright package if it is not installed locally.
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(import.meta.dirname,'..');
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{
    const data=await readFile(file);
    const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.png':'image/png','.webmanifest':'application/manifest+json'};
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(data);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const errors=[];
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  // No production account or analytics requests are needed for UI regression tests.
  await context.route('https://**/*',route=>route.abort());
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.querySelector('#year-select').options.length>0);
  const manifest=JSON.parse(await readFile(resolve(root,'data/manifest.json'),'utf8'));
  let checkedLessons=0;
  for(const year of [...new Set(manifest.lessons.map(lesson=>lesson.schoolYear))]){
    await page.locator('#year-select').selectOption(String(year));
    for(const lesson of manifest.lessons.filter(lesson=>lesson.schoolYear===year)){
      await page.locator('#lesson-select').selectOption(String(lesson.lesson));
      const counts=await Promise.all(['vocabulary','grammar'].map(async type=>lesson[type]?JSON.parse(await readFile(resolve(root,lesson[type]),'utf8')).length:0));
      assert.equal(await page.locator('#deck-total').textContent(),`${counts.reduce((a,b)=>a+b,0)} 張`,`correct deck size for year ${year}, lesson ${lesson.lesson}`);
      assert.ok(!(await page.locator('#flashcard').textContent()).includes('undefined'));
      checkedLessons++;
    }
  }
  assert.equal(checkedLessons,62);
  await page.locator('#year-select').selectOption('1');
  await page.locator('#lesson-select').selectOption('1');
  await page.locator('#card-jump').fill(await page.locator('#card-jump').getAttribute('max'));
  await page.locator('#card-jump').press('Tab');
  await page.locator('#next-button').click();
  assert.equal(await page.locator('#restart-button').count(),1,'the last card completes a review');
  const today=await page.locator('#today-count').textContent();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#today-count').textContent(),today,'completed reviews do not count extra cards');
  await page.locator('#restart-button').click();
  await page.locator('#flashcard').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.card-front').getAttribute('aria-hidden'),'true','hidden card faces are excluded from accessibility navigation');
  if(await page.locator('#menu-button').getAttribute('aria-expanded')!=='true')await page.locator('#menu-button').click();
  await page.locator('[data-view="library"]').click();
  assert.equal(await page.locator('.library-card').count(),60,'large result sets are paginated');
  await page.locator('#library-more').click();
  assert.equal(await page.locator('.library-card').count(),120,'pagination exposes the next results');
  await page.locator('#search-input').fill('名詞 1');
  assert.ok(await page.locator('.library-card').count()>0);
  assert.ok(await page.locator('.library-details').first().textContent().then(text=>text.includes('助詞通常不能單獨使用。')&&text.includes('IMCの社員')),'library includes all notes and examples');
  await page.locator('#search-input').fill('こそあど');
  assert.ok(await page.locator('.library-card').count()>0,'school reference material is searchable');
  await page.locator('[data-library-filter="types"] .filter-trigger').click();
  await page.locator('[data-library-filter="types"] input[value="reference"]').check();
  await page.locator('#search-input').click();
  assert.equal(await page.locator('.library-card').count(),1,'school references can be filtered independently');
  await page.locator('.library-details').first().evaluate(node=>node.open=true);
  assert.ok(await page.locator('.library-card table').count()>0,'reference tables are rendered');
  if(await page.locator('#menu-button').getAttribute('aria-expanded')!=='true')await page.locator('#menu-button').click();
  await page.locator('[data-view="conjugation"]').click();
  await page.waitForSelector('[data-conjugation-form]');
  for(const section of ['basic','plain','quick','keigo']){
    await page.locator(`[data-conjugation-section="${section}"]`).click();
    assert.ok(await page.locator(section==='basic'?'#conjugation-rule-card':'#conjugation-reference').textContent());
  }
  await page.locator('[data-conjugation-section="basic"]').click();
  const forms=await page.locator('[data-conjugation-form]').evaluateAll(nodes=>nodes.map(node=>node.dataset.conjugationForm));
  for(const form of forms){
    await page.locator(`[data-conjugation-form="${form}"]`).click();
    await page.locator('#conjugation-answer-toggle').click();
    assert.ok(await page.locator('.conjugation-verb').count()>0);
  }
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    for(const view of ['review','library','conjugation']){
      if(await page.locator('#menu-button').getAttribute('aria-expanded')!=='true')await page.locator('#menu-button').click();
      await page.locator(`[data-view="${view}"]`).click();
      await page.waitForFunction(()=>document.querySelector('#sidebar').getBoundingClientRect().right<=1);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${view} fits viewport ${width}`);
      if(width===390&&process.env.AUDIT_SCREENSHOT_DIR){await mkdir(process.env.AUDIT_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.AUDIT_SCREENSHOT_DIR,`${view}-mobile.png`)});}
    }
  }
  await page.evaluate(()=>localStorage.setItem('jp-study-today','broken JSON'));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#year-select').options.length>0);
  assert.equal(await page.locator('#today-count').textContent(),'0 張','corrupt counters do not prevent startup');
  let reverseLesson;
  for(const lesson of manifest.lessons){
    if(lesson.grammar){const items=JSON.parse(await readFile(resolve(root,lesson.grammar),'utf8'));if(items.some(item=>!item.meaningZh)){reverseLesson=lesson;break;}}
  }
  await page.locator('#year-select').selectOption(String(reverseLesson.schoolYear));
  await page.locator('#lesson-select').selectOption(String(reverseLesson.lesson));
  const total=Number((await page.locator('#deck-total').textContent()).split(' ')[0]);
  await page.locator('#card-direction').selectOption('zh-ja');
  assert.ok(Number((await page.locator('#deck-total').textContent()).split(' ')[0])<total,'reverse mode excludes cards without a translated prompt');
  assert.equal(await page.locator('#direction-note').isVisible(),true);
  await page.locator('#card-direction').selectOption('ja-zh');
  await page.locator('#year-select').selectOption('1');
  await page.locator('#lesson-select').selectOption('13');
  await page.locator('#deck-type').selectOption('grammar');
  await page.locator('#card-jump').fill('2');
  await page.locator('#card-jump').press('Tab');
  await page.locator('#flashcard').focus();
  await page.keyboard.press('Enter');
  assert.ok((await page.locator('.answer-supplementary').textContent()).includes('AI 補充摘要'),'derived explanations are labelled on review cards');
  await page.waitForFunction(()=>document.querySelector('#offline-status').dataset.state==='ready');
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#year-select').options.length>0);
  await page.waitForFunction(()=>document.querySelector('#offline-status').dataset.state==='offline');
  if(await page.locator('#menu-button').getAttribute('aria-expanded')!=='true')await page.locator('#menu-button').click();
  await page.locator('[data-view="conjugation"]').click();
  await page.waitForSelector('[data-conjugation-form]');
  assert.equal(await page.locator('[data-conjugation-form]').count(),12,'all conjugation references load offline');
  const blocked=await browser.newContext();
  await blocked.route('https://**/*',route=>route.abort());
  await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError');}}));
  const blockedPage=await blocked.newPage();blockedPage.on('pageerror',error=>errors.push(error.message));
  await blockedPage.goto(`http://127.0.0.1:${server.address().port}`);
  await blockedPage.waitForFunction(()=>document.querySelector('#year-select').options.length>0);
  await blockedPage.locator('#mark-correct-button').click();
  assert.equal(await blockedPage.locator('#mark-correct-button').getAttribute('aria-pressed'),'true','storage restrictions do not disable review');
  assert.ok((await blockedPage.locator('#toast').textContent()).includes('無法保存'),'unsaved progress is disclosed');
  await blocked.close();
  assert.deepEqual(errors,[],'all views and startup run without uncaught errors');
  await context.close();
  console.log(`App browser tests passed: 62 lessons, review, library pagination/content, 12 conjugation forms, four viewport sizes, reverse prompts, corrupt storage, and offline reload.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
