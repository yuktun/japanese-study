import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const [html,client,sw,styles]=await Promise.all([
  readFile(resolve(root,'index.html'),'utf8'),
  readFile(resolve(root,'src/pwa-client.mjs'),'utf8'),
  readFile(resolve(root,'sw.js'),'utf8'),
  readFile(resolve(root,'styles.css'),'utf8')
]);

assert.match(html,/id="check-for-update-button"/,'sidebar includes a manual update check button');
assert.match(html,/檢查更新/,'manual control has the expected label');
assert.match(html,/id="update-check-status"/,'manual check result is announced accessibly');
assert.match(styles,/\.sidebar-update\{/,'manual control has sidebar styling');
assert.match(client,/await registration\.update\(\)/,'manual control directly invokes ServiceWorkerRegistration.update()');
assert.match(client,/已是最新版本/,'manual check reports when there is no waiting update');
assert.match(client,/activateWaitingWorker\(\)/,'a waiting worker is activated after a manual check');
assert.match(client,/waiting\.postMessage\(\{type:'SKIP_WAITING'\}\)/,'the client requests immediate activation explicitly');
assert.match(client,/navigator\.serviceWorker\.addEventListener\('controllerchange'/,'client reloads when a replacement controller takes over');
assert.match(client,/sessionStorage\.getItem\('jp-study-update-reload'\)/,'reload loop prevention is persisted through the reload');
assert.match(sw,/if\(event\.data\?\.type==='SKIP_WAITING'\)/,'worker accepts explicit activation requests');
assert.match(sw,/self\.skipWaiting\(\)/,'worker skips its waiting phase only on request');
assert.match(sw,/await self\.clients\.claim\(\)/,'worker claims controlled pages during activation');

console.log('PWA update lifecycle tests passed.');
