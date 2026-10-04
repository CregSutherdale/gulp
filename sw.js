const V='gulp-2380a8e396';
const CORE=['./','./game.2380a8e396.js','./manifest.webmanifest','./icon-180.png'];
// Install caches the page and its game file TOGETHER, so the cached pair always matches.
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
// Only ever delete this game's old caches (the github.io domain is shared).
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('gulp-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url); if(u.origin!==location.origin) return;
  if(r.mode==='navigate'){
    // Fresh page when the network answers quickly; otherwise the cached page (the
    // cached page always has its matching game file cached alongside it).
    e.respondWith((async()=>{
      const cached=await caches.match('./');
      const net=fetch(r).catch(()=>null);
      if(!cached){const res=await net;return res||new Response('<p style="font:20px system-ui;padding:40px">You are offline. Connect once to download Gulp!</p>',{headers:{'Content-Type':'text/html'}});}
      const res=await Promise.race([net,new Promise(ok=>setTimeout(()=>ok(null),3000))]);
      return (res&&res.ok)?res:cached;
    })());
    return;
  }
  if(/^game.[0-9a-f]+.js$/.test(u.pathname.slice(u.pathname.lastIndexOf('/')+1))){
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(x=>x.put(r,c));}return res;})));
    return;
  }
  e.respondWith(caches.open(V).then(c=>c.match(r).then(m=>{const net=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res;}).catch(()=>m);return m||net;})));
});
