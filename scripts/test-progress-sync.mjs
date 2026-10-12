import assert from 'node:assert/strict';
import {createProgressSync} from '../src/progress-sync.mjs';
import {cloneProgress,firestoreRecord,GUEST_PROGRESS_KEY} from '../src/progress-storage.mjs';
import {normalizeReviewProgress,resetReviewStatuses,toggleReviewBookmark,setReviewStatus} from '../src/flashcard-review.mjs';

const memoryStorage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function harness({storage=memoryStorage(),cloud=new Map(),progress={cards:{}},choice='merge'}={}){
  let local=cloneProgress(progress),callback,failWrite=false,readGate=null,writeGate=null;
  const statuses=[],errors=[],writes=[];
  let migrations=0;
  const sdk={
    collection:(_,a,uid)=>uid,
    doc:(_,a,uid,b,key)=>({uid,key:decodeURIComponent(key)}),
    serverTimestamp:()=>new Date(),
    async getDocs(uid){if(readGate)await readGate.promise;return {docs:[...(cloud.get(uid)?.values()||[])].map(record=>({data:()=>record}))};},
    writeBatch:()=>{const batch=[];return {set:(path,record)=>batch.push({path,record}),async commit(){
      if(writeGate)await writeGate.promise;
      if(failWrite)throw new Error('Simulated connection failure');
      for(const entry of batch){const {uid,key}=entry.path;if(!cloud.has(uid))cloud.set(uid,new Map());cloud.get(uid).set(key,entry.record);writes.push(entry);}
    }};}
  };
  const sync=createProgressSync({getProgress:()=>local,setProgress:value=>local=cloneProgress(value),storage,
    onStatus:value=>statuses.push(value),onError:error=>errors.push(error),onMigration:async()=>{migrations++;return choice;},
    authFactory:async onUser=>{callback=onUser;return {firestoreSdk:sdk,db:{},signOut:()=>callback(null),signIn:()=>callback({uid:'A'})};}
  });
  return {sync,storage,cloud,statuses,errors,writes,
    emit:user=>callback(user),get progress(){return local;},set progress(value){local=cloneProgress(value);},
    get migrations(){return migrations;},set failWrite(value){failWrite=value;},set readGate(value){readGate=value;},set writeGate(value){writeGate=value;}
  };
}
const card={id:'a'},early='2026-01-01T00:00:00.000Z',late='2026-01-02T00:00:00.000Z';
const original={cards:{a:{status:'correct',bookmarked:true,lastReviewed:early}}};

// Resets and removals have to be written, read back, and retained after restart.
const first=harness({progress:original});await first.sync.initialise();await first.emit({uid:'A'});
first.progress=resetReviewStatuses(first.progress,[card],late);first.sync.queue(first.progress,['a']);await first.sync.flush();
assert.equal(first.cloud.get('A').get('a').status,null,'reset clears the cloud answer');
first.progress=toggleReviewBookmark(first.progress,card,'2026-01-03T00:00:00.000Z');first.sync.queue(first.progress,['a']);await first.sync.flush();
assert.equal(first.cloud.get('A').get('a').bookmarked,false,'removed bookmarks clear the cloud bookmark');
assert.ok(first.progress.cards.a.lastReviewed,'empty records retain a removal timestamp');
await first.sync.logout();
assert.deepEqual(first.progress.cards,original.cards,'logout restores the current guest snapshot');

// Failed writes remain durable across a page close, while the newer local answer wins.
const offline=harness();await offline.sync.initialise();await offline.emit({uid:'A'});
offline.failWrite=true;offline.progress=setReviewStatus(offline.progress,card,'incorrect',late);offline.sync.queue(offline.progress,['a']);assert.equal(await offline.sync.flush(),false);
assert.deepEqual(JSON.parse(offline.storage.getItem('jp-study-sync-account-A')).pending,['a']);
const resumed=harness({storage:offline.storage,cloud:offline.cloud,progress:offline.progress});await resumed.sync.initialise();await resumed.emit({uid:'A'});
assert.equal(resumed.cloud.get('A').get('a').status,'incorrect','restart uploads the durable pending change');
await offline.emit(null);await resumed.sync.logout();

// Local-only edits made while the Firebase SDK itself is unavailable also survive.
const sdkOffline=harness();await sdkOffline.sync.initialise();await sdkOffline.emit({uid:'A'});
const editedWhileClosed=setReviewStatus(sdkOffline.progress,card,'incorrect',late);
const sdkResumed=harness({storage:sdkOffline.storage,cloud:sdkOffline.cloud,progress:editedWhileClosed});await sdkResumed.sync.initialise();await sdkResumed.emit({uid:'A'});
assert.equal(sdkResumed.cloud.get('A').get('a').status,'incorrect','account restore includes edits made without an initialized SDK');await sdkOffline.emit(null);await sdkResumed.sync.logout();

// A newer cloud removal also wins over an old local bookmark during routine retry.
const remove=harness({progress:original});await remove.sync.initialise();await remove.emit({uid:'A'});
remove.cloud.get('A').set('a',firestoreRecord('a',{lastReviewed:late},new Date()));await remove.sync.retry();await remove.sync.flush();
assert.deepEqual(remove.progress.cards.a,{lastReviewed:late},'routine retry does not resurrect a bookmark or answer');await remove.sync.logout();

// An edit made during a slow commit must remain pending, rather than being acknowledged by the earlier write.
const concurrent=harness();await concurrent.sync.initialise();await concurrent.emit({uid:'A'});
const gate=deferred();concurrent.writeGate=gate;concurrent.progress=setReviewStatus(concurrent.progress,card,'correct',early);concurrent.sync.queue(concurrent.progress,['a']);const writing=concurrent.sync.flush();
concurrent.progress=setReviewStatus(concurrent.progress,card,'incorrect',late);concurrent.sync.queue(concurrent.progress,['a']);gate.resolve();await writing;concurrent.writeGate=null;await concurrent.sync.flush();
assert.equal(concurrent.cloud.get('A').get('a').status,'incorrect','a concurrent edit is uploaded after the first commit');await concurrent.sync.logout();

const loading=harness();await loading.sync.initialise();const loadingGate=deferred();loading.readGate=loadingGate;const loadingAccount=loading.emit({uid:'A'});
loading.progress=setReviewStatus(loading.progress,card,'incorrect',late);loading.sync.queue(loading.progress,['a']);loadingGate.resolve();await loadingAccount;
assert.equal(loading.progress.cards.a.status,'incorrect','edits made during the initial cloud read are retained');assert.equal(loading.cloud.get('A').get('a').status,'incorrect');await loading.sync.logout();

// Late cloud reads and commits must never switch the current account's UI or write to another UID.
const accounts=harness({progress:{cards:{guest:{bookmarked:true}}}});await accounts.sync.initialise();
const readGate=deferred();accounts.readGate=readGate;const signingInA=accounts.emit({uid:'A'});
accounts.readGate=null;await accounts.emit({uid:'B'});readGate.resolve();await signingInA;
assert.equal(accounts.sync.user.uid,'B');assert.ok(accounts.writes.every(entry=>entry.path.uid==='B'),'stale account A initialization does not upload');
accounts.progress=setReviewStatus(accounts.progress,{id:'onlyB'},'correct',late);accounts.sync.queue(accounts.progress,['onlyB']);await accounts.sync.flush();await accounts.sync.logout();
accounts.progress=setReviewStatus(accounts.progress,{id:'newGuest'},'incorrect',late);
await accounts.emit({uid:'C'});assert.ok(accounts.progress.cards.newGuest,'new guest snapshot includes changes made after the previous logout');assert.equal(accounts.progress.cards.onlyB,undefined,'account B records never leak into C');await accounts.sync.logout();

// A deferred migration stays local until the user chooses again, including on retry.
const deferredMigration=harness({progress:original,choice:'later'});await deferredMigration.sync.initialise();await deferredMigration.emit({uid:'A'});await deferredMigration.sync.retry();
assert.equal(deferredMigration.migrations,2,'retry presents the deferred migration choice');assert.equal(deferredMigration.writes.length,0);await deferredMigration.sync.logout();

// The original guest snapshot survives upgrading from the earlier sync implementation.
const legacyStorage=memoryStorage();legacyStorage.setItem(GUEST_PROGRESS_KEY,JSON.stringify({cards:{guest:{bookmarked:true}}}));legacyStorage.setItem('jp-study-sync-migration-A','merged');
const legacy=harness({storage:legacyStorage,progress:original});await legacy.sync.initialise();await legacy.emit({uid:'A'});await legacy.sync.logout();assert.ok(legacy.progress.cards.guest);assert.equal(legacy.progress.cards.a,undefined);
assert.equal(normalizeReviewProgress({cards:{a:{lastReviewed:late}}}).cards.a.lastReviewed,late);
console.log('Progress sync tests passed: resets, bookmark removal, offline restart, concurrent writes, account isolation, deferred migration, and legacy upgrade.');
