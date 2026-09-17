import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const html=await readFile(resolve(root,'index.html'),'utf8');

assert.match(html,/script\.dataset\.goatcounter='https:\/\/sasukimm\.goatcounter\.com\/count'/,'the configured GoatCounter endpoint must be used');
assert.match(html,/script\.src='https:\/\/gc\.zgo\.at\/count\.js'/,'the GoatCounter loader must be used');
assert.match(html,/\['localhost','127\.0\.0\.1','0\.0\.0\.0','::1'\]/,'localhost and development hosts must not load analytics');
assert.match(html,/host\.endsWith\('\.local'\)/,'local development domains must not load analytics');
assert.match(html,/document\.getElementById\('goatcounter-script'\)/,'the loader must guard against duplicate scripts');
assert.equal((html.match(/gc\.zgo\.at\/count\.js/g)||[]).length,1,'only one GoatCounter loader may be included');

console.log('GoatCounter analytics tests passed.');
