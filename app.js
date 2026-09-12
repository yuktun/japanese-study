const state={all:[],deck:[],index:0,revealed:false,again:0,good:0,quickSeen:0,type:'all',direction:'ja-zh',year:null,lesson:null,ratingEnabled:localStorage.getItem('jp-study-rating-options')==='true',view:'review',library:{query:'',years:[],lessons:[],types:[]}};
let fallbackAudio=null;
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

async function loadData(){
  try{
    const [vocabulary,grammar]=await Promise.all([
      fetch('./data/year1/lesson01/vocabulary.json').then(response=>{if(!response.ok)throw new Error('Vocabulary data');return response.json();}),
      fetch('./data/year1/lesson01/grammar.json').then(response=>{if(!response.ok)throw new Error('Grammar data');return response.json();})
    ]);
    state.all=[...vocabulary.map(item=>({...item,type:'vocabulary'})),...grammar.map(item=>({...item,type:'grammar'}))];
    initialiseFilters();resetDeck();renderLibrary();
  }catch(error){
    $('#card-content').innerHTML='<p class="card-prompt">資料暫時載入唔到</p><h2 style="font-size:1.5rem">請重新整理頁面</h2>';
    $('#answer-actions').innerHTML='';
    showToast('教材載入失敗，請稍後再試。');
  }
}

function currentPool(){return state.all.filter(item=>(state.type==='all'||item.type===state.type)&&item.schoolYear===state.year&&item.lesson===state.lesson);}
function labelFor(item){return item.type==='grammar'?'文法 Grammar':`生字 · ${item.category||'Vocabulary'}`;}
function japaneseFor(item){return item.pattern||item.kanji||item.kana;}

function resetDeck(shuffle=false){
  state.deck=[...currentPool()];
  if(shuffle){for(let i=state.deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[state.deck[i],state.deck[j]]=[state.deck[j],state.deck[i]];}}
  state.index=0;state.revealed=false;state.again=0;state.good=0;state.quickSeen=0;
  $('.crumb span').textContent=`Year ${state.year}`;$('.crumb b').textContent=`Lesson ${String(state.lesson).padStart(2,'0')}`;
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
  const frontText=reverse?item.meaningZh:japanese;
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
  const main=reverse
    ?`<p class="face-label">${answerLabel}</p><h2 lang="ja" class="back-main">${escapeHtml(japanese)}</h2>${reading}`
    :`<p class="face-label">${answerLabel}</p><h2 class="back-main" lang="zh-HK">${escapeHtml(item.meaningZh)}</h2><div class="back-term"><b lang="ja">${escapeHtml(japanese)}</b>${reading}</div>`;
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
function incrementToday(){const key=new Date().toISOString().slice(0,10),saved=JSON.parse(localStorage.getItem('jp-study-today')||'{}');saved[key]=(saved[key]||0)+1;localStorage.setItem('jp-study-today',JSON.stringify(saved));updateToday();}
function updateToday(){const key=new Date().toISOString().slice(0,10),saved=JSON.parse(localStorage.getItem('jp-study-today')||'{}');$('#today-count').textContent=`${saved[key]||0} 張`;}

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
  populateLibraryFilter('lessons',sortedUnique(state.all.map(item=>item.lesson)).map(value=>({value:String(value),label:`Lesson ${String(value).padStart(2,'0')}`})));
  populateLibraryFilter('types',[{value:'vocabulary',label:'生字 Vocabulary'},{value:'grammar',label:'文法 Grammar'}].filter(option=>valid.types.has(option.value)));
  updateLibraryFilterControls();
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
function clearLibraryFilter(key){state.library[key]=[];$(`[data-library-filter="${key}"]`).querySelectorAll('input').forEach(input=>input.checked=false);updateLibraryFilterControls();saveLibraryFilters();renderLibrary();}

function renderLibrary(){
  const query=state.library.query.trim().toLowerCase(),mastered=masteredIds();
  const items=state.all.filter(item=>(!state.library.years.length||state.library.years.includes(String(item.schoolYear)))&&(!state.library.lessons.length||state.library.lessons.includes(String(item.lesson)))&&(!state.library.types.length||state.library.types.includes(item.type))&&(!query||Object.values(item).flat(Infinity).join(' ').toLowerCase().includes(query)));
  $('#result-count').textContent=`${items.length} 項內容`;
  const activeCount=['years','lessons','types'].filter(key=>state.library[key].length).length+(query?1:0);$('.result-summary span').textContent=activeCount?`已套用 ${activeCount} 組條件`:`全部 ${state.all.length} 項內容`;
  $('#library-grid').innerHTML=items.length?items.map(item=>{const japanese=japaneseFor(item);return `<article class="library-card"><div class="library-card-top"><span class="type-badge">${escapeHtml(labelFor(item))}</span><button class="library-speak" data-library-speak="${escapeHtml(item.id)}" aria-label="播放 ${escapeHtml(japanese)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zm-2.5-8.7v2.06a7 7 0 0 1 0 13.28v2.06a9 9 0 0 0 0-17.4z"/></svg></button><span class="${mastered.has(item.id)?'mastered-chip':''}">${mastered.has(item.id)?'✓ 已記起':`Year ${item.schoolYear} · Lesson ${String(item.lesson).padStart(2,'0')}`}</span></div><h2 lang="ja">${escapeHtml(japanese)}</h2>${item.kanji?`<div class="library-reading" lang="ja">${escapeHtml(item.kana)}</div>`:''}<div class="library-meaning">${escapeHtml(item.meaningZh)}</div>${item.explanationZh?`<p class="library-explain">${escapeHtml(item.explanationZh)}</p>`:''}</article>`;}).join(''):'<div class="empty-state"><b>搵唔到相符內容</b><br>試吓其他日文、假名、中文關鍵字或者篩選條件。</div>';
  $$('[data-library-speak]').forEach(button=>button.addEventListener('click',()=>{const item=state.all.find(entry=>entry.id===button.dataset.librarySpeak);if(item)speakJapanese(japaneseFor(item));}));
}

function switchView(view){
  state.view=view;$$('.view').forEach(panel=>panel.classList.toggle('active',panel.id===`${view}-view`));$$('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view===view));
  $('.sidebar').classList.remove('open');$('#menu-button').setAttribute('aria-expanded','false');if(view==='library')renderLibrary();
}
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
  root.querySelector('.filter-options').addEventListener('change',()=>{state.library[key]=[...root.querySelectorAll('input:checked')].map(input=>input.value);updateLibraryFilterControls();saveLibraryFilters();renderLibrary();});
});
$('#clear-filters').addEventListener('click',()=>{state.library={query:'',years:[],lessons:[],types:[]};$('#search-input').value='';$$('.library-filter input').forEach(input=>input.checked=false);updateLibraryFilterControls();saveLibraryFilters();renderLibrary();});
document.addEventListener('click',event=>{if(!event.target.closest('.library-filter'))closeFilterMenus();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=$('.library-filter .filter-menu:not([hidden])');if(open){const root=open.closest('.library-filter');closeFilterMenus();root.querySelector('.filter-trigger').focus();}}});
document.addEventListener('keydown',event=>{if(state.view!=='review'||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(!state.ratingEnabled){if(!state.revealed&&event.code==='Space'){event.preventDefault();revealCard();}else if(state.revealed&&(event.code==='Space'||event.key==='ArrowRight')){event.preventDefault();nextQuickCard();}else if(event.key==='ArrowLeft'){event.preventDefault();previousQuickCard();}return;}if(event.code==='Space'&&!state.revealed){event.preventDefault();revealCard();}if(state.revealed&&['1','2','3'].includes(event.key))rateCard({1:'again',2:'hard',3:'good'}[event.key]);});
applyTheme(document.documentElement.dataset.theme||'light');updateToday();loadData();
