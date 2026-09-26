const UPDATE_CHECK_INTERVAL=5*60*1000;

export function initialisePwa(){
  const status=document.querySelector('#offline-status');
  const update=document.querySelector('#pwa-update');
  const updateNow=document.querySelector('#pwa-update-now');
  const updateLater=document.querySelector('#pwa-update-later');
  const checkButton=document.querySelector('#check-for-update-button');
  const checkStatus=document.querySelector('#update-check-status');
  if(!status||!update||!checkButton||!checkStatus||!('serviceWorker'in navigator))return;

  let registration;
  let lastCheck=0;
  let activationRequested=false;
  let reloadStarted=false;
  let updateShown=false;
  let manualCheckInProgress=false;

  const setStatus=(text,state)=>{
    status.textContent=text;
    status.dataset.state=state;
    status.hidden=false;
  };
  const refreshConnectivity=()=>{
    if(!navigator.onLine)setStatus('離線模式','offline');
  };
  const showUpdate=()=>{
    if(updateShown)return;
    updateShown=true;
    update.hidden=false;
  };
  const setCheckStatus=(text,state='')=>{
    checkStatus.textContent=text;
    checkStatus.dataset.state=state;
    checkStatus.hidden=!text;
  };
  const requestOfflineStatus=()=> (navigator.serviceWorker.controller||registration?.active)?.postMessage({type:'GET_OFFLINE_STATUS'});
  const reloadForUpdate=()=>{
    if(!activationRequested||reloadStarted)return;
    try{
      if(sessionStorage.getItem('jp-study-update-reload')==='1')return;
      sessionStorage.setItem('jp-study-update-reload','1');
    }catch{}
    reloadStarted=true;
    window.location.reload();
  };
  const activateWaitingWorker=()=>{
    const waiting=registration?.waiting;
    if(!waiting)return false;
    activationRequested=true;
    waiting.postMessage({type:'SKIP_WAITING'});
    return true;
  };
  const checkForUpdate=()=>{
    if(!registration||!navigator.onLine||Date.now()-lastCheck<UPDATE_CHECK_INTERVAL)return;
    lastCheck=Date.now();
    registration.update().catch(()=>{});
  };
  const finishManualCheck=message=>{
    manualCheckInProgress=false;
    checkButton.disabled=false;
    if(message)setCheckStatus(message);
  };
  const watchInstalling=worker=>{
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller){
        if(manualCheckInProgress){
          setCheckStatus('正在套用新版本…');
          activateWaitingWorker();
        }else showUpdate();
      }
      if(worker.state==='redundant'&&manualCheckInProgress)finishManualCheck('更新檢查未完成');
    });
  };

  navigator.serviceWorker.addEventListener('message',event=>{
    const message=event.data||{};
    if(message.type==='OFFLINE_PREPARING')setStatus('正在準備離線資料','preparing');
    if(message.type==='OFFLINE_READY'){
      setStatus('已可離線使用','ready');
      navigator.storage?.persist?.().catch(()=>{});
    }
    if(message.type==='OFFLINE_STATUS')setStatus(message.ready?'已可離線使用':'離線資料未完成',message.ready?'ready':'incomplete');
    if(message.type==='OFFLINE_PREPARATION_FAILED')setStatus(message.reason==='quota'?'離線資料未完成（儲存空間不足）':'離線資料未完成','incomplete');
    if(message.type==='UPDATE_ACTIVATED')reloadForUpdate();
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    reloadForUpdate();
  });
  window.addEventListener('online',()=>{refreshConnectivity();checkForUpdate();requestOfflineStatus();});
  window.addEventListener('offline',refreshConnectivity);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkForUpdate();});
  updateNow.addEventListener('click',()=>{
    if(!registration?.waiting)return;
    updateNow.disabled=true;
    activateWaitingWorker();
  });
  updateLater.addEventListener('click',()=>{update.hidden=true;});
  checkButton.addEventListener('click',async()=>{
    if(!registration||manualCheckInProgress)return;
    if(!navigator.onLine){setCheckStatus('目前離線，無法檢查更新','error');return;}
    manualCheckInProgress=true;
    checkButton.disabled=true;
    setCheckStatus('正在檢查更新…');
    try{
      await registration.update();
      if(registration.waiting){
        setCheckStatus('正在套用新版本…');
        activateWaitingWorker();
      }else if(registration.installing){
        // The state-change listener will activate it once installation completes.
      }else{
        // update() resolves after the worker comparison; no waiting worker means no deployment is available.
        finishManualCheck('已是最新版本');
      }
    }catch{
      finishManualCheck('暫時無法檢查更新','error');
    }
  });

  setStatus(navigator.onLine?'正在準備離線資料':'離線資料未完成','preparing');
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
    registration=reg;
    try{sessionStorage.removeItem('jp-study-update-reload');}catch{}
    watchInstalling(reg.installing);
    reg.addEventListener('updatefound',()=>watchInstalling(reg.installing));
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdate();
    navigator.serviceWorker.ready.then(requestOfflineStatus);
    checkForUpdate();
  }).catch(()=>setStatus('離線資料未完成','incomplete'));
}
