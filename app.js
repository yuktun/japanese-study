const state={all:[],references:[],lessons:[],deck:[],index:0,revealed:false,again:0,good:0,quickSeen:0,type:'all',direction:'ja-zh',year:null,lesson:null,ratingEnabled:localStorage.getItem('jp-study-rating-options')==='true',view:'review',library:{query:'',years:[],lessons:[],types:[]}};
let fallbackAudio=null;
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

async function loadData(){
  try{
    const manifestResponse=await fetch('./data/manifest.json?v=year1-complete-2',{cache:'no-cache'});
    if(!manifestResponse.ok)throw new Error(`教材清單載入失敗 (${manifestResponse.status})`);
    const manifest=await manifestResponse.json();
    if(!Array.isArray(manifest.lessons))throw new Error('教材清單格式無效');
    state.lessons=manifest.lessons;
    const groups=await Promise.all(manifest.lessons.flatMap(lesson=>['vocabulary','grammar'].filter(type=>lesson[type]).map(async type=>{
      const response=await fetch(`${lesson[type]}?v=year1-complete`,{cache:'no-cache'});
      if(!response.ok)throw new Error(`${lesson[type]} 載入失敗 (${response.status})`);
      const items=await response.json();
      if(!Array.isArray(items))throw new Error(`${lesson[type]} 格式無效`);
      return items.map(item=>({...item,type}));
    })));
    const referenceGroups=await Promise.all(manifest.lessons.filter(lesson=>lesson.reference).map(async lesson=>{
      try{
        const response=await fetch(`${lesson.reference}?v=year1-complete`,{cache:'no-cache'});
        if(!response.ok)throw new Error(`${lesson.reference} 載入失敗 (${response.status})`);
        const items=await response.json();
        if(!Array.isArray(items))throw new Error(`${lesson.reference} 格式無效`);
        return items;
      }catch(error){console.warn(error);return [];}
    }));
    state.all=groups.flat();
    state.references=referenceGroups.flat();
    initialiseFilters();resetDeck();renderLibrary();
  }catch(error){
    console.error(error);
    $('#card-content').innerHTML='<p class="card-prompt">資料暫時載入唔到</p><h2 style="font-size:1.5rem">請重新整理頁面</h2>';
    $('#answer-actions').innerHTML='';
    showToast(error.message||'教材載入失敗，請稍後再試。');
  }
}

function currentPool(){return state.all.filter(item=>(state.type==='all'||item.type===state.type)&&item.schoolYear===state.year&&item.lesson===state.lesson);}
function labelFor(item){return item.type==='grammar'?'文法 Grammar':`生字 · ${item.category||'Vocabulary'}`;}
function japaneseFor(item){return item.pattern||item.kanji||item.kana;}
function selectedLessonMeta(){return state.lessons.find(item=>item.schoolYear===state.year&&item.lesson===state.lesson)||state.all.find(item=>item.schoolYear===state.year&&item.lesson===state.lesson);}
function updateCourseDetails(){
  const meta=selectedLessonMeta(),lessonItems=state.all.filter(item=>item.schoolYear===state.year&&item.lesson===state.lesson);
  const vocabularyCount=lessonItems.filter(item=>item.type==='vocabulary').length,grammarCount=lessonItems.filter(item=>item.type==='grammar').length;
  $('#course-year').textContent=`Year ${state.year}`;$('#course-book').textContent=`大家的日本語 · ${meta?.book||''}`;$('#course-lesson').textContent=`Lesson ${state.lesson} 已加入`;
  const deckBook=$('.deck-info span'),deckSummary=$('.deck-info p');
  if(deckBook)deckBook.textContent=meta?.book||'';
  if(deckSummary)deckSummary.textContent=`現有 Lesson ${state.lesson}：${vocabularyCount} 個生字、${grammarCount} 項文法。`;
}

function resetDeck(shuffle=false){
  state.deck=[...currentPool()];
  if(shuffle){for(let i=state.deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[state.deck[i],state.deck[j]]=[state.deck[j],state.deck[i]];}}
  state.index=0;state.revealed=false;state.again=0;state.good=0;state.quickSeen=0;
  $('.crumb span').textContent=`Year ${state.year}`;$('.crumb b').textContent=`Lesson ${String(state.lesson).padStart(2,'0')}`;
  updateCourseDetails();
  renderCard();
}

function renderCard(){
  const total=state.deck.length;
  $('#deck-total').textContent=`${total} 張`;
  $('#rating-options').checked=state.ratingEnabled;
  $('#card-position').textContent=state.index<total?`Card ${state.index+1} of ${total}`:'Session complete';
  $('#session-type').textContent=state.ratingEnabled?(state.type==='all'?'Memory check':state.type==='grammar'?'Grammar check':'Vocabulary check'):'Quick flashcards';
  $('#progress-fill').style.width=`${total?Math.min(state.index/total*100,100):0}%`;
  $('#session-numbers').innerHTML=state.ratingEnabled?`<span><i class="number-dot again"></i><b id="again-count">${state.again}</b> 待重溫</span><span><i class="number-dot good"></i><b id="good-count">${state.good}</b> 已記起</span>`:`<span><i class="number-dot good"></i><b>${Math.min(state.quickSeen,total)}</b> 已瀏覽</span><span>揭曉答案後直接下一張</span>`;
  if(!total){$('#flashcard').className='flashcard finished';$('#flashcard').innerHTML='<h2>呢個卡組未有內容</h2>';$('#answer-actions').innerHTML='';return;}
  if(state.index>=total){renderFinished();return;}
  const item=state.deck[state.index];
  const japanese=japaneseFor(item),reverse=state.direction==='zh-ja';
  const schoolMeaning=item.meaningZh||'（學校教材未提供中文意思）';
  const frontText=reverse?schoolMeaning:japanese;
  const frontReading=!reverse&&item.type==='vocabulary'&&item.kanji?`<p class="answer-reading" lang="ja">${escapeHtml(item.kana)}</p>`:'';
  const frontLabel=reverse?'中文意思':item.type==='grammar'?'文法句型':item.kanji?'漢字表記':'平假名／片假名';
  $('#flashcard').className=`flashcard${item.type==='grammar'?' grammar-card':''}${state.revealed?' is-flipped':''}`;
  $('#flashcard').setAttribute('aria-label',state.revealed?'答案已顯示':'溫習卡，按下顯示答案');
  $('#flashcard').innerHTML=`<div class="card-inner"><section class="card-face card-front"><div class="card-topline"><span class="type-badge">${escapeHtml(labelFor(item))}</span><span>${state.index+1} / ${total}</span></div>${speakerButton()}<div class="card-content"><p class="face-label">${frontLabel}</p><h2 lang="${reverse?'zh-HK':'ja'}">${escapeHtml(frontText)}</h2>${frontReading}<p class="flip-hint">↻ 點擊翻面查看答案</p></div></section><section class="card-face card-back"><div class="card-topline"><span class="back-badge">答案與內容</span><span>${state.index+1} / ${total}</span></div>${speakerButton()}<div class="card-content">${answerBackHtml(item,japanese,reverse)}<p class="flip-hint">↻ 點擊返回題目</p></div></section></div>`;
  bindSpeakButtons(japanese);
  renderAnswerActions(total);
}

function renderAnswerActions(total=state.deck.length){
  $('#answer-actions').innerHTML=state.revealed?(state.ratingEnabled?'<button class="rate-again" data-rate="again">唔記得</button><button class="rate-hard" data-rate="hard">有啲難</button><button class="rate-good" data-rate="good">記得了</button>':`<button class="previous-button" id="previous-button" ${state.index===0?'disabled':''}>← 上一張</button><button class="next-button" id="next-button">${state.index===total-1?'完成':'下一張 →'} <span>Space</span></button>`):'<button class="reveal-button" id="reveal-button">翻轉睇答案 <span>Space</span></button>';
  if(state.revealed&&state.ratingEnabled)$$('[data-rate]').forEach(button=>button.addEventListener('click',()=>rateCard(button.dataset.rate)));
  else if(state.revealed){$('#previous-button').addEventListener('click',previousQuickCard);$('#next-button').addEventListener('click',nextQuickCard);}
  else $('#reveal-button').addEventListener('click',revealCard);
}

function previousQuickCard(){if(state.index===0)return;state.index--;state.revealed=false;renderCard();}
function nextQuickCard(){
  state.quickSeen=Math.max(state.quickSeen,state.index+1);incrementToday();state.index++;state.revealed=false;
  renderCard();
}

function answerBackHtml(item,japanese,reverse){
  const reading=item.type==='vocabulary'&&item.kanji?`<p class="answer-reading" lang="ja">${escapeHtml(item.kana)}</p>`:'';
  const explanation=item.explanationZh||item.notes||'';
  const firstExample=item.examples?.[0];
  const category=item.type==='grammar'?'文法':item.category||'生字';
  const answerLabel=reverse?'日文答案':'中文意思';
  const schoolMeaning=item.meaningZh||'（學校教材未提供中文意思）';
  const main=reverse
    ?`<p class="face-label">${answerLabel}</p><h2 lang="ja" class="back-main">${escapeHtml(japanese)}</h2>${reading}`
    :`<p class="face-label">${answerLabel}</p><h2 class="back-main" lang="zh-HK">${escapeHtml(schoolMeaning)}</h2><div class="back-term"><b lang="ja">${escapeHtml(japanese)}</b>${reading}</div>`;
  return `${main}<span class="back-category">${escapeHtml(category)}</span>${explanation?`<p class="answer-explain">${escapeHtml(explanation)}</p>`:''}${firstExample?`<div class="answer-example"><span lang="ja">${escapeHtml(firstExample.ja)}</span><small>${escapeHtml(firstExample.zh)}</small></div>`:''}`;
}

function speakerButton(){return '<button class="speak-button" data-speak type="button" aria-label="播放日文發音" title="播放日文發音"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zm-2.5-8.7v2.06a7 7 0 0 1 0 13.28v2.06a9 9 0 0 0 0-17.4z"/></svg></button>';}
function bindSpeakButtons(text){$$('#flashcard [data-speak]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();speakJapanese(text);}));}
function speakJapanese(text){
  if('speechSynthesis'in window){window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='ja-JP';utterance.rate=.86;const voice=window.speechSynthesis.getVoices().find(item=>item.lang.toLowerCase().startsWith('ja'));if(voice)utterance.voice=voice;window.speechSynthesis.speak(utterance);return;}
  if(fallbackAudio)fallbackAudio.pause();fallbackAudio=new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(text)}`);fallbackAudio.play().catch(()=>showToast('語音暫時播放唔到，請稍後再試。'));
}
function revealCard(){if(state.revealed||state.index>=state.deck.length)return;state.revealed=true;$('#flashcard').classList.add('is-flipped');$('#flashcard').setAttribute('aria-label','答案已顯示');renderAnswerActions();}
function hideAnswer(){if(!state.revealed)return;state.revealed=false;$('#flashcard').classList.remove('is-flipped');$('#flashcard').setAttribute('aria-label','溫習卡，按下顯示答案');renderAnswerActions();}
function rateCard(rating){
  const item=state.deck[state.index];
  if(rating==='again'){state.again++;state.deck.push(item);}else{state.good++;if(rating==='good')saveMastered(item.id);}
  incrementToday();state.index++;state.revealed=false;renderCard();
}
function renderFinished(){
  $('#progress-fill').style.width='100%';$('#flashcard').className='flashcard finished';
  $('#flashcard').innerHTML=`<div class="finished-mark">✓</div><p class="eyebrow">SESSION COMPLETE</p><h2>今次溫習完成。</h2><p>${state.ratingEnabled?`${state.good} 張已記起${state.again?`，${state.again} 張已經再溫過。`:'。做得好。'}`:`已經快速睇完 ${state.deck.length} 張卡片。`}</p>`;
  $('#answer-actions').innerHTML='<button class="reveal-button" id="restart-button">再溫一次</button>';
  $('#restart-button').addEventListener('click',()=>resetDeck());
}

function masteredIds(){try{return new Set(JSON.parse(localStorage.getItem('jp-study-mastered')||'[]'));}catch{return new Set();}}
function saveMastered(id){const ids=masteredIds();ids.add(id);localStorage.setItem('jp-study-mastered',JSON.stringify([...ids]));}
function localDateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function incrementToday(){const key=localDateKey(),saved=JSON.parse(localStorage.getItem('jp-study-today')||'{}');saved[key]=(saved[key]||0)+1;localStorage.setItem('jp-study-today',JSON.stringify(saved));updateToday();}
function updateToday(){const key=localDateKey(),saved=JSON.parse(localStorage.getItem('jp-study-today')||'{}');$('#today-count').textContent=`${saved[key]||0} 張`;}
function normalizeSearch(value){return String(value??'').normalize('NFKC').toLocaleLowerCase();}
function searchableText(item){
  const examples=Array.isArray(item.examples)?item.examples.flatMap(example=>[example?.ja,example?.zh]):[];
  const notes=Array.isArray(item.notes)?item.notes:[item.notes];
  const supplementary=item.supplementary&&typeof item.supplementary==='object'?Object.values(item.supplementary):[];
  return normalizeSearch([item.kana,item.kanji,item.meaningZh,item.pattern,item.explanationZh,item.sourceText,...notes,...supplementary,item.category,...examples,item.book,item.schoolYear,item.lesson].filter(value=>value!==undefined&&value!==null).join(' '));
}

function sortedUnique(values){return [...new Set(values)].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));}
function readJsonStorage(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function initialiseFilters(){
  const years=sortedUnique(state.all.map(item=>item.schoolYear));
  const savedYear=Number(localStorage.getItem('jp-study-deck-year'));
  state.year=years.includes(savedYear)?savedYear:years[0];
  populateYearSelect(years);
  populateLessonSelect(Number(localStorage.getItem('jp-study-deck-lesson')));
  const saved=readJsonStorage('jp-study-library-filters',{});
  const valid={years:new Set(years.map(String)),lessons:new Set(sortedUnique(state.all.map(item=>item.lesson)).map(String)),types:new Set(sortedUnique(state.all.map(item=>item.type)))};
  state.library.query=typeof saved.query==='string'?saved.query:'';
  for(const key of ['years','lessons','types'])state.library[key]=Array.isArray(saved[key])?saved[key].map(String).filter(value=>valid[key].has(value)):[];
  $('#search-input').value=state.library.query;
  populateLibraryFilter('years',years.map(value=>({value:String(value),label:`Year ${value}`})));
  refreshLibraryLessonFilter();
  populateLibraryFilter('types',[{value:'vocabulary',label:'生字 Vocabulary'},{value:'grammar',label:'文法 Grammar'}].filter(option=>valid.types.has(option.value)));
  updateLibraryFilterControls();
  saveLibraryFilters();
}
function populateYearSelect(years){$('#year-select').innerHTML=years.map(year=>`<option value="${year}">Year ${year}</option>`).join('');$('#year-select').value=String(state.year);}
function populateLessonSelect(preferred){
  const lessons=sortedUnique(state.all.filter(item=>item.schoolYear===state.year).map(item=>item.lesson));
  state.lesson=lessons.includes(preferred)?preferred:lessons[0];
  $('#lesson-select').innerHTML=lessons.map(lesson=>`<option value="${lesson}">Lesson ${String(lesson).padStart(2,'0')}</option>`).join('');
  $('#lesson-select').value=String(state.lesson);
  localStorage.setItem('jp-study-deck-year',String(state.year));localStorage.setItem('jp-study-deck-lesson',String(state.lesson));
}
function populateLibraryFilter(key,options){
  const container=$(`[data-library-filter="${key}"] .filter-options`);
  container.innerHTML=options.map(option=>`<label><input type="checkbox" value="${escapeHtml(option.value)}" ${state.library[key].includes(option.value)?'checked':''}><span>${escapeHtml(option.label)}</span></label>`).join('');
}
function refreshLibraryLessonFilter(){
  const available=sortedUnique(state.all.filter(item=>!state.library.years.length||state.library.years.includes(String(item.schoolYear))).map(item=>item.lesson));
  const valid=new Set(available.map(String));
  state.library.lessons=state.library.lessons.filter(value=>valid.has(value));
  populateLibraryFilter('lessons',available.map(value=>({value:String(value),label:`Lesson ${String(value).padStart(2,'0')}`})));
}
function saveLibraryFilters(){localStorage.setItem('jp-study-library-filters',JSON.stringify(state.library));}
function updateLibraryFilterControls(){
  for(const key of ['years','lessons','types']){
    const root=$(`[data-library-filter="${key}"]`),count=state.library[key].length,badge=root.querySelector('b');
    const trigger=root.querySelector('.filter-trigger'),label=trigger.querySelector('span').textContent;
    badge.textContent=String(count);badge.hidden=!count;trigger.classList.toggle('active',Boolean(count));trigger.setAttribute('aria-label',count?`${label}，已選 ${count} 項`: `${label}，全部`);
  }
  $('#clear-filters').hidden=!state.library.query&&!['years','lessons','types'].some(key=>state.library[key].length);
}
function closeFilterMenus(except=null){$$('.library-filter').forEach(root=>{if(root===except)return;root.querySelector('.filter-menu').hidden=true;root.querySelector('.filter-trigger').setAttribute('aria-expanded','false');});}
function clearLibraryFilter(key){state.library[key]=[];$(`[data-library-filter="${key}"]`).querySelectorAll('input').forEach(input=>input.checked=false);if(key==='years')refreshLibraryLessonFilter();updateLibraryFilterControls();saveLibraryFilters();renderLibrary();}

function renderLibrary(){
  const query=normalizeSearch(state.library.query.trim()),mastered=masteredIds();
  const items=state.all.filter(item=>(!state.library.years.length||state.library.years.includes(String(item.schoolYear)))&&(!state.library.lessons.length||state.library.lessons.includes(String(item.lesson)))&&(!state.library.types.length||state.library.types.includes(item.type))&&(!query||searchableText(item).includes(query)));
  $('#result-count').textContent=`${items.length} 項內容`;
  const activeCount=['years','lessons','types'].filter(key=>state.library[key].length).length+(query?1:0);$('.result-summary span').textContent=activeCount?`已套用 ${activeCount} 組條件`:`全部 ${state.all.length} 項內容`;
  $('#library-grid').innerHTML=items.length?items.map(item=>{const japanese=japaneseFor(item);return `<article class="library-card"><div class="library-card-top"><span class="type-badge">${escapeHtml(labelFor(item))}</span><button class="library-speak" data-library-speak="${escapeHtml(item.id)}" aria-label="播放 ${escapeHtml(japanese)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zm-2.5-8.7v2.06a7 7 0 0 1 0 13.28v2.06a9 9 0 0 0 0-17.4z"/></svg></button><span class="${mastered.has(item.id)?'mastered-chip':''}">${mastered.has(item.id)?'✓ 已記起':`Year ${item.schoolYear} · Lesson ${String(item.lesson).padStart(2,'0')}`}</span></div><h2 lang="ja">${escapeHtml(japanese)}</h2>${item.kanji?`<div class="library-reading" lang="ja">${escapeHtml(item.kana)}</div>`:''}${item.meaningZh?`<div class="library-meaning">${escapeHtml(item.meaningZh)}</div>`:''}${item.explanationZh?`<p class="library-explain">${escapeHtml(item.explanationZh)}</p>`:''}</article>`;}).join(''):'<div class="empty-state"><b>搵唔到相符內容</b><br>試吓其他日文、假名、中文關鍵字或者篩選條件。</div>';
  $$('[data-library-speak]').forEach(button=>button.addEventListener('click',()=>{const item=state.all.find(entry=>entry.id===button.dataset.librarySpeak);if(item)speakJapanese(japaneseFor(item));}));
}

function switchView(view){
  state.view=view;$$('.view').forEach(panel=>panel.classList.toggle('active',panel.id===`${view}-view`));$$('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view===view));
  $('.sidebar').classList.remove('open');$('#menu-button').setAttribute('aria-expanded','false');if(view==='library')renderLibrary();if(view==='conjugation')loadConjugation();
}

const conjugationState={forms:[],verbs:[],keigo:null,formId:'dictionary',section:'basic',group:'ALL',query:'',revealed:false,loaded:false};
async function loadConjugation(){
  if(conjugationState.loaded)return;
  try{
    const [forms,verbs,keigo]=await Promise.all(['./data/conjugation/forms.json','./data/conjugation/verbs.json','./data/conjugation/keigo.json'].map(async path=>{const r=await fetch(path,{cache:'no-cache'});if(!r.ok)throw new Error(path);return r.json();}));
    conjugationState.forms=forms;conjugationState.verbs=verbs;conjugationState.keigo=keigo;conjugationState.loaded=true;renderConjugation();
  }catch(error){$('#conjugation-rule-card').textContent='詞形資料暫時載入唔到。';console.error(error);}
}
function selectedConjugation(){return conjugationState.forms.find(form=>form.id===conjugationState.formId);}
function renderConjugation(){
  const form=selectedConjugation();if(!form)return;
  $('#conjugation-basic').hidden=conjugationState.section!=='basic';$('#conjugation-reference').hidden=conjugationState.section==='basic';$$('[data-conjugation-section]').forEach(button=>button.classList.toggle('active',button.dataset.conjugationSection===conjugationState.section));
  if(conjugationState.section!=='basic'){renderConjugationReference();return;}
  $('#conjugation-selector').innerHTML=conjugationState.forms.map(item=>`<button class="${item.id===form.id?'active':''}" data-conjugation-form="${item.id}"><b lang="ja">${item.japaneseName}</b><small>第${item.lesson}課</small></button>`).join('');
  $('#conjugation-rule-card').innerHTML=`<div><p class="eyebrow">大家的日本語 · 第${form.lesson}課</p><h2 lang="ja">${form.japaneseName}</h2><p>${form.description}</p></div><div class="conjugation-rules">${form.rules.map(rule=>`<section><b>${rule[0]}</b><span>${rule[1]}</span><em lang="ja">${rule[2]}</em></section>`).join('')}</div>${form.relatedNote?`<p class="related-note">${form.relatedNote}</p>`:''}<small class="source-note">來源：${form.sourceFile}</small>`;
  $('#conjugation-answer-toggle').textContent=conjugationState.revealed?'🙈 隱藏答案':'👀 顯示答案';
  const query=normalizeSearch(conjugationState.query);
  const verbs=conjugationState.verbs.filter(verb=>{const values=[...verb.masu,...Object.values(verb.forms).flat(),verb.meaning,verb.group].join(' ');return (conjugationState.group==='ALL'||verb.group===conjugationState.group)&&(!query||normalizeSearch(values).includes(query));});
  $('#conjugation-summary').textContent=`${verbs.length} 個例子 · ${conjugationState.revealed?'答案已顯示':'先諗答案，再揭曉'}`;
  $('#conjugation-list').innerHTML=verbs.length?verbs.map(verb=>{const answer=verb.forms[form.id],negative=verb.forms.conditionalNegative;const result=form.id==='conditional'?`<div class="conjugation-answer ${conjugationState.revealed?'revealed':''}"><small>肯定</small><h2 lang="ja">${conjugationState.revealed?answer[0]:'？'}</h2><p lang="ja">${conjugationState.revealed?answer[1]:'答えを隠しています'}</p></div><div class="conjugation-answer ${conjugationState.revealed?'revealed':''}"><small>否定</small><h2 lang="ja">${conjugationState.revealed?negative[0]:'？'}</h2><p lang="ja">${conjugationState.revealed?negative[1]:'答えを隠しています'}</p></div>`:`<div class="conjugation-answer ${conjugationState.revealed?'revealed':''}"><h2 lang="ja">${conjugationState.revealed?answer[0]:'？'}</h2><p lang="ja">${conjugationState.revealed?answer[1]:'答えを隠しています'}</p></div>`;return `<article class="conjugation-verb ${form.id==='conditional'?'conditional-verb':''}"><div><span class="type-badge">${verb.group}組</span><h2 lang="ja">${verb.masu[0]}</h2><p lang="ja">${verb.masu[1]}</p><small>${verb.meaning}</small></div><div class="conjugation-arrow">→</div><div class="conjugation-results">${result}</div></article>`;}).join(''):'<div class="empty-state"><b>搵唔到相符動詞</b><br>試吓日文、假名、ます形、辭書形或英文意思。</div>';
  $$('[data-conjugation-form]').forEach(button=>button.addEventListener('click',()=>{conjugationState.formId=button.dataset.conjugationForm;renderConjugation();}));
}
function politeForms(verb){const [kanji,kana]=verb.masu;return {present:[kanji,kana],past:[kanji.replace('ます','ました'),kana.replace('ます','ました')],negative:[kanji.replace('ます','ません'),kana.replace('ます','ません')],negativePast:[kanji.replace('ます','ませんでした'),kana.replace('ます','ませんでした')]};}
function renderConjugationReference(){
  const root=$('#conjugation-reference');
  if(conjugationState.section==='plain'){const verb=conjugationState.verbs.find(item=>item.id==='go');const polite=politeForms(verb),f=verb.forms;root.innerHTML=`<article class="plain-card"><p class="eyebrow">大家的日本語 · 第20課</p><h2>普通形整理</h2><p>普通形は四つの組み合わせで整理します。辞書形・ない形・た形は、この表の一部です。</p><div class="plain-grid"><div></div><b>非過去</b><b>過去</b><b>肯定</b><section><small>丁寧形</small><strong>${polite.present[0]}</strong><small>普通形</small><strong>${f.dictionary[0]}</strong></section><section><small>丁寧形</small><strong>${polite.past[0]}</strong><small>普通形</small><strong>${f.ta[0]}</strong></section><b>否定</b><section><small>丁寧形</small><strong>${polite.negative[0]}</strong><small>普通形</small><strong>${f.nai[0]}</strong></section><section><small>丁寧形</small><strong>${polite.negativePast[0]}</strong><small>普通形</small><strong>${f.nakatta[0]}</strong></section></div><small class="source-note">來源：g_1_20.pdf</small></article>`;return;}
  const renderKeigo=(type,label,description)=>{const data=conjugationState.keigo[type];return `<section class="keigo-group"><div class="keigo-heading"><p class="eyebrow">ADVANCED REFERENCE · 大家的日本語 · 第${data.lesson}課</p><h2>${label}</h2><p>${description}</p></div><div class="keigo-cards">${data.cards.map(card=>`<article><h3>${card.title}</h3><p class="keigo-pattern" lang="ja">${card.pattern}</p><p>${card.note}</p><ul>${card.examples.map(example=>`<li lang="ja">${example}</li>`).join('')}</ul></article>`).join('')}</div><small class="source-note">來源：${data.sourceFile}</small></section>`;};root.innerHTML=renderKeigo('honorific','尊敬語','動作の主体に敬意を表す表現。')+renderKeigo('humble','謙譲語','自分の動作をへりくだって表す表現。');
}
$('#conjugation-search').addEventListener('input',event=>{conjugationState.query=event.target.value;renderConjugation();});
$$('[data-conjugation-group]').forEach(button=>button.addEventListener('click',()=>{conjugationState.group=button.dataset.conjugationGroup;$$('[data-conjugation-group]').forEach(item=>item.classList.toggle('active',item===button));renderConjugation();}));
$('#conjugation-answer-toggle').addEventListener('click',()=>{conjugationState.revealed=!conjugationState.revealed;renderConjugation();});
$$('[data-conjugation-section]').forEach(button=>button.addEventListener('click',()=>{conjugationState.section=button.dataset.conjugationSection;renderConjugation();}));
function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),1800);}
function applyTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem('jp-study-theme',theme);const dark=theme==='dark';$('#theme-icon').textContent=dark?'☀':'☾';$('#theme-toggle').setAttribute('aria-label',dark?'切換至日間模式':'切換至夜間模式');document.querySelector('meta[name="theme-color"]').content=dark?'#030712':'#f8fafc';}

$$('.nav-item').forEach(item=>item.addEventListener('click',()=>switchView(item.dataset.view)));
$('#menu-button').addEventListener('click',()=>{const open=$('.sidebar').classList.toggle('open');$('#menu-button').setAttribute('aria-expanded',String(open));});
$('#theme-toggle').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('#deck-type').addEventListener('change',event=>{state.type=event.target.value;resetDeck();});
$('#year-select').addEventListener('change',event=>{state.year=Number(event.target.value);populateLessonSelect(null);resetDeck();});
$('#lesson-select').addEventListener('change',event=>{state.lesson=Number(event.target.value);localStorage.setItem('jp-study-deck-lesson',String(state.lesson));resetDeck();});
$('#rating-options').addEventListener('change',event=>{state.ratingEnabled=event.target.checked;localStorage.setItem('jp-study-rating-options',String(state.ratingEnabled));resetDeck();showToast(state.ratingEnabled?'已開啟熟悉度評分':'已關閉熟悉度評分');});
$('#card-direction').addEventListener('change',event=>{state.direction=event.target.value;resetDeck();});
$('#shuffle-button').addEventListener('click',()=>{resetDeck(true);showToast('卡片已經洗牌');});
$('#flashcard').addEventListener('click',()=>state.revealed?hideAnswer():revealCard());
$('#flashcard').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();state.revealed?hideAnswer():revealCard();}});
$('#search-input').addEventListener('input',event=>{state.library.query=event.target.value;updateLibraryFilterControls();saveLibraryFilters();renderLibrary();});
$$('.library-filter').forEach(root=>{
  const trigger=root.querySelector('.filter-trigger'),menu=root.querySelector('.filter-menu'),key=root.dataset.libraryFilter;
  trigger.addEventListener('click',()=>{const opening=menu.hidden;closeFilterMenus(root);menu.hidden=!opening;trigger.setAttribute('aria-expanded',String(opening));if(opening)menu.querySelector('input,button')?.focus();});
  root.querySelector('.filter-all').addEventListener('click',()=>clearLibraryFilter(key));
  root.querySelector('.filter-options').addEventListener('change',()=>{state.library[key]=[...root.querySelectorAll('input:checked')].map(input=>input.value);if(key==='years')refreshLibraryLessonFilter();updateLibraryFilterControls();saveLibraryFilters();renderLibrary();});
});
$('#clear-filters').addEventListener('click',()=>{state.library={query:'',years:[],lessons:[],types:[]};$('#search-input').value='';$$('.library-filter input').forEach(input=>input.checked=false);refreshLibraryLessonFilter();updateLibraryFilterControls();saveLibraryFilters();renderLibrary();});
document.addEventListener('click',event=>{if(!event.target.closest('.library-filter'))closeFilterMenus();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=$('.library-filter .filter-menu:not([hidden])');if(open){const root=open.closest('.library-filter');closeFilterMenus();root.querySelector('.filter-trigger').focus();}}});
document.addEventListener('keydown',event=>{if(state.view!=='review'||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(!state.ratingEnabled){if(!state.revealed&&event.code==='Space'){event.preventDefault();revealCard();}else if(state.revealed&&(event.code==='Space'||event.key==='ArrowRight')){event.preventDefault();nextQuickCard();}else if(event.key==='ArrowLeft'){event.preventDefault();previousQuickCard();}return;}if(event.code==='Space'&&!state.revealed){event.preventDefault();revealCard();}if(state.revealed&&['1','2','3'].includes(event.key))rateCard({1:'again',2:'hard',3:'good'}[event.key]);});
applyTheme(document.documentElement.dataset.theme||'light');updateToday();loadData();
