import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getInstallPlatform,installInstructions} from '../src/install-app.mjs';

const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(resolve(root,'manifest.webmanifest'),'utf8'));
const [html,styles]=await Promise.all(['index.html','styles.css'].map(file=>readFile(resolve(root,file),'utf8')));

const media=query=>({matches:query==='(display-mode: standalone)'});
assert.equal(getInstallPlatform({userAgent:'Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1',platform:'iPhone',standalone:false},media).isStandalone,true);
const iosSafari=getInstallPlatform({userAgent:'Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1',platform:'iPhone',standalone:false},()=>({matches:false}));
assert.equal(iosSafari.isSafari,true);
assert.match(installInstructions(iosSafari).content,/加入主畫面/);
const iosChrome=getInstallPlatform({userAgent:'Mozilla/5.0 (iPhone) CriOS/130.0 Mobile',platform:'iPhone',standalone:false},()=>({matches:false}));
assert.equal(iosChrome.isSafari,false);
assert.match(installInstructions(iosChrome).content,/Safari/);
assert.match(installInstructions({isIOS:false,isSafari:false,browser:'edge'}).content,/應用程式/);
assert.match(html,/id="install-app-button"/,'sidebar install entry exists');
assert.match(html,/id="install-modal"/,'install modal is outside the sidebar');
assert.ok(html.indexOf('id="install-modal"')>html.indexOf('</aside>'),'the modal is not clipped by the sidebar drawer');
assert.match(styles,/sidebar-footer\{position:sticky;bottom:0/,'the sidebar footer remains reachable when sidebar content scrolls');
assert.match(styles,/safe-area-inset-bottom/,'the sidebar respects device safe areas');
assert.equal(manifest.start_url,'./');
assert.equal(new URL(manifest.start_url,'https://example.github.io/japanese-study/manifest.webmanifest').pathname,'/japanese-study/');

console.log('Install app tests passed.');
