import assert from 'node:assert/strict';
import {filterReviewDeck,normalizeReviewProgress,resetReviewStatuses,reviewCounts,reviewKeyFor,sequenceForReviewMode,setReviewStatus,shuffledSequence,toggleReviewBookmark} from '../src/flashcard-review.mjs';
import {readFile} from 'node:fs/promises';
import {japaneseForFlashcard,labelForFlashcard,verbGroupLabel} from '../src/flashcard-presentation.mjs';

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

assert.deepEqual(sequenceForReviewMode(lessonOne,'sequential').map(item=>item.id),originalOrder,'sequential mode restores lesson order');
const freshRandomPass=sequenceForReviewMode(lessonOne,'random',()=>0);
assert.equal(freshRandomPass[0].id,'y1-l01-v002','a newly selected random mode has a newly shuffled first card');
assert.equal(filterReviewDeck(freshRandomPass,progress,'bookmarked')[0].id,'y1-l01-g001','a filtered random sequence starts with its own first matching card');
assert.equal(filterReviewDeck([],progress,'incorrect').length,0,'empty review filters remain empty');

const lessonThreeVocabulary=JSON.parse(await readFile(new URL('../data/year3/lesson3/vocabulary.json',import.meta.url),'utf8'));
const tantou=lessonThreeVocabulary.find(item=>item.id==='y3-l3-v002');
assert.equal(labelForFlashcard({...tantou,type:'vocabulary'}),'生字','vocabulary badges do not contain the vocabulary term or part of speech');
assert.equal(labelForFlashcard({type:'grammar'}),'文法','grammar badges remain distinct');
assert.equal(japaneseForFlashcard({...tantou,type:'vocabulary'}),'担当する','Japanese prompts prefer kanji when supplied');
assert.deepEqual({kana:tantou.kana,kanji:tantou.kanji,meaningZh:tantou.meaningZh,category:tantou.category},{kana:'たんとうする',kanji:'担当する',meaningZh:'負責、擔任',category:'動詞'},'Lesson 03 vocabulary uses canonical field mapping');
assert.equal(lessonThreeVocabulary.some(item=>/^\d+$/.test(item.kana)),false,'Lesson 03 does not expose source row numbers as readings');
assert.equal(verbGroupLabel({...tantou,type:'vocabulary'}),'','verb-group metadata is absent when its source does not provide it');
assert.equal(verbGroupLabel({type:'vocabulary',verbGroup:2}),'動詞組別：2','verb groups have an explicit label when supplied');

console.log('Flashcard review tests passed.');
