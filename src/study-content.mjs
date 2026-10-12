export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const labels={category:'分類',ko:'こ',so:'そ',a:'あ',do:'ど',counter:'量詞',question:'疑問詞',usage:'用法',notes:'注意',ja:'日文',zh:'中文',title:'標題',content:'內容',pattern:'句型',meaningZh:'中文意思',explanationZh:'解說',examples:'例句',headers:'欄目',rows:'內容',kind:'類別',scale:'程度',affirmative:'肯定',negative:'否定',table:'表格',sections:'分類',subpatterns:'相關句型',comparison:'比較',transformations:'變化',reference:'參考',section:'分類',from:'原形',to:'變化後',note:'注意',form:'詞形'};
Object.assign(labels,{explanation:'解說',reading:'讀音',group:'組別',masu:'ます形',te:'て形',example:'例子',exampleTe:'例子的て形',verbs:'動詞',illustrations:'圖例',children:'細項',number:'編號'});
const labelFor=key=>labels[key]||key;

// Preserve nested school tables and reference sections without inventing content.
export function renderStudyValue(value){
  if(value===null||value===undefined)return '';
  if(typeof value!=='object')return escapeHtml(value);
  if(Array.isArray(value)){
    if(!value.length)return '';
    if(value.every(row=>Array.isArray(row)))return tableHtml([],value);
    if(value.every(row=>row&&typeof row==='object'&&!Array.isArray(row))&&!value.some(row=>row.headers||row.rows||row.table||row.sections)){
      const keys=[...new Set(value.flatMap(row=>Object.keys(row)))];
      return tableHtml(keys.map(labelFor),value.map(row=>keys.map(key=>row[key])));
    }
    return `<ul class="study-list">${value.map(entry=>`<li>${renderStudyValue(entry)}</li>`).join('')}</ul>`;
  }
  if(Array.isArray(value.headers)&&Array.isArray(value.rows))return tableHtml(value.headers,value.rows);
  return `<dl class="study-fields">${Object.entries(value).map(([key,entry])=>`<dt>${escapeHtml(labelFor(key))}</dt><dd>${renderStudyValue(entry)}</dd>`).join('')}</dl>`;
}
function tableHtml(headers,rows){
  return `<div class="study-table-wrap" tabindex="0" aria-label="教材表格"><table>${headers.length?`<thead><tr>${headers.map(header=>`<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead>`:''}<tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${renderStudyValue(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export function studyDetailsHtml(item){
  const fields=['notes','examples','table','subpatterns','comparison','transformations','reference','sections','content'];
  const content=fields.filter(key=>item[key]?.length||item[key]&&typeof item[key]==='object').map(key=>`<section><h3>${escapeHtml(labelFor(key))}</h3>${renderStudyValue(item[key])}</section>`).join('');
  const source=item.source?.filename?`<p class="source-note">來源：${escapeHtml(item.source.filename)}${item.source.page?` · 第 ${escapeHtml(item.source.page)} 頁`:''}</p>`:'';
  const original=item.sourceText?`<details class="study-original"><summary>學校教材原文</summary><p>${escapeHtml(item.sourceText)}</p></details>`:'';
  const supplementary=item.supplementary?`<section><h3>AI 補充說明</h3>${renderStudyValue(Object.fromEntries(Object.entries(item.supplementary).filter(([key])=>key!=='contentSource')))}</section>`:'';
  return content||original||supplementary?`<details class="library-details"><summary>查看完整內容</summary>${content}${original}${supplementary}${source}</details>`:source;
}
export function studySearchText(item){
  const values=['kana','kanji','title','meaningZh','pattern','explanationZh','sourceText','notes','supplementary','category','examples','table','subpatterns','comparison','transformations','reference','sections','content','book','schoolYear','lesson'];
  const flatten=value=>value&&typeof value==='object'?Object.values(value).flatMap(flatten):[value??''];
  return values.flatMap(key=>flatten(item[key])).join(' ');
}
