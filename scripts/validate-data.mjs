import { access, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const required={
  vocabulary:['id','schoolYear','book','lesson','kana','meaningZh','source'],
  grammar:['id','schoolYear','book','lesson','sourceOrder','pattern','source'],
  reference:['id','schoolYear','book','lesson','title','type','source']
};
const allowedBooks=new Set(['初級 I','初級 II','中級 I','中級 II']);
const fail=message=>{throw new Error(message);};
const readJson=async path=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(error){fail(`${path}: ${error.message}`);}};
const present=value=>value!==undefined&&value!==null&&value!=='';
const nonEmptyText=value=>typeof value==='string'&&present(value.trim());
const validateOptionalText=(value,label)=>{
  if(!nonEmptyText(value))fail(`${label} must be a non-empty string when present.`);
};
const validateOptionalNotes=(value,label)=>{
  if(typeof value==='string'){validateOptionalText(value,label);return;}
  if(!Array.isArray(value)||value.some(note=>!nonEmptyText(note)))fail(`${label} must be a non-empty string or an array of non-empty strings when present.`);
};

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
      if(type==='grammar'){
        for(const field of ['meaningZh','explanationZh'])if(field in item)validateOptionalText(item[field],`${itemLabel} ${field}`);
        if('notes' in item)validateOptionalNotes(item.notes,`${itemLabel} notes`);
        if('examples' in item){
          if(!Array.isArray(item.examples)||!item.examples.length)fail(`${itemLabel} examples must be a non-empty array when present.`);
          item.examples.forEach((example,exampleIndex)=>{
            if(!example||typeof example!=='object'||Array.isArray(example))fail(`${itemLabel} example ${exampleIndex+1} must be an object.`);
            for(const field of ['ja','zh'])validateOptionalText(example[field],`${itemLabel} example ${exampleIndex+1} ${field}`);
          });
        }
        if('supplementary' in item){
          if(!item.supplementary||Array.isArray(item.supplementary)||typeof item.supplementary!=='object')fail(`${itemLabel} supplementary must be an object when present.`);
          if(item.supplementary.contentSource!=='ai_derived')fail(`${itemLabel} supplementary.contentSource must be ai_derived.`);
          const supplementaryFields=Object.entries(item.supplementary).filter(([key])=>key!=='contentSource');
          if(!supplementaryFields.length)fail(`${itemLabel} supplementary must contain derived content.`);
          for(const [field,value] of supplementaryFields){
            if(field==='notes')validateOptionalNotes(value,`${itemLabel} supplementary.${field}`);
            else validateOptionalText(value,`${itemLabel} supplementary.${field}`);
          }
        }
      }
      if(type==='reference'){
        if(item.type!=='reference')fail(`${itemLabel} type must be reference.`);
        if('table' in item&&(!Array.isArray(item.table)||!item.table.length))fail(`${itemLabel} table must be a non-empty array when present.`);
        if('sections' in item){
          if(!Array.isArray(item.sections)||!item.sections.length)fail(`${itemLabel} sections must be a non-empty array when present.`);
          item.sections.forEach((section,sectionIndex)=>{
            if(!section||typeof section!=='object'||!nonEmptyText(section.title)||!Array.isArray(section.table)||!section.table.length)fail(`${itemLabel} section ${sectionIndex+1} must have a title and non-empty table.`);
          });
        }
      }
      if(item.schoolYear!==lesson.schoolYear||item.book!==lesson.book||item.lesson!==lesson.lesson)fail(`${itemLabel} metadata does not match its manifest lesson.`);
      if(ids.has(item.id))fail(`${itemLabel} has duplicate id: ${item.id}`);
      ids.add(item.id);itemCount++;
    }
  }
}

console.log(`Data validation passed: ${manifest.lessons.length} lesson(s), ${itemCount} item(s), ${ids.size} unique id(s).`);
