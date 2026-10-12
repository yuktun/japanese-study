import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const verbs=await read('data/conjugation/verbs.json');
const endings={う:['わ','い','え','お','って','った'],く:['か','き','け','こ','いて','いた'],ぐ:['が','ぎ','げ','ご','いで','いだ'],す:['さ','し','せ','そ','して','した'],つ:['た','ち','て','と','って','った'],ぬ:['な','に','ね','の','んで','んだ'],ぶ:['ば','び','べ','ぼ','んで','んだ'],む:['ま','み','め','も','んで','んだ'],る:['ら','り','れ','ろ','って','った']};
function expectedForms(dictionary,group){
  const stem=dictionary.slice(0,-1);
  if(group==='I'){
    const [a,i,e,o,te,ta]=endings[dictionary.at(-1)];
    return {masu:stem+i+'ます',dictionary,nai:stem+a+'ない',nakatta:stem+a+'なかった',te:dictionary==='行く'||dictionary==='いく'?stem+'って':stem+te,ta:dictionary==='行く'||dictionary==='いく'?stem+'った':stem+ta,potential:stem+e+'る',volitional:stem+o+'う',imperative:stem+e,prohibitive:dictionary+'な',conditional:stem+e+'ば',conditionalNegative:stem+a+'なければ',passive:stem+a+'れる',causative:stem+a+'せる',causativePassive:stem+a+'せられる'};
  }
  if(group==='II')return {masu:stem+'ます',dictionary,nai:stem+'ない',nakatta:stem+'なかった',te:stem+'て',ta:stem+'た',potential:stem+'られる',volitional:stem+'よう',imperative:stem+'ろ',prohibitive:dictionary+'な',conditional:stem+'れば',conditionalNegative:stem+'なければ',passive:stem+'られる',causative:stem+'させる',causativePassive:stem+'させられる'};
  if(dictionary==='する')return {masu:'します',dictionary,nai:'しない',nakatta:'しなかった',te:'して',ta:'した',potential:'できる',volitional:'しよう',imperative:'しろ',prohibitive:'するな',conditional:'すれば',conditionalNegative:'しなければ',passive:'される',causative:'させる',causativePassive:'させられる'};
  const written=dictionary==='来る',ku=written?'来':'く',ki=written?'来':'き',ko=written?'来':'こ';
  return {masu:ki+'ます',dictionary,nai:ko+'ない',nakatta:ko+'なかった',te:ki+'て',ta:ki+'た',potential:ko+'られる',volitional:ko+'よう',imperative:ko+'い',prohibitive:dictionary+'な',conditional:ku+'れば',conditionalNegative:ko+'なければ',passive:ko+'られる',causative:ko+'させる',causativePassive:ko+'させられる'};
}
let checked=0;
for(const verb of verbs)for(const index of [0,1]){
  const expected=expectedForms(verb.forms.dictionary[index],verb.group);
  assert.equal(verb.masu[index],expected.masu,`${verb.id} ます形`);
  for(const [form,value] of Object.entries(verb.forms)){assert.equal(value[index],expected[form],`${verb.id} ${form} ${index?'reading':'written form'}`);checked++;}
}
const quick=await read('data/conjugation/quick-reference.json');
for(const verb of quick.groupI){
  const expected=expectedForms(verb.forms.dictionary,'I');
  for(const [form,value] of Object.entries(verb.forms))assert.equal(value,form.endsWith('Polite')?expected[form.slice(0,-6)].slice(0,-1)+'ます':expected[form],`${verb.masu}: quick ${form}`);
}
const adjective=await read('data/year1/lesson12/grammar.json');
assert.ok(adjective[0].explanationZh.includes('～かったです'));
assert.ok(adjective[0].explanationZh.includes('～くないです'));
assert.ok(adjective[0].explanationZh.includes('～くなかったです'));
assert.ok(!adjective[0].explanationZh.includes('～いかった'));
const honorific=(await read('data/year4/lesson9/grammar.json'))[0];
assert.equal(honorific.pattern,'お～（ますを削除）です');
assert.ok(honorific.notes.some(note=>note.includes('刪除線')));
const stem=(await read('data/year1/lesson13/grammar.json')).find(item=>item.id==='y1-l13-g002');
assert.equal(stem.pattern,'｢ます形｣：Ｖ（ますを削除）');
assert.equal(stem.meaningZh,undefined,'the generated stem summary is not a school meaning');
assert.equal(stem.supplementary.contentSource,'ai_derived');
console.log(`Conjugation content tests passed: ${checked} written/read forms, quick references, and source deletion-mark corrections.`);
