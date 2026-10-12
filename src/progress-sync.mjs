import {createAuthService} from './auth-service.mjs';
import {GUEST_PROGRESS_KEY,cloneProgress,firestoreRecord,hasProgress,mergeProgress,progressFromFirestore} from './progress-storage.mjs';

const migrationKey=uid=>`jp-study-sync-migration-${uid}`;
const accountKey=uid=>`jp-study-sync-account-${uid}`;
const ownerKey='jp-study-progress-owner';
const documentId=cardId=>encodeURIComponent(cardId);

export function createProgressSync({getProgress,setProgress,onStatus,onUser,onMigration,onError,authFactory=createAuthService,storage}){
  if(!storage){try{storage=globalThis.localStorage;}catch{storage={getItem:()=>null,removeItem:()=>{},setItem:()=>{throw new Error('本機儲存不可用');}};}}
  let service,user=null,session=null,timer=null,generation=0,deferredUser,initialising=null;
  const status=(state,message)=>onStatus?.({state,message});
  const read=(key,fallback=null)=>{try{return JSON.parse(storage.getItem(key)||'null')??fallback;}catch{return fallback;}};
  const save=(key,value)=>storage.setItem(key,JSON.stringify(value));
  const current=target=>session===target&&target.generation===generation;
  const syncedMessage=()=>`已同步 · ${new Intl.DateTimeFormat('zh-HK',{dateStyle:'short',timeStyle:'short'}).format(new Date())}`;
  function persist(target){save(accountKey(target.uid),{progress:target.progress,pending:[...target.pending]});}
  async function readCloud(target){
    const {collection,getDocs}=service.firestoreSdk;
    const snapshot=await getDocs(collection(service.db,'users',target.uid,'progress'));
    return progressFromFirestore(snapshot.docs.map(item=>item.data()));
  }
  async function writeCards(target,progress,keys){
    const {doc,writeBatch,serverTimestamp}=service.firestoreSdk;
    for(let start=0;start<keys.length;start+=450){
      const batch=writeBatch(service.db);
      for(const key of keys.slice(start,start+450)){
        // An empty record explicitly clears a cloud status/bookmark. Never skip it.
        batch.set(doc(service.db,'users',target.uid,'progress',documentId(key)),firestoreRecord(key,progress.cards[key]||{},serverTimestamp()));
      }
      await batch.commit();
      if(!current(target))return;
    }
  }
  async function flush(){
    const target=session;
    if(!target?.active||!target.pending.size)return true;
    if(target.inFlight)return target.inFlight;
    const keys=[...target.pending],progress=cloneProgress(target.progress);
    status('syncing','同步中…');
    let successful=false;
    target.inFlight=(async()=>{
      try{
        await writeCards(target,progress,keys);
        if(!current(target))return false;
        for(const key of keys)if(JSON.stringify(target.progress.cards[key])===JSON.stringify(progress.cards[key]))target.pending.delete(key);
        persist(target);
        status(target.pending.size?'pending':'synced',target.pending.size?'尚未同步':syncedMessage());
        successful=true;
        return true;
      }catch(error){
        if(current(target)){status(globalThis.navigator?.onLine===false?'offline':'error',globalThis.navigator?.onLine===false?'等待網絡連線':'同步失敗，請重試');onError?.(error);}
        return false;
      }finally{
        target.inFlight=null;
        if(successful&&current(target)&&target.pending.size){clearTimeout(timer);timer=setTimeout(()=>void flush(),1200);}
      }
    })();
    return target.inFlight;
  }
  function queue(progress,keys=Object.keys(progress.cards)){
    const target=session;if(!target)return;
    target.progress=cloneProgress(progress);
    keys.forEach(key=>target.pending.add(key));
    try{persist(target);}catch(error){status('error','無法保存待同步進度');onError?.(error);return;}
    if(!target.active)return;
    status('pending','尚未同步');clearTimeout(timer);timer=setTimeout(()=>void flush(),1200);
  }
  function beginMigration(target,local,cloud){
    if(target.migration)return target.migration;
    target.migration=chooseMigration(target,local,cloud).finally(()=>{target.migration=null;});
    return target.migration;
  }
  async function chooseMigration(target,local,cloud){
    save(`jp-study-sync-backup-${target.uid}`,{createdAt:new Date().toISOString(),local,cloud});
    status('pending','請選擇進度處理方式');
    const choice=await onMigration({local:cloneProgress(local),cloud:cloneProgress(cloud),merge:mergeProgress(local,cloud)});
    if(!current(target))return;
    if(choice!=='merge'&&choice!=='cloud'){
      storage.setItem(migrationKey(target.uid),'deferred');persist(target);status('pending','尚未同步');return;
    }
    target.progress=choice==='cloud'?cloneProgress(cloud):mergeProgress(target.progress,cloud).progress;
    target.pending.clear();target.active=true;
    setProgress(target.progress);
    storage.setItem(migrationKey(target.uid),choice==='cloud'?'cloud':'merged');
    if(choice==='merge')queue(target.progress,Object.keys(target.progress.cards));else persist(target);
    if(target.pending.size)await flush();else status('synced','已同步');
  }
  async function handleUser(nextUser){
    const previous=session;
    if(previous){previous.progress=cloneProgress(getProgress());try{persist(previous);}catch(error){onError?.(error);}}
    const wasOwner=read(ownerKey);
    clearTimeout(timer);const authGeneration=++generation;session=null;user=nextUser;
    try{
      if(!user){
        if(wasOwner)setProgress(read(GUEST_PROGRESS_KEY,{}));
        storage.removeItem(ownerKey);status('guest','進度保存在此裝置');onUser?.(null);return;
      }
      // Only guest records can seed a new account. Another account's records stay isolated.
      const legacyAccount=!wasOwner&&!read(accountKey(user.uid))&&storage.getItem(migrationKey(user.uid))&&read(GUEST_PROGRESS_KEY);
      if(!wasOwner&&!legacyAccount)save(GUEST_PROGRESS_KEY,cloneProgress(getProgress()));
      const saved=read(accountKey(user.uid));
      const local=wasOwner===user.uid
        ?mergeProgress(getProgress(),saved?.progress||{},{preserveBookmarks:false}).progress
        :cloneProgress(legacyAccount?getProgress():saved?.progress||read(GUEST_PROGRESS_KEY,{}));
      const target={uid:user.uid,generation,progress:local,pending:new Set(Array.isArray(saved?.pending)?saved.pending.filter(key=>typeof key==='string'):[]),active:false,inFlight:null};
      session=target;save(ownerKey,user.uid);setProgress(local);onUser?.(user);status('syncing','正在讀取雲端進度…');
      const cloud=await readCloud(target);
      if(!current(target))return;
      const marker=storage.getItem(migrationKey(target.uid));
      if(marker==='deferred'||!marker&&hasProgress(local))await beginMigration(target,target.progress,cloud);
      else{
        target.progress=mergeProgress(target.progress,cloud,{preserveBookmarks:false}).progress;
        target.active=true;setProgress(target.progress);persist(target);
        // Timestamped local changes survive reloads and catch up after an offline start.
        for(const [key,record] of Object.entries(target.progress.cards))if(JSON.stringify(record)!==JSON.stringify(cloud.cards[key]))target.pending.add(key);
        persist(target);
        if(target.pending.size)await flush();else status('synced','已同步');
      }
    }catch(error){if(authGeneration===generation)status('error','同步失敗，請重試');onError?.(error);}
  }
  function initialise(){
    if(service)return Promise.resolve();
    if(initialising)return initialising;
    initialising=(async()=>{
      try{
        service=await authFactory(next=>{if(!service){deferredUser=next;return;}return handleUser(next);});
        if(deferredUser!==undefined){const next=deferredUser;deferredUser=undefined;await handleUser(next);}
      }catch(error){status('unavailable','同步服務暫時不可用');onError?.(error);}
    })().finally(()=>{initialising=null;});
    return initialising;
  }
  return {
    initialise,
    async login(){if(!service)await initialise();if(!service)throw new Error('登入服務尚未準備好，請連線後再試。');return service.signIn();},
    async logout(){
      if(session?.active)while(session.pending.size){if(!await flush())throw new Error('尚有未同步進度。');}
      return service?.signOut();
    },
    queue,flush,
    async retry(){
      if(!service)await initialise();
      const target=session;if(!target)return;
      const cloud=await readCloud(target);if(!current(target))return;
      const marker=storage.getItem(migrationKey(target.uid));
      if(!marker||marker==='deferred'){await beginMigration(target,target.progress,cloud);return;}
      target.progress=mergeProgress(target.progress,cloud,{preserveBookmarks:false}).progress;
      target.active=true;setProgress(target.progress);
      const changes=Object.keys(target.progress.cards).filter(key=>JSON.stringify(target.progress.cards[key])!==JSON.stringify(cloud.cards[key]));
      if(changes.length||target.pending.size)queue(target.progress,changes);else {persist(target);status('synced','已同步');}
    },
    get user(){return user;},get active(){return session?.active===true;}
  };
}
