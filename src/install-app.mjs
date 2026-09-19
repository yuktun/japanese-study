export function getInstallPlatform(navigatorObject=globalThis.navigator,matchMediaFunction=globalThis.matchMedia){
  const userAgent=navigatorObject?.userAgent||'';
  const isIOS=/iPad|iPhone|iPod/.test(userAgent)||(navigatorObject?.platform==='MacIntel'&&(navigatorObject?.maxTouchPoints||0)>1);
  const isSafari=isIOS&&/Safari/.test(userAgent)&&!/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  const isStandalone=Boolean(matchMediaFunction?.('(display-mode: standalone)')?.matches||navigatorObject?.standalone===true);
  const browser=/Edg\//.test(userAgent)?'edge':/Chrome\//.test(userAgent)?'chrome':'other';
  return {isIOS,isSafari,isStandalone,browser};
}

export function installInstructions(platform){
  if(platform.isIOS&&platform.isSafari)return {title:'將 Japanese Study 加入主畫面',content:'<ol><li>按 Safari 的「分享」按鈕。</li><li>選擇「加入主畫面」。</li><li>如有「開啟為網頁 App」選項，請啟用。</li><li>按「加入」。</li></ol>'};
  if(platform.isIOS)return {title:'請使用 Safari 安裝',content:'<p>請先在 Safari 開啟這個網站，再按「分享」→「加入主畫面」。</p>'};
  if(platform.browser==='edge')return {title:'安裝 Japanese Study',content:'<p>此瀏覽器目前未提供原生安裝提示。請按右上角「⋯」→「應用程式」→「安裝此網站為應用程式」。</p>'};
  if(platform.browser==='chrome')return {title:'安裝 Japanese Study',content:'<p>此瀏覽器目前未提供原生安裝提示。請按右上角「⋮」→「投放、儲存及分享」→「安裝頁面為應用程式」。</p>'};
  return {title:'安裝 Japanese Study',content:'<p>此瀏覽器目前未提供原生安裝提示。請使用瀏覽器選單中的「安裝」或「加入主畫面」功能。</p>'};
}

export function initialiseInstallApp(){
  const button=document.querySelector('#install-app-button');
  const modal=document.querySelector('#install-modal');
  const dialog=document.querySelector('#install-modal-dialog');
  const title=document.querySelector('#install-modal-title');
  const content=document.querySelector('#install-modal-content');
  const close=document.querySelector('#install-modal-close');
  const confirm=document.querySelector('#install-modal-confirm');
  if(!button||!modal||!dialog||!title||!content||!close||!confirm)return;

  let deferredPrompt=null;
  let lastFocused=null;
  const platform=()=>getInstallPlatform();
  const updateButton=()=>{button.hidden=platform().isStandalone;};
  const closeModal=()=>{
    modal.hidden=true;
    if(lastFocused?.isConnected)lastFocused.focus();
  };
  const showInstructions=()=>{
    const instructions=installInstructions(platform());
    title.textContent=instructions.title;
    content.innerHTML=instructions.content;
    lastFocused=document.activeElement;
    modal.hidden=false;
    dialog.focus();
  };
  const promptInstall=async()=>{
    if(!deferredPrompt){showInstructions();return;}
    const prompt=deferredPrompt;
    deferredPrompt=null;
    try{
      await prompt.prompt();
      const choice=await prompt.userChoice;
      if(choice?.outcome==='accepted')button.hidden=true;
    }catch{}
  };

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    button.hidden=true;
    closeModal();
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',updateButton);
  button.addEventListener('click',promptInstall);
  close.addEventListener('click',closeModal);
  confirm.addEventListener('click',closeModal);
  modal.addEventListener('click',event=>{if(event.target===modal)closeModal();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden){event.stopPropagation();closeModal();}});
  updateButton();
}
