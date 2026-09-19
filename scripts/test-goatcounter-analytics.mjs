import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import vm from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const html=await readFile(resolve(root,'index.html'),'utf8');

assert.match(html,/script\.dataset\.goatcounter='https:\/\/sasukimm\.goatcounter\.com\/count'/,'the configured GoatCounter endpoint must be used');
assert.match(html,/script\.src='https:\/\/gc\.zgo\.at\/count\.js'/,'the GoatCounter loader must be used');
assert.match(html,/location\.hostname!=='sasukimm\.github\.io'/,'only the public-release hostname may load analytics');
assert.doesNotMatch(html,/location\.hostname==='yuktun\.github\.io'/,'the development hostname must not be allowed');
assert.match(html,/document\.getElementById\('goatcounter-script'\)/,'the loader must guard against duplicate scripts');
assert.equal((html.match(/gc\.zgo\.at\/count\.js/g)||[]).length,1,'only one GoatCounter loader may be included');

const analyticsSource=html.match(/<script>(\(\(\)=>\{if\(location\.hostname[\s\S]*?\}\)\(\);)<\/script>/)?.[1];
assert.ok(analyticsSource,'the production analytics loader is present');
function loadedScripts(hostname,alreadyLoaded=false){
  const appended=[];
  const document={
    getElementById:()=>alreadyLoaded?{}:null,
    createElement:()=>({dataset:{},remove(){}}),
    head:{append:script=>appended.push(script)}
  };
  vm.runInNewContext(analyticsSource,{location:{hostname},document});
  return appended;
}
const [publicScript]=loadedScripts('sasukimm.github.io');
assert.equal(publicScript.dataset.goatcounter,'https://sasukimm.goatcounter.com/count');
assert.equal(publicScript.src,'https://gc.zgo.at/count.js');
for(const blockedHost of ['yuktun.github.io','localhost','127.0.0.1','example.com'])assert.equal(loadedScripts(blockedHost).length,0,`${blockedHost} must not load analytics`);
assert.equal(loadedScripts('sasukimm.github.io',true).length,0,'the public release must not load a duplicate script');

console.log('GoatCounter analytics tests passed.');
