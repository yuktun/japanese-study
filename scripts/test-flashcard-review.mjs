import assert from 'node:assert/strict';
import {filterReviewDeck,normalizeReviewProgress,resetReviewStatuses,reviewCounts,reviewKeyFor,setReviewStatus,shuffledSequence,toggleReviewBookmark} from '../src/flashcard-review.mjs';

const lessonOne=[
  {id:'y1-l01-v001',schoolYear:1,book:'初級 I',lesson:1,type:'vocabulary'},
  {id:'y1-l01-v002',schoolYear:1,book:'初級 I',lesson:1,type:'vocabulary'},
  {id:'y1-l01-g001',schoolYear:1,book:'初級 I',lesson:1,type:'grammar'}
];
const lessonTwo=[{id:'y1-l02-v001',schoolYear:1,book:'初級 I',lesson:2,type:'vocabulary'}];

let progress=normalizeReviewProgress({});
progress=setReviewStatus(progress,lessonOne[0],'incorrect','2026-01-01T00:00:00.000Z');
progress=setReviewStatus(progress,lessonOne[1],'correct','2026-01-01T00:00:01.000Z');
progress=toggleReviewBookmark(progress,lessonOne[0],'2026-01-01T00:00:02.000Z');
progress=toggleReviewBookmark(progress,lessonOne[2],'2026-01-01T00:00:03.000Z');
progress=setReviewStatus(progress,lessonTwo[0],'incorrect','2026-01-01T00:00:04.000Z');

assert.equal(reviewKeyFor(lessonOne[0]),'y1-l01-v001','stable ids are used as review keys');
assert.deepEqual(reviewCounts(lessonOne,progress),{all:3,incorrect:1,correct:1,bookmarked:2});
assert.deepEqual(filterReviewDeck(lessonOne,progress,'incorrect').map(item=>item.id),['y1-l01-v001']);
assert.deepEqual(filterReviewDeck(lessonOne,progress,'correct').map(item=>item.id),['y1-l01-v002']);
assert.deepEqual(filterReviewDeck(lessonOne,progress,'bookmarked').map(item=>item.id),['y1-l01-v001','y1-l01-g001']);

progress=setReviewStatus(progress,lessonOne[0],'correct','2026-01-01T00:00:05.000Z');
assert.deepEqual(reviewCounts(lessonOne,progress),{all:3,incorrect:0,correct:2,bookmarked:2},'answer statuses are mutually exclusive');
progress=resetReviewStatuses(progress,lessonOne);
assert.deepEqual(reviewCounts(lessonOne,progress),{all:3,incorrect:0,correct:0,bookmarked:2},'scope reset keeps bookmarks');
assert.deepEqual(reviewCounts(lessonTwo,progress),{all:1,incorrect:1,correct:0,bookmarked:0},'scope reset does not affect other lessons');

const originalOrder=lessonOne.map(item=>item.id);
const randomOrder=shuffledSequence(lessonOne,()=>0).map(item=>item.id);
assert.notDeepEqual(randomOrder,originalOrder,'random mode establishes a shuffled order');
assert.equal(new Set(randomOrder).size,lessonOne.length,'a random pass contains no duplicate cards');
assert.deepEqual(randomOrder,shuffledSequence(lessonOne,()=>0).map(item=>item.id),'a stored random sequence remains stable until explicitly rebuilt');
assert.deepEqual(filterReviewDeck(shuffledSequence(lessonOne,()=>0),progress,'bookmarked').map(item=>item.id),['y1-l01-g001','y1-l01-v001'],'review filters retain the active random sequence order');

console.log('Flashcard review tests passed.');
