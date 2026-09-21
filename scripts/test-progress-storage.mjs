import assert from 'node:assert/strict';
import {mergeProgress,progressFromFirestore} from '../src/progress-storage.mjs';

const local={version:1,cards:{a:{status:'incorrect',bookmarked:true,lastReviewed:'2026-01-01T00:00:00.000Z'},b:{bookmarked:true}}};
const cloud={version:1,cards:{a:{status:'correct',lastReviewed:'2026-01-02T00:00:00.000Z'},c:{status:'incorrect',lastReviewed:'2026-01-01T00:00:00.000Z'}}};
const merged=mergeProgress(local,cloud);
assert.deepEqual(merged.progress.cards.a,{status:'correct',bookmarked:true,lastReviewed:'2026-01-02T00:00:00.000Z'},'newer status wins while bookmarks are preserved');
assert.deepEqual(Object.keys(merged.progress.cards).sort(),['a','b','c'],'unique cards from both sources are retained');
assert.deepEqual(mergeProgress({cards:{a:{status:'correct'}}},{cards:{a:{status:'incorrect'}}}).conflicts,['a'],'missing timestamps are not invented');
assert.deepEqual(progressFromFirestore([{schemaVersion:1,cardId:'a',status:'correct',bookmarked:false,lastReviewed:'2026-01-01T00:00:00.000Z'},{schemaVersion:2,cardId:'ignored'}]).cards,{a:{status:'correct',lastReviewed:'2026-01-01T00:00:00.000Z'}},'only supported Firestore records are accepted');
console.log('Progress storage tests passed.');
