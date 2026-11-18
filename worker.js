// Cloudflare Worker: hatırlatmaları saklar, dakikada bir kontrol eder, zamanı gelince iPhone'a push gönderir.
const H={'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-token','access-control-allow-methods':'GET,POST,OPTIONS'};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...H,'content-type':'application/json'}});
const E=new TextEncoder();
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64d=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const cat=(...a)=>{const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let p=0;for(const x of a){o.set(x,p);p+=x.length}return o};
const step=(d,r)=>{if(r==='daily')d.setUTCDate(d.getUTCDate()+1);else if(r==='weekly')d.setUTCDate(d.getUTCDate()+7);else if(r==='monthly')d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCFullYear(d.getUTCFullYear()+1)};

async function vapid(env){
  let v=await env.HAT.get('vapid',{type:'json'});
  if(!v){
    const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']);
    v={priv:await crypto.subtle.exportKey('jwk',k.privateKey),pub:b64u(await crypto.subtle.exportKey('raw',k.publicKey))};
    await env.HAT.put('vapid',JSON.stringify(v));
  }
  return v;
}
async function auth(env,aud){
  const v=await vapid(env);
  const h=b64u(E.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const c=b64u(E.encode(JSON.stringify({aud,exp:Math.floor(Date.now()/1000)+43200,sub:'mailto:hatirlatici@example.com'})));
  const key=await crypto.subtle.importKey('jwk',v.priv,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,E.encode(h+'.'+c));
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${v.pub}`;
}
async function hkdf(salt,ikm,info,len){
  const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,len*8));
}
async function encrypt(text,keys){
  const ua=b64d(keys.p256dh),sec=b64d(keys.auth);
  const as=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const asPub=new Uint8Array(await crypto.subtle.exportKey('raw',as.publicKey));
  const uaKey=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},as.privateKey,256));
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const prk=await hkdf(sec,ecdh,cat(E.encode('WebPush: info\0'),ua,asPub),32);
  const cek=await hkdf(salt,prk,E.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=await hkdf(salt,prk,E.encode('Content-Encoding: nonce\0'),12);
  const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,cat(E.encode(text),new Uint8Array([2]))));
  return cat(salt,new Uint8Array([0,0,16,0,65]),asPub,ct);
}
async function push(env,sub,data){
  const r=await fetch(sub.endpoint,{method:'POST',headers:{Authorization:await auth(env,new URL(sub.endpoint).origin),'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'86400',Urgency:'high'},body:await encrypt(JSON.stringify(data),sub.keys)});
  return r.status;
}

export default{
  async fetch(req,env){
    if(req.method==='OPTIONS')return new Response(null,{headers:H});
    const u=new URL(req.url);
    if(u.pathname==='/vapid')return J({key:(await vapid(env)).pub});
    const t=req.headers.get('x-token')||'';
    if(!t)return J({error:'token'},401);
    const tk=await env.HAT.get('token');
    if(!tk)await env.HAT.put('token',t);else if(tk!==t)return J({error:'token'},401);
    if(u.pathname==='/sync'&&req.method==='POST'){
      const b=await req.json();
      await env.HAT.put('state',JSON.stringify({sub:b.sub,items:b.items||[]}));
      return J({ok:1});
    }
    if(u.pathname==='/test'){
      const s=await env.HAT.get('state',{type:'json'});
      if(!s||!s.sub)return J({error:'abonelik yok'},400);
      return J({status:await push(env,s.sub,{title:'Test bildirimi',body:'Çalışıyor!'})});
    }
    return J({ok:1});
  },
  async scheduled(_,env){
    const s=await env.HAT.get('state',{type:'json'});
    if(!s||!s.sub)return;
    const now=Date.now(),keep=[];let ch=false;
    for(const i of s.items){
      if(i.ts<=now){
        ch=true;
        const st=await push(env,s.sub,{id:i.id,title:i.title,body:'Hatırlatma zamanı'});
        if(st===404||st===410)delete s.sub;
        if(i.rep){const d=new Date(i.ts);do{step(d,i.rep)}while(d.getTime()<=now);i.ts=d.getTime();keep.push(i)}
      }else keep.push(i);
    }
    if(ch){s.items=keep;await env.HAT.put('state',JSON.stringify(s))}
  }
};
