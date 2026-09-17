const UPDATE_CHECK_INTERVAL=5*60*1000;

export function initialisePwa(){
  const status=document.querySelector('#offline-status');
  const update=document.querySelector('#pwa-update');
  const updateNow=document.querySelector('#pwa-update-now');
  const updateLater=document.querySelector('#pwa-update-later');
  if(!status||!update||!('serviceWorker'in navigator))return;

  let registration;
  let lastCheck=0;
  let activationRequested=false;
  let reloadStarted=false;
  let updateShown=false;

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
  const requestOfflineStatus=()=> (navigator.serviceWorker.controller||registration?.active)?.postMessage({type:'GET_OFFLINE_STATUS'});
  const reloadForUpdate=()=>{
    if(!activationRequested||reloadStarted)return;
    reloadStarted=true;
    window.location.reload();
  };
  const checkForUpdate=()=>{
    if(!registration||!navigator.onLine||Date.now()-lastCheck<UPDATE_CHECK_INTERVAL)return;
    lastCheck=Date.now();
    registration.update().catch(()=>{});
  };
  const watchInstalling=worker=>{
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate();
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
    const waiting=registration?.waiting;
    if(!waiting)return;
    activationRequested=true;
    updateNow.disabled=true;
    waiting.postMessage({type:'SKIP_WAITING'});
  });
  updateLater.addEventListener('click',()=>{update.hidden=true;});

  setStatus(navigator.onLine?'正在準備離線資料':'離線資料未完成','preparing');
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
    registration=reg;
    watchInstalling(reg.installing);
    reg.addEventListener('updatefound',()=>watchInstalling(reg.installing));
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdate();
    navigator.serviceWorker.ready.then(requestOfflineStatus);
    checkForUpdate();
  }).catch(()=>setStatus('離線資料未完成','incomplete'));
}
