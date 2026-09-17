import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(resolve(root,'data/manifest.json'),'utf8'));
const coreAssets=[
  'index.html','styles.css','manifest.webmanifest','assets/japanese-study-icon.png','app.js',
  'src/flashcard-review.mjs','src/curriculum-order.mjs','src/pwa-client.mjs','data/manifest.json','data/course-map.json',
  'data/conjugation/forms.json','data/conjugation/verbs.json','data/conjugation/keigo.json','data/conjugation/quick-reference.json','data/conjugation/plain-forms.json','data/conjugation/derived-forms.json'
];
const lessonAssets=[...new Set(manifest.lessons.flatMap(lesson=>['vocabulary','grammar','reference'].map(key=>lesson[key]).filter(Boolean).map(path=>path.replace(/^\.\//,''))))];

assert.ok(manifest.lessons.length>0,'the offline inventory includes lessons');
for(const asset of [...coreAssets,...lessonAssets])await access(resolve(root,asset));
assert.equal(lessonAssets.length,manifest.lessons.reduce((count,lesson)=>count+['vocabulary','grammar','reference'].filter(key=>lesson[key]).length,0),'every manifest data resource is included exactly once');
const sw=await readFile(resolve(root,'sw.js'),'utf8');
for(const asset of coreAssets)assert.match(sw,new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'service worker shell includes '+asset);
assert.match(sw,/mapWithConcurrency\(lessonAssets,4/,'lesson downloads use bounded concurrency');
assert.match(sw,/await caches\.delete\(CACHE_NAME\)/,'partial offline caches are removed after a failed preparation');
assert.doesNotMatch(sw,/skipWaiting\(\);\s*\}\);/,'the worker does not activate automatically after installation');
assert.match(sw,/if\(event\.data\?\.type==='SKIP_WAITING'\)/,'immediate activation requires an explicit user message');
assert.match(sw,/slice\(-2\)/,'cache cleanup preserves the current and previous completed caches');
assert.doesNotMatch(sw,/localStorage|indexedDB/,'review progress is not stored in static caches');

console.log(`Offline inventory tests passed: ${coreAssets.length} shell assets and ${lessonAssets.length} lesson assets.`);
