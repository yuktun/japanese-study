import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {studyDetailsHtml,studySearchText} from '../src/study-content.mjs';

const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(resolve(root,'data/manifest.json'),'utf8'));
const fields=['notes','examples','table','subpatterns','comparison','transformations','reference','sections','content'];
const strings=value=>typeof value==='string'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
const escaped=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
let checked=0;
for(const lesson of manifest.lessons)for(const type of ['vocabulary','grammar','reference']){
  if(!lesson[type])continue;
  for(const item of JSON.parse(await readFile(resolve(root,lesson[type]),'utf8'))){
    const html=studyDetailsHtml(item),search=studySearchText(item);
    for(const field of fields)for(const text of strings(item[field])){
      assert.ok(html.includes(escaped(text)),`${item.id}: ${field} school text is visible in details`);
      assert.ok(search.includes(text),`${item.id}: ${field} school text is searchable`);
    }
    checked++;
  }
}
const unsafe=studyDetailsHtml({notes:['<img src=x onerror="alert(1)">'],source:{filename:'<school>.pdf'}});
assert.ok(!unsafe.includes('<img'),'source content cannot become executable HTML');
assert.ok(unsafe.includes('&lt;school&gt;.pdf'),'source attribution is escaped');
console.log(`Study content tests passed: ${checked} records retain searchable notes, examples, tables, and nested reference content.`);
