import {createAuthService} from './auth-service.mjs';
import {cloneProgress,firestoreRecord,hasProgress,mergeProgress,progressFromFirestore} from './progress-storage.mjs';

const migrationKey=uid=>`jp-study-sync-migration-${uid}`;
const documentId=cardId=>encodeURIComponent(cardId);

export function createProgressSync({getProgress,setProgress,onStatus,onUser,onMigration,onError}){
  let service,user=null,active=false,timer=null,pending=new Set(),handlingAuth=false;
  const status=(state,message)=>onStatus?.({state,message});
  async function readCloud(){
    const {collection,getDocs}=service.firestoreSdk;
    const snapshot=await getDocs(collection(service.db,'users',user.uid,'progress'));
    return progressFromFirestore(snapshot.docs.map(item=>item.data()));
  }
  async function writeCards(progress,keys){
    const {doc,writeBatch,serverTimestamp}=service.firestoreSdk;
    for(let start=0;start<keys.length;start+=450){
      const batch=writeBatch(service.db);
      for(const key of keys.slice(start,start+450)){const record=progress.cards[key];if(record)batch.set(doc(service.db,'users',user.uid,'progress',documentId(key)),firestoreRecord(key,record,serverTimestamp()),{merge:true});}
      await batch.commit();
    }
  }
  async function flush(){
    if(!active||!user||!pending.size)return true;
    const keys=[...pending];pending.clear();status('syncing','同步中…');
    try{await writeCards(getProgress(),keys);status('synced',`已同步 · ${new Intl.DateTimeFormat('zh-HK',{dateStyle:'short',timeStyle:'short'}).format(new Date())}`);return true;}
    catch(error){keys.forEach(key=>pending.add(key));status(navigator.onLine?'error':'offline',navigator.onLine?'同步失敗，請重試':'等待網絡連線');onError?.(error);return false;}
  }
  function queue(progress,keys=Object.keys(progress.cards)){
    if(!active)return;
    keys.forEach(key=>pending.add(key));status('pending','尚未同步');clearTimeout(timer);timer=setTimeout(flush,1200);
  }
  async function beginMigration(local,cloud){
    // Kept until a later successful migration; this makes an interrupted choice recoverable.
    localStorage.setItem(`jp-study-sync-backup-${user.uid}`,JSON.stringify({createdAt:new Date().toISOString(),local,cloud}));
    status('pending','請選擇進度處理方式');
    const choice=await onMigration({local:cloneProgress(local),cloud:cloneProgress(cloud),merge:mergeProgress(local,cloud)});
    if(choice==='cloud'){setProgress(cloud);localStorage.setItem(migrationKey(user.uid),'cloud');active=true;status('synced','已同步');return;}
    if(choice==='later'){localStorage.setItem(migrationKey(user.uid),'deferred');status('pending','尚未同步');return;}
    const result=mergeProgress(local,cloud);
    setProgress(result.progress);status('syncing','同步中…');
    await writeCards(result.progress,Object.keys(result.progress.cards));
    active=true;localStorage.setItem(migrationKey(user.uid),'merged');status('synced',`已同步 · ${new Intl.DateTimeFormat('zh-HK',{dateStyle:'short',timeStyle:'short'}).format(new Date())}`);
  }
  async function handleUser(nextUser){
    if(handlingAuth)return;handlingAuth=true;active=false;pending.clear();user=nextUser;
    try{
      if(!user){status('guest','進度保存在此裝置');onUser?.(null);return;}
      onUser?.(user);status('syncing','正在讀取雲端進度…');
      const local=cloneProgress(getProgress()),cloud=await readCloud(),marker=localStorage.getItem(migrationKey(user.uid));
      if(!marker&&hasProgress(local))await beginMigration(local,cloud);
      else {if(hasProgress(cloud))setProgress(cloud);active=marker!=='deferred';status(active?'synced':'pending',active?'已同步':'尚未同步');}
    }catch(error){status('error','同步失敗，請重試');onError?.(error);}finally{handlingAuth=false;}
  }
  return {
    async initialise(){try{service=await createAuthService(handleUser);}catch(error){status('unavailable','同步服務暫時不可用');onError?.(error);}},
    login:async()=>service?.signIn(),logout:async()=>{if(!await flush())throw new Error('尚有未同步進度。');return service?.signOut();},queue,flush,
    retry:async()=>{if(!user)return;active=true;const cloud=await readCloud(),result=mergeProgress(getProgress(),cloud);setProgress(result.progress);queue(result.progress,Object.keys(result.progress.cards));},
    get user(){return user;},get active(){return active;}
  };
}
