import { access, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const required={
  vocabulary:['id','schoolYear','book','lesson','kana','meaningZh','source'],
  grammar:['id','schoolYear','book','lesson','pattern','meaningZh','source'],
  reference:['id','schoolYear','book','lesson','title','type','source']
};
const allowedBooks=new Set(['初級 I','初級 II','中級 I','中級 II']);
const fail=message=>{throw new Error(message);};
const readJson=async path=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(error){fail(`${path}: ${error.message}`);}};
const present=value=>value!==undefined&&value!==null&&value!=='';

const manifestPath=resolve(root,'data','manifest.json');
const manifest=await readJson(manifestPath);
if(!manifest||!Array.isArray(manifest.lessons))fail('data/manifest.json must contain a lessons array.');

const ids=new Set();
const manifestLessons=new Set();
let itemCount=0;
for(const [lessonIndex,lesson] of manifest.lessons.entries()){
  const label=`manifest lesson ${lessonIndex+1}`;
  for(const field of ['schoolYear','book','lesson'])if(!present(lesson?.[field]))fail(`${label} is missing ${field}.`);
  if(!Number.isInteger(lesson.schoolYear)||lesson.schoolYear<1||lesson.schoolYear>5)fail(`${label} schoolYear must be an integer from 1 to 5.`);
  if(!Number.isInteger(lesson.lesson)||lesson.lesson<1)fail(`${label} lesson must be a positive integer.`);
  if(!allowedBooks.has(lesson.book))fail(`${label} has unsupported book: ${lesson.book}`);
  const manifestKey=`${lesson.schoolYear}|${lesson.book}|${lesson.lesson}`;
  if(manifestLessons.has(manifestKey))fail(`${label} duplicates manifest metadata: Year ${lesson.schoolYear}, ${lesson.book}, Lesson ${lesson.lesson}.`);
  manifestLessons.add(manifestKey);
  if(!present(lesson.vocabulary)&&!present(lesson.grammar))fail(`${label} must reference vocabulary or grammar data.`);
  for(const type of ['vocabulary','grammar','reference']){
    if(!present(lesson[type]))continue;
    if(typeof lesson[type]!=='string')fail(`${label} ${type} path must be a string.`);
    const relativePath=lesson[type].replace(/^\.\//,'');
    const filePath=resolve(root,relativePath);
    const repositoryRelative=relative(root,filePath);
    if(isAbsolute(repositoryRelative)||repositoryRelative.startsWith('..'))fail(`${label} ${type} path must stay inside the repository.`);
    try{await access(filePath);}catch{fail(`${label} references missing file: ${lesson[type]}`);}
    const items=await readJson(filePath);
    if(!Array.isArray(items))fail(`${lesson[type]} must contain a JSON array.`);
    for(const [itemIndex,item] of items.entries()){
      const itemLabel=`${lesson[type]} item ${itemIndex+1}`;
      for(const field of required[type])if(!present(item?.[field]))fail(`${itemLabel} is missing ${field}.`);
      if(!item.source||typeof item.source!=='object'||Array.isArray(item.source))fail(`${itemLabel} source must be a non-array object.`);
      if(!present(item.source.type))fail(`${itemLabel} source.type is required.`);
      if(!Object.entries(item.source).some(([key,value])=>key!=='type'&&present(value)))fail(`${itemLabel} source requires at least one reference field.`);
      if(type==='grammar'&&item.sourceOrder!==itemIndex+1)fail(`${itemLabel} sourceOrder must be ${itemIndex+1} to match its PDF order.`);
      if(type==='reference'&&item.type!=='reference')fail(`${itemLabel} type must be reference.`);
      if(item.schoolYear!==lesson.schoolYear||item.book!==lesson.book||item.lesson!==lesson.lesson)fail(`${itemLabel} metadata does not match its manifest lesson.`);
      if(ids.has(item.id))fail(`${itemLabel} has duplicate id: ${item.id}`);
      ids.add(item.id);itemCount++;
    }
  }
}

console.log(`Data validation passed: ${manifest.lessons.length} lesson(s), ${itemCount} item(s), ${ids.size} unique id(s).`);
