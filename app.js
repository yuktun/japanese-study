const state={all:[],deck:[],index:0,revealed:false,again:0,good:0,type:'all',direction:'ja-zh',view:'review'};
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
    resetDeck();renderLibrary();
  }catch(error){
    $('#card-content').innerHTML='<p class="card-prompt">資料暫時載入唔到</p><h2 style="font-size:1.5rem">請重新整理頁面</h2>';
    $('#answer-actions').innerHTML='';
    showToast('教材載入失敗，請稍後再試。');
  }
}

function currentPool(){return state.type==='all'?state.all:state.all.filter(item=>item.type===state.type);}
function labelFor(item){return item.type==='grammar'?'文法 Grammar':`生字 · ${item.category||'Vocabulary'}`;}
function japaneseFor(item){return item.pattern||item.kanji||item.kana;}

function resetDeck(shuffle=false){
  state.deck=[...currentPool()];
  if(shuffle){for(let i=state.deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[state.deck[i],state.deck[j]]=[state.deck[j],state.deck[i]];}}
  state.index=0;state.revealed=false;state.again=0;state.good=0;
  renderCard();
}

function renderCard(){
  const total=state.deck.length;
  $('#deck-total').textContent=`${total} 張`;
  $('#card-position').textContent=state.index<total?`Card ${state.index+1} of ${total}`:'Session complete';
  $('#session-type').textContent=state.type==='all'?'Mixed review':state.type==='grammar'?'Grammar':'Vocabulary';
  $('#progress-fill').style.width=`${total?Math.min(state.index/total*100,100):0}%`;
  $('#again-count').textContent=state.again;$('#good-count').textContent=state.good;
  if(!total){$('#flashcard').className='flashcard finished';$('#flashcard').innerHTML='<h2>呢個卡組未有內容</h2>';$('#answer-actions').innerHTML='';return;}
  if(state.index>=total){renderFinished();return;}
  const item=state.deck[state.index];
  const japanese=japaneseFor(item),reverse=state.direction==='zh-ja';
  $('#flashcard').className='flashcard';
  $('#flashcard').setAttribute('aria-label',state.revealed?'答案已顯示':'溫習卡，按下顯示答案');
  $('#flashcard').innerHTML=`<div class="card-topline"><span class="type-badge">${escapeHtml(labelFor(item))}</span><span>初級 I · Lesson 01</span></div><div class="card-content"><p class="card-prompt">${state.revealed?'答案':reverse?'呢句中文，日文點講？':'仲記唔記得佢嘅意思？'}</p>${state.revealed?answerHtml(item,japanese):`<h2 lang="${reverse?'zh-HK':'ja'}">${escapeHtml(reverse?item.meaningZh:japanese)}</h2><p class="tap-hint">點擊卡片顯示答案</p>`}</div>`;
  $('#answer-actions').innerHTML=state.revealed?'<button class="rate-again" data-rate="again">唔記得</button><button class="rate-hard" data-rate="hard">有啲難</button><button class="rate-good" data-rate="good">記得了</button>':'<button class="reveal-button" id="reveal-button">顯示答案 <span>Space</span></button>';
  if(state.revealed)$$('[data-rate]').forEach(button=>button.addEventListener('click',()=>rateCard(button.dataset.rate)));
  else $('#reveal-button').addEventListener('click',revealCard);
}

function answerHtml(item,japanese){
  const reading=item.type==='vocabulary'&&item.kanji?`<p class="answer-reading" lang="ja">${escapeHtml(item.kana)}</p>`:'';
  const explanation=item.explanationZh||item.notes||'';
  const firstExample=item.examples?.[0];
  return `<h2 lang="ja" style="font-size:${item.type==='grammar'?'2.1rem':'2.8rem'}">${escapeHtml(japanese)}</h2>${reading}<p class="answer-meaning">${escapeHtml(item.meaningZh)}</p>${explanation?`<p class="answer-explain">${escapeHtml(explanation)}</p>`:''}${firstExample?`<div class="answer-example"><span lang="ja">${escapeHtml(firstExample.ja)}</span><small>${escapeHtml(firstExample.zh)}</small></div>`:''}`;
}

function revealCard(){if(state.revealed||state.index>=state.deck.length)return;state.revealed=true;renderCard();}
function rateCard(rating){
  const item=state.deck[state.index];
  if(rating==='again'){state.again++;state.deck.push(item);}else{state.good++;if(rating==='good')saveMastered(item.id);}
  incrementToday();state.index++;state.revealed=false;renderCard();
}
function renderFinished(){
  $('#progress-fill').style.width='100%';$('#flashcard').className='flashcard finished';
  $('#flashcard').innerHTML=`<div class="finished-mark">✓</div><p class="eyebrow">SESSION COMPLETE</p><h2>今次溫習完成。</h2><p>${state.good} 張已記起${state.again?`，${state.again} 張已經再溫過。`:'。做得好。'}</p>`;
  $('#answer-actions').innerHTML='<button class="reveal-button" id="restart-button">再溫一次</button>';
  $('#restart-button').addEventListener('click',()=>resetDeck());
}

function masteredIds(){try{return new Set(JSON.parse(localStorage.getItem('jp-study-mastered')||'[]'));}catch{return new Set();}}
function saveMastered(id){const ids=masteredIds();ids.add(id);localStorage.setItem('jp-study-mastered',JSON.stringify([...ids]));}
function incrementToday(){const key=new Date().toISOString().slice(0,10),saved=JSON.parse(localStorage.getItem('jp-study-today')||'{}');saved[key]=(saved[key]||0)+1;localStorage.setItem('jp-study-today',JSON.stringify(saved));updateToday();}
function updateToday(){const key=new Date().toISOString().slice(0,10),saved=JSON.parse(localStorage.getItem('jp-study-today')||'{}');$('#today-count').textContent=`${saved[key]||0} 張`;}

function renderLibrary(){
  const query=$('#search-input').value.trim().toLowerCase(),type=$('#library-type').value,mastered=masteredIds();
  const items=state.all.filter(item=>(type==='all'||item.type===type)&&(!query||Object.values(item).flat(Infinity).join(' ').toLowerCase().includes(query)));
  $('#result-count').textContent=`${items.length} 項內容`;
  $('#library-grid').innerHTML=items.length?items.map(item=>{const japanese=japaneseFor(item);return `<article class="library-card"><div class="library-card-top"><span class="type-badge">${escapeHtml(labelFor(item))}</span><span class="${mastered.has(item.id)?'mastered-chip':''}">${mastered.has(item.id)?'✓ 已記起':'Lesson 01'}</span></div><h2 lang="ja">${escapeHtml(japanese)}</h2>${item.kanji?`<div class="library-reading" lang="ja">${escapeHtml(item.kana)}</div>`:''}<div class="library-meaning">${escapeHtml(item.meaningZh)}</div>${item.explanationZh?`<p class="library-explain">${escapeHtml(item.explanationZh)}</p>`:''}</article>`;}).join(''):'<div class="empty-state"><b>搵唔到相符內容</b><br>試吓其他日文、假名或者中文關鍵字。</div>';
}

function switchView(view){
  state.view=view;$$('.view').forEach(panel=>panel.classList.toggle('active',panel.id===`${view}-view`));$$('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view===view));
  $('.sidebar').classList.remove('open');$('#menu-button').setAttribute('aria-expanded','false');if(view==='library')renderLibrary();
}
function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),1800);}

$$('.nav-item').forEach(item=>item.addEventListener('click',()=>switchView(item.dataset.view)));
$('#menu-button').addEventListener('click',()=>{const open=$('.sidebar').classList.toggle('open');$('#menu-button').setAttribute('aria-expanded',String(open));});
$('#deck-type').addEventListener('change',event=>{state.type=event.target.value;resetDeck();});
$('#card-direction').addEventListener('change',event=>{state.direction=event.target.value;resetDeck();});
$('#shuffle-button').addEventListener('click',()=>{resetDeck(true);showToast('卡片已經洗牌');});
$('#flashcard').addEventListener('click',()=>{if(!state.revealed)revealCard();});
$('#flashcard').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!state.revealed){event.preventDefault();revealCard();}});
$('#search-input').addEventListener('input',renderLibrary);$('#library-type').addEventListener('change',renderLibrary);
document.addEventListener('keydown',event=>{if(state.view!=='review'||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(event.code==='Space'&&!state.revealed){event.preventDefault();revealCard();}if(state.revealed&&['1','2','3'].includes(event.key))rateCard({1:'again',2:'hard',3:'good'}[event.key]);});
updateToday();loadData();
