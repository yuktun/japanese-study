import {normalizeReviewProgress,REVIEW_STORAGE_VERSION} from './flashcard-review.mjs';

export const REVIEW_STORAGE_KEY='jp-study-flashcard-review-progress';
export const GUEST_PROGRESS_KEY='jp-study-guest-review-progress';
export const PROGRESS_SCHEMA_VERSION=1;

export function hasProgress(progress){return Object.keys(normalizeReviewProgress(progress).cards).length>0;}
export function cloneProgress(progress){return normalizeReviewProgress(JSON.parse(JSON.stringify(normalizeReviewProgress(progress))));}
export function timestamp(value){const time=Date.parse(value);return Number.isFinite(time)?time:null;}

// Status is last-write-wins only when both records have trustworthy timestamps.
// A bookmark is additive so a bookmark made on either device is never lost.
export function mergeProgress(localValue,cloudValue){
  const local=normalizeReviewProgress(localValue),cloud=normalizeReviewProgress(cloudValue);
  const cards={},conflicts=[];
  for(const key of new Set([...Object.keys(local.cards),...Object.keys(cloud.cards)])){
    const left=local.cards[key],right=cloud.cards[key];
    if(!left){cards[key]=right;continue;}
    if(!right){cards[key]=left;continue;}
    const leftTime=timestamp(left.lastReviewed),rightTime=timestamp(right.lastReviewed);
    let chosen=left;
    if(left.status!==right.status){
      if(leftTime!==null&&rightTime!==null&&leftTime!==rightTime)chosen=leftTime>rightTime?left:right;
      else conflicts.push(key); // caller must ask before accepting the local default.
    }else if(rightTime!==null&&(leftTime===null||rightTime>leftTime))chosen=right;
    const lastReviewed=chosen.lastReviewed||(leftTime!==null&&rightTime!==null?(leftTime>rightTime?left.lastReviewed:right.lastReviewed):left.lastReviewed||right.lastReviewed);
    cards[key]={...(chosen.status?{status:chosen.status}:{}),...(left.bookmarked||right.bookmarked?{bookmarked:true}:{}),...(lastReviewed?{lastReviewed}:{})};
  }
  return {progress:{version:REVIEW_STORAGE_VERSION,cards},conflicts};
}

export function firestoreRecord(cardId,record,updatedAt){
  return {schemaVersion:PROGRESS_SCHEMA_VERSION,cardId,status:record.status||null,bookmarked:record.bookmarked===true,lastReviewed:record.lastReviewed||null,updatedAt};
}

export function progressFromFirestore(records){
  const cards={};
  for(const record of records){
    if(!record||record.schemaVersion!==PROGRESS_SCHEMA_VERSION||typeof record.cardId!=='string')continue;
    const card={};
    if(['correct','incorrect'].includes(record.status))card.status=record.status;
    if(record.bookmarked===true)card.bookmarked=true;
    if(typeof record.lastReviewed==='string')card.lastReviewed=record.lastReviewed;
    if(card.status||card.bookmarked)cards[record.cardId]=card;
  }
  return {version:REVIEW_STORAGE_VERSION,cards};
}
