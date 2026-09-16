export const REVIEW_FILTERS=['all','incorrect','correct','bookmarked'];
export const REVIEW_STORAGE_VERSION=1;

export function reviewKeyFor(item){
  if(item?.id)return String(item.id);
  return [item?.schoolYear,item?.book,item?.lesson,item?.type,item?.kana||item?.pattern||item?.kanji].map(value=>String(value??'')).join('::');
}

export function normalizeReviewProgress(value){
  const cards=value&&typeof value==='object'&&!Array.isArray(value)&&value.cards&&typeof value.cards==='object'&&!Array.isArray(value.cards)?value.cards:{};
  const normalized={};
  for(const [key,record] of Object.entries(cards)){
    if(!record||typeof record!=='object'||Array.isArray(record))continue;
    const status=['correct','incorrect'].includes(record.status)?record.status:null;
    const bookmarked=record.bookmarked===true;
    if(status||bookmarked)normalized[key]={...(status?{status}:{}),...(bookmarked?{bookmarked:true}:{}),...(typeof record.lastReviewed==='string'?{lastReviewed:record.lastReviewed}:{})};
  }
  return {version:REVIEW_STORAGE_VERSION,cards:normalized};
}

export function reviewRecordFor(progress,item){return progress.cards[reviewKeyFor(item)]||{};}

export function setReviewStatus(progress,item,status,timestamp=new Date().toISOString()){
  if(!['correct','incorrect'].includes(status))throw new Error('Review status must be correct or incorrect');
  const key=reviewKeyFor(item),previous=reviewRecordFor(progress,item);
  return {version:REVIEW_STORAGE_VERSION,cards:{...progress.cards,[key]:{...previous,status,lastReviewed:timestamp}}};
}

export function toggleReviewBookmark(progress,item,timestamp=new Date().toISOString()){
  const key=reviewKeyFor(item),previous=reviewRecordFor(progress,item),bookmarked=!previous.bookmarked;
  const next={...previous,...(bookmarked?{bookmarked:true}:{}),lastReviewed:timestamp};
  if(!bookmarked)delete next.bookmarked;
  return {version:REVIEW_STORAGE_VERSION,cards:{...progress.cards,[key]:next}};
}

export function filterReviewDeck(items,progress,filter='all'){
  if(!REVIEW_FILTERS.includes(filter))return [...items];
  return items.filter(item=>{
    const record=reviewRecordFor(progress,item);
    if(filter==='all')return true;
    if(filter==='bookmarked')return record.bookmarked===true;
    return record.status===filter;
  });
}

export function reviewCounts(items,progress){
  return items.reduce((counts,item)=>{
    const record=reviewRecordFor(progress,item);
    counts.all++;
    if(record.status==='incorrect')counts.incorrect++;
    if(record.status==='correct')counts.correct++;
    if(record.bookmarked)counts.bookmarked++;
    return counts;
  },{all:0,incorrect:0,correct:0,bookmarked:0});
}

export function resetReviewStatuses(progress,items){
  const keys=new Set(items.map(reviewKeyFor)),cards={};
  for(const [key,record] of Object.entries(progress.cards)){
    if(!keys.has(key)){cards[key]=record;continue;}
    if(record.bookmarked)cards[key]={bookmarked:true,...(record.lastReviewed?{lastReviewed:record.lastReviewed}:{})};
  }
  return {version:REVIEW_STORAGE_VERSION,cards};
}

export function shuffledSequence(items,random=Math.random){
  const sequence=[...items];
  for(let index=sequence.length-1;index>0;index--){
    const target=Math.floor(random()*(index+1));
    [sequence[index],sequence[target]]=[sequence[target],sequence[index]];
  }
  if(sequence.length>1&&sequence.every((item,index)=>reviewKeyFor(item)===reviewKeyFor(items[index])))[sequence[0],sequence[1]]=[sequence[1],sequence[0]];
  return sequence;
}
