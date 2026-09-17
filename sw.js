/* Japanese Study offline-first service worker. Bump CACHE_VERSION for each release. */
const CACHE_VERSION='2026-09-17-pwa-3';
const CACHE_PREFIX='jp-study-offline-';
const CACHE_NAME=`${CACHE_PREFIX}${CACHE_VERSION}`;
const READY_MARKER='__jp_study_offline_ready__';
const CORE_ASSETS=[
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './assets/japanese-study-icon.png',
  './app.js',
  './src/flashcard-review.mjs',
  './src/curriculum-order.mjs',
  './src/pwa-client.mjs',
  './src/japanese-speech.mjs',
  './data/manifest.json',
  './data/course-map.json',
  './data/conjugation/forms.json',
  './data/conjugation/verbs.json',
  './data/conjugation/keigo.json',
  './data/conjugation/quick-reference.json',
  './data/conjugation/plain-forms.json',
  './data/conjugation/derived-forms.json'
];

const scopeUrl=path=>new URL(path,self.registration.scope).toString();
const markerUrl=()=>scopeUrl(READY_MARKER);

async function notifyClients(message){
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  clients.forEach(client=>client.postMessage(message));
}

async function fetchAndCache(cache,path,retries=2){
  const url=scopeUrl(path);
  let lastError;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const response=await fetch(new Request(url,{cache:'reload'}));
      if(!response.ok)throw new Error(`${new URL(url).pathname} (${response.status})`);
      await cache.put(new Request(url),response.clone());
      return response;
    }catch(error){lastError=error;}
  }
  throw lastError;
}

async function mapWithConcurrency(items,limit,worker){
  let cursor=0;
  async function run(){
    while(cursor<items.length){
      const index=cursor++;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
}

async function cacheOfflineInventory(){
  const cache=await caches.open(CACHE_NAME);
  try{
    await notifyClients({type:'OFFLINE_PREPARING'});
    const responses=await Promise.all(CORE_ASSETS.map(asset=>fetchAndCache(cache,asset)));
    const manifest=await responses[CORE_ASSETS.indexOf('./data/manifest.json')].clone().json();
    if(!Array.isArray(manifest.lessons))throw new Error('Invalid course manifest.');
    const lessonAssets=[...new Set(manifest.lessons.flatMap(lesson=>['vocabulary','grammar','reference'].map(key=>lesson[key]).filter(Boolean)))];
    await mapWithConcurrency(lessonAssets,4,asset=>fetchAndCache(cache,asset));
    await cache.put(new Request(markerUrl()),new Response(JSON.stringify({version:CACHE_VERSION,assets:CORE_ASSETS.length+lessonAssets.length}),{headers:{'content-type':'application/json'}}));
    await notifyClients({type:'OFFLINE_READY',version:CACHE_VERSION});
  }catch(error){
    await caches.delete(CACHE_NAME);
    const reason=error?.name==='QuotaExceededError'?'quota':'network';
    await notifyClients({type:'OFFLINE_PREPARATION_FAILED',reason});
    throw error;
  }
}

async function cacheIsReady(cacheName=CACHE_NAME){
  const cache=await caches.open(cacheName);
  return Boolean(await cache.match(markerUrl()));
}

self.addEventListener('install',event=>{
  event.waitUntil(cacheOfflineInventory());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const cacheNames=(await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIX)).sort();
    // Keep the current cache and one prior complete cache so older open tabs remain safe offline.
    const keep=new Set(cacheNames.slice(-2));
    await Promise.all(cacheNames.filter(name=>!keep.has(name)).map(name=>caches.delete(name)));
    await notifyClients({type:'UPDATE_ACTIVATED',version:CACHE_VERSION});
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING'){
    self.skipWaiting();
    return;
  }
  if(event.data?.type==='GET_OFFLINE_STATUS'){
    event.waitUntil(cacheIsReady().then(ready=>event.source?.postMessage({type:'OFFLINE_STATUS',ready,version:CACHE_VERSION})));
  }
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(event.request,{ignoreSearch:true});
    if(cached)return cached;
    if(event.request.mode==='navigate'){
      const appShell=await cache.match(scopeUrl('./index.html'));
      if(appShell)return appShell;
    }
    return fetch(event.request);
  })());
});
