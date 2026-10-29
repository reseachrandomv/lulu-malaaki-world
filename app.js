// Lululemon & Malaaki's World — everything is end-to-end encrypted with AES-GCM.
// The key is derived from the shared password with PBKDF2 (600k iterations). The password is never stored or sent.
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const C=window.WORLD_CRYPTO,enc=new TextEncoder(),dec=new TextDecoder();
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u))),ub=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let KEY=null,ME=localStorage.getItem('world:me'),store=null;
const DATA={profiles:{},chat:{},events:{},reminders:{},memories:{},bucket:{},moods:{},settings:{}};
async function derive(pw){const base=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:ub(C.salt),iterations:C.iterations,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function seal(o){const iv=crypto.getRandomValues(new Uint8Array(12));return{iv:b64(iv),ct:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},KEY,enc.encode(JSON.stringify(o))))}}
async function open_(e){try{return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(e.iv)},KEY,ub(e.ct))))}catch{return null}}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

// ---------- Backends (only ciphertext ever leaves the device) ----------
function demoStore(){const k=c=>'world:demo:'+c,get=c=>JSON.parse(localStorage.getItem(k(c))||'{}'),subs={};
 const fire=c=>(subs[c]||[]).forEach(f=>f(get(c)));
 addEventListener('storage',e=>{if(e.key&&e.key.startsWith('world:demo:'))fire(e.key.slice(11))});
 return{mode:'Demo (this device)',put(c,id,v){const o=get(c);o[id]=v;localStorage.setItem(k(c),JSON.stringify(o));fire(c)},
  del(c,id){const o=get(c);delete o[id];localStorage.setItem(k(c),JSON.stringify(o));fire(c)},on(c,f){(subs[c]=subs[c]||[]).push(f);f(get(c))}}}
function fbStore(){const db=firebase.database(),r=c=>db.ref('world/'+c);
 return{mode:'Live 🔐',put:(c,id,v)=>r(c).child(id).set(c==='chat'?{...v,uid:AUTH.uid}:v),del:(c,id)=>r(c).child(id).remove(),on:(c,f)=>r(c).on('value',s=>f(s.val()||{}))}}

// ---------- Lock ----------
$('#lockform').onsubmit=async e=>{e.preventDefault();$('#lockmsg').textContent='Checking… 🔑';
 const k=await derive($('#pw').value);$('#pw').value='';
 try{await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(C.check.iv)},k,ub(C.check.ct));KEY=k;afterUnlock()}
 catch{$('.lockcard').classList.remove('shake');void $('.lockcard').offsetWidth;$('.lockcard').classList.add('shake');$('#lockmsg').textContent='Not quite… try again 💭'}};
function show(id){$$('.screen').forEach(s=>s.classList.toggle('show',s.id===id))}
let LIVE=false,AUTH=null,MEMBERS={},signup=false,typingT=null;
function afterUnlock(){LIVE=!!(window.FIREBASE_CONFIG&&window.firebase&&firebase.auth);if(!LIVE){if(!ME)return show('who');return start()}
 if(!firebase.apps.length)firebase.initializeApp(window.FIREBASE_CONFIG);
 show('auth');firebase.auth().onAuthStateChanged(u=>{AUTH=u;if(!u)return show('auth');routeMember()})}
let LEGACY=false;
async function routeMember(){let m;try{m=(await firebase.database().ref('world_members').get()).val()||{}}
 catch(x){LEGACY=true;ME=localStorage.getItem('world:me');if(ME)return start();$$('[data-me]').forEach(b=>b.disabled=false);return show('who')} // old rules still active: keep working
 MEMBERS=m;
 const mine=Object.keys(m).find(k=>m[k]===AUTH.uid);if(mine){ME=mine;return start()}
 const free=['Malaaki','Lululemon'].filter(n=>!m[n]);if(!free.length)return show('full');
 $$('[data-me]').forEach(b=>b.disabled=!free.includes(b.dataset.me));show('who')}
const amsg=t=>$('#authmsg').textContent=t;
const nice=e=>({'auth/invalid-credential':'Wrong email or password 💭','auth/wrong-password':'Wrong email or password 💭','auth/user-not-found':'No account with that email 💭','auth/email-already-in-use':'That email already has an account, sign in instead 🌸','auth/weak-password':'Password needs at least 6 characters','auth/invalid-email':'That email looks off 💭','auth/too-many-requests':'Too many tries, wait a bit ⏳'})[e.code]||'Oops: '+(e.message||e);
$('#authswap').onclick=e=>{e.preventDefault();signup=!signup;$('#authtitle').textContent=signup?'Create account 🌸':'Sign in 💫';$('#authgo').textContent=signup?'Create ✨':'Sign in ✨';
 $('#authswap').textContent=signup?'Have an account? Sign in 💫':'New here? Create an account 🌸';$('#apass').autocomplete=signup?'new-password':'current-password'};
$('#authform').onsubmit=async e=>{e.preventDefault();amsg(signup?'Creating… 🌸':'Signing in… 💫');const em=$('#aemail').value.trim(),pw=$('#apass').value;
 try{signup?await firebase.auth().createUserWithEmailAndPassword(em,pw):await firebase.auth().signInWithEmailAndPassword(em,pw);$('#apass').value=''}catch(x){amsg(nice(x))}};
$('#forgot').onclick=async e=>{e.preventDefault();const em=$('#aemail').value.trim();if(!em)return amsg('Type your email first, then tap forgot 💌');
 try{await firebase.auth().sendPasswordResetEmail(em);amsg('Reset link sent! Check your inbox 💌')}catch(x){amsg(nice(x))}};
$$('[data-me]').forEach(b=>b.onclick=async()=>{const name=b.dataset.me;
 if(!LIVE||LEGACY){ME=name;localStorage.setItem('world:me',ME);return start()}
 const res=await firebase.database().ref('world_members/'+name).transaction(cur=>cur===null?AUTH.uid:undefined).catch(()=>null);
 if(res&&res.committed){ME=name;start()}else{$('#whomsg').textContent='That spot was just taken 🥺';routeMember()}});
$$('.signout').forEach(b=>b.onclick=async()=>{if(LIVE&&AUTH){await firebase.database().ref('presence/'+AUTH.uid).update({online:false,typing:false,last:firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});await firebase.auth().signOut()}location.reload()});
const PRES={};
function presence(){const db=firebase.database(),me=db.ref('presence/'+AUTH.uid),TS=firebase.database.ServerValue.TIMESTAMP;
 db.ref('.info/connected').on('value',s=>{if(!s.val())return;me.onDisconnect().update({online:false,typing:false,last:TS}).then(()=>me.update({online:true,last:TS}))});
 db.ref('world_members').on('value',s=>{MEMBERS=s.val()||{};rPres()});db.ref('presence').on('value',s=>{Object.keys(PRES).forEach(k=>delete PRES[k]);Object.assign(PRES,s.val()||{});rPres()});
 $('#msg').addEventListener('input',()=>{me.update({typing:true});clearTimeout(typingT);typingT=setTimeout(()=>me.update({typing:false}),3000)});
 setInterval(rPres,30000)}
const ago=t=>{const s=(Date.now()-t)/1e3;return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':new Date(t).toLocaleDateString([], {dateStyle:'medium'})};
function pOf(n){return PRES[MEMBERS[n]]||{}}
function rPres(){$$('[data-dot]').forEach(d=>d.classList.toggle('on',!!pOf(d.dataset.dot).online));
 const o=ME==='Malaaki'?'Lululemon':'Malaaki',p=pOf(o),other=dn(o);
 $('#peer').textContent=!MEMBERS[o]?`${other} hasn't joined yet 🌸`:p.typing&&p.online?`${other} is typing…`:p.online?`🟢 ${other} is online`:p.last?`${other} · last seen ${ago(p.last)}`:`${other} · offline`}
$('#lockbtn').onclick=()=>location.reload();

function start(){show('app');store=LIVE?fbStore():demoStore();$('#mode').textContent=store.mode;if(LIVE){$('#outbtn').hidden=false;if(!LEGACY)presence();else $('#peer').hidden=true}else $('#peer').hidden=true;
 Object.keys(DATA).forEach(c=>store.on(c,async raw=>{const out={};for(const[id,v]of Object.entries(raw)){const o=await open_(v);if(o)out[id]=o}DATA[c]=out;render(c)}));
 setInterval(tick,1000);tick();setInterval(checkReminders,30000)}

// ---------- Tabs ----------
$$('nav button').forEach(b=>b.onclick=()=>{$$('nav button').forEach(x=>x.classList.toggle('on',x===b));$$('.tab').forEach(t=>t.classList.toggle('show',t.id==='t-'+b.dataset.t));if(b.dataset.t==='chat')scrollChat()});
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sorted=c=>Object.entries(DATA[c]).map(([id,v])=>({id,...v}));
const TZ={Malaaki:'Indian/Maldives',Lululemon:'Europe/Berlin'};
const fmt=(ts,tz,o={hour:'2-digit',minute:'2-digit'})=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,...o}).format(ts);

function render(c){({profiles:rProf,chat:rChat,events:rCal,reminders:rRem,memories:rMem,bucket:rBucket,moods:rMood,settings:rMeet})[c]?.();rHome()}

// ---------- Chat ----------
function rChat(){const m=sorted('chat').sort((a,b)=>a.ts-b.ts);
 $('#msgs').innerHTML=m.map(x=>`<div class="b ${x.from===ME?'me':'them'}"><div class="n"><img class="av xs" data-av="${esc(x.from)}" src="${pic(x.from)}"><i class="dot ${pOf(x.from).online?'on':''}" data-dot="${esc(x.from)}"></i> ${esc(dn(x.from))}</div>${x.text?esc(x.text):''}${x.img?`<img src="${x.img}" alt="">`:''}
 <div class="t">${fmt(x.ts,TZ[x.from]||TZ.Malaaki)}</div></div>`).join('');scrollChat()}
const scrollChat=()=>setTimeout(()=>scrollTo({top:document.body.scrollHeight,behavior:'smooth'}),50);
$('#chatform').onsubmit=async e=>{e.preventDefault();const t=$('#msg').value.trim();if(!t)return;$('#msg').value='';store.put('chat',uid(),await seal({from:ME,text:t,ts:Date.now()}));if(LIVE)firebase.database().ref('presence/'+AUTH.uid).update({typing:false})};
const EM='😊😂🥹😍🥰😘💙💜✨🌊🏝️🤗😭🙈🔥🎉🫶👯‍♀️☕🍰🌙⭐💫😴🤍'.match(/\p{Extended_Pictographic}\uFE0F?|.\u200d./gu);
$('#emojis').innerHTML=[...new Set(EM)].map(e=>`<span>${e}</span>`).join('');
$('#emojibtn').onclick=()=>$('#emojis').classList.toggle('show');$('#emojis').onclick=e=>{if(e.target.tagName==='SPAN'){$('#msg').value+=e.target.textContent;$('#msg').focus()}};
function shrink(file,max=900){return new Promise(r=>{const i=new Image();i.onload=()=>{const s=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);r(c.toDataURL('image/jpeg',.8))};i.src=URL.createObjectURL(file)})}
$('#img').onchange=async e=>{const f=e.target.files[0];if(!f)return;store.put('chat',uid(),await seal({from:ME,img:await shrink(f),ts:Date.now()}));e.target.value=''};

// ---------- Profiles (encrypted, world/profiles/<name>) ----------
const DEF={Malaaki:'assets/malaaki.jpg',Lululemon:'assets/lululemon.jpg'};
const pic=n=>DATA.profiles[n]?.img||DEF[n]||DEF.Malaaki,dn=n=>DATA.profiles[n]?.name||n;
function rProf(){$$('img[data-av]').forEach(i=>{const s=pic(i.dataset.av);if(i.getAttribute('src')!==s)i.src=s});$$('[data-nm]').forEach(e=>e.textContent=dn(e.dataset.nm));rChat();if(window.rPres&&LIVE)rPres();if($('#prof').classList.contains('show'))openProf(curP)}
let curP=null;
function openProf(n){curP=n;const p=DATA.profiles[n]||{};$('#pimg').src=pic(n);$('#pname').textContent=dn(n);$('#pmood').textContent=p.mood||'✨ no status yet';$('#pbio').textContent=p.bio||'';
 $('#pedit').hidden=n!==ME;$('#prof').classList.add('show')}
document.addEventListener('click',e=>{const t=e.target.closest('[data-av]');if(t&&$('#app').classList.contains('show')&&!t.closest('#prof'))openProf(t.dataset.av)});
$('#pclose').onclick=()=>{$('#prof').classList.remove('show');$('#pform').hidden=true};
$('#prof').onclick=e=>{if(e.target.id==='prof')$('#pclose').onclick()};
let newPic=null;
$('#pedit').onclick=()=>{const p=DATA.profiles[ME]||{};$('#fname').value=dn(ME);$('#fmood').value=p.mood||'';$('#fbio').value=p.bio||'';newPic=null;$('#pform').hidden=false};
$('#pfile').onchange=async e=>{const f=e.target.files[0];if(!f)return;newPic=await shrink(f,512);$('#pimg').src=newPic;e.target.value=''};
$('#pform').onsubmit=async e=>{e.preventDefault();const p=DATA.profiles[ME]||{};
 await store.put('profiles',ME,await seal({name:$('#fname').value.trim()||ME,mood:$('#fmood').value.trim(),bio:$('#fbio').value.trim(),img:newPic||p.img||null,ts:Date.now()}));
 $('#pform').hidden=true;toast('Profile saved 💙')};

// ---------- Clocks + countdown ----------
function parts(ms){ms=Math.max(0,ms);return[Math.floor(ms/864e5),Math.floor(ms/36e5)%24,Math.floor(ms/6e4)%60,Math.floor(ms/1e3)%60]}
function tick(){const n=Date.now();$('#c-mv').textContent=fmt(n,TZ.Malaaki,{hour:'2-digit',minute:'2-digit',second:'2-digit'});$('#c-de').textContent=fmt(n,TZ.Lululemon,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
 $('#d-mv').textContent=fmt(n,TZ.Malaaki,{weekday:'short',day:'numeric',month:'short'});$('#d-de').textContent=fmt(n,TZ.Lululemon,{weekday:'short',day:'numeric',month:'short'});
 const m=DATA.settings.meet?.at;if(m){const[d,h,mi,s]=parts(m-n);$('#count').innerHTML=[[d,'days'],[h,'hours'],[mi,'mins'],[s,'secs']].map(([v,l])=>`<div><b>${v}</b><small>${l}</small></div>`).join('');$('#home-count').textContent=m>n?`${d} days ${h}h ${mi}m 💙`:'Together now! 🥳'}
 else{$('#count').innerHTML='<p class="muted" style="grid-column:1/-1">Pick the day you meet ✈️</p>';$('#home-count').textContent='Set a date in the Meet tab ✈️'}}
function rMeet(){const m=DATA.settings.meet;$('#meetlabel').textContent=m?`Meeting on ${new Date(m.at).toLocaleString([], {dateStyle:'full',timeStyle:'short'})} — set by ${m.by}`:''}
$('#savemeet').onclick=async()=>{const v=$('#meetdate').value;if(!v)return;store.put('settings','meet',await seal({at:new Date(v).getTime(),by:ME}));toast('Countdown saved ✈️')};

// ---------- Calendar ----------
let calM=new Date();calM.setDate(1);
function rCal(){const ev=sorted('events').sort((a,b)=>a.date.localeCompare(b.date)),y=calM.getFullYear(),mo=calM.getMonth();
 $('#mlabel').textContent=calM.toLocaleString('en-GB',{month:'long',year:'numeric'});
 const first=(new Date(y,mo,1).getDay()+6)%7,days=new Date(y,mo+1,0).getDate(),today=new Date().toISOString().slice(0,10);
 let h='MTWTFSS'.split('').map(d=>`<div class="h">${d}</div>`).join('')+'<div></div>'.repeat(first);
 for(let d=1;d<=days;d++){const ds=`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;h+=`<div class="d ${ev.some(e=>e.date===ds)?'ev':''} ${ds===today?'today':''}" title="${esc(ev.filter(e=>e.date===ds).map(e=>e.title).join(', '))}">${d}</div>`}
 $('#grid').innerHTML=h;$('#evlist').innerHTML=ev.map(e=>`<li><span>📅 <b>${esc(e.date)}</b> — ${esc(e.title)} <small class="muted">· ${esc(e.by)}</small></span><span class="x"><button onclick="delItem('events','${e.id}')">🗑</button></span></li>`).join('')||'<div class="empty"><img src="assets/lululemon.jpg"><p>No plans yet~ add one! ✨</p></div>'}
$('#prevm').onclick=()=>{calM.setMonth(calM.getMonth()-1);rCal()};$('#nextm').onclick=()=>{calM.setMonth(calM.getMonth()+1);rCal()};
$('#evform').onsubmit=async e=>{e.preventDefault();store.put('events',uid(),await seal({title:$('#evtitle').value,date:$('#evdate').value,by:ME}));e.target.reset()};
window.delItem=(c,id)=>{if(confirm('Delete this?'))store.del(c,id)};

// ---------- Reminders ----------
function nextAt(r){let t=r.when;if(r.rep==='yearly'){const d=new Date(t);while(d.getTime()<Date.now()-6e4)d.setFullYear(d.getFullYear()+1);t=d.getTime()}return t}
function rRem(){$('#remlist').innerHTML=sorted('reminders').sort((a,b)=>nextAt(a)-nextAt(b)).map(r=>`<li><span>🔔 <b>${esc(r.title)}</b><br><small class="muted">${new Date(nextAt(r)).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}${r.rep?' · every year':''}</small></span><span class="x"><button onclick="delItem('reminders','${r.id}')">🗑</button></span></li>`).join('')||'<div class="empty"><img src="assets/lululemon.jpg"><p>No reminders yet — add birthdays! 🎂</p></div>'}
$('#remform').onsubmit=async e=>{e.preventDefault();store.put('reminders',uid(),await seal({title:$('#remtitle').value,when:new Date($('#remwhen').value).getTime(),rep:$('#remrep').value,by:ME}));e.target.reset()};
$('#notifbtn').onclick=async()=>{const p=await Notification.requestPermission();toast(p==='granted'?'Notifications on 🔔':'Notifications blocked')};
const fired=new Set(JSON.parse(localStorage.getItem('world:fired')||'[]'));
function checkReminders(){sorted('reminders').forEach(r=>{const t=nextAt(r),k=r.id+':'+t;if(t<=Date.now()&&Date.now()-t<36e5&&!fired.has(k)){fired.add(k);localStorage.setItem('world:fired',JSON.stringify([...fired]));toast('🔔 '+r.title);if(window.Notification&&Notification.permission==='granted')new Notification("Lululemon & Malaaki's World",{body:r.title})}})}

// ---------- Memories ----------
function rMem(){$('#wall').innerHTML=sorted('memories').sort((a,b)=>b.ts-a.ts).map((m,i)=>`<div class="polaroid" style="--r:${(i%2?1:-1)*(1+i%3)}deg"><img src="${m.img}" alt=""><p>${esc(m.cap)}</p><small style="display:flex;justify-content:space-between;color:#5865f2">${esc(m.by)}<a style="cursor:pointer" onclick="delItem('memories','${m.id}')">🗑</a></small></div>`).join('')||'<div class="empty"><img src="assets/lululemon.jpg"><p>Add your first memory 📸</p></div>'}
$('#memform').onsubmit=async e=>{e.preventDefault();const f=$('#memimg').files[0];if(!f)return toast('Pick a photo first 📷');store.put('memories',uid(),await seal({img:await shrink(f,1000),cap:$('#memcap').value,by:ME,ts:Date.now()}));e.target.reset();toast('Memory saved 💙')};

// ---------- Bucket list (shared: add / edit / tick / delete) ----------
function rBucket(){$('#blist').innerHTML=sorted('bucket').sort((a,b)=>a.done-b.done||a.ts-b.ts).map(b=>`<li class="${b.done?'done':''}"><input type="checkbox" ${b.done?'checked':''} onchange="tickB('${b.id}',this.checked)"><span>${esc(b.text)} <small class="muted">· ${esc(b.done?'done by '+b.doneBy:'added by '+b.by)}</small></span><span class="x"><button onclick="editB('${b.id}')">✏️</button><button onclick="delItem('bucket','${b.id}')">🗑</button></span></li>`).join('')||'<div class="empty"><img src="assets/lululemon.jpg"><p>Dream big together ✨</p></div>'}
$('#bform').onsubmit=async e=>{e.preventDefault();store.put('bucket',uid(),await seal({text:$('#btext').value,by:ME,done:false,ts:Date.now()}));e.target.reset()};
window.tickB=async(id,d)=>{const b=DATA.bucket[id];store.put('bucket',id,await seal({...b,done:d,doneBy:ME}));if(d)hearts('🎉')};
window.editB=async id=>{const b=DATA.bucket[id],t=prompt('Edit',b.text);if(t&&t.trim())store.put('bucket',id,await seal({...b,text:t.trim()}))};

// ---------- Thinking of you ----------
function hearts(e='💙'){for(let i=0;i<12;i++){const h=document.createElement('div');h.className='heartfly';h.textContent=e;h.style.left=Math.random()*90+'vw';h.style.top='80vh';h.style.animationDelay=i*.08+'s';document.body.appendChild(h);setTimeout(()=>h.remove(),2200)}}
let lastMood=0;
async function sendMood(e,txt){store.put('moods',uid(),await seal({from:ME,e,txt,ts:Date.now()}));hearts(e);toast('Sent '+e)}
$('#moodbtn').onclick=()=>sendMood('🤗','sent you a hug');
$('#moodpick').innerHTML=['😊','🥹','😴','😭','🥰','🤒','🎉'].map(e=>`<button data-e="${e}">${e}</button>`).join('');
$('#moodpick').onclick=e=>{if(e.target.dataset.e)sendMood(e.target.dataset.e,'is feeling '+e.target.dataset.e)};
function rMood(){const m=sorted('moods').sort((a,b)=>b.ts-a.ts);if(m[0]&&m[0].from!==ME&&m[0].ts>lastMood&&lastMood){hearts(m[0].e);toast(`${m[0].from} ${m[0].txt}`)}lastMood=m[0]?.ts||1;
 $('#moodlog').innerHTML=m.slice(0,4).map(x=>`<div>${x.e} <b>${esc(x.from)}</b> ${esc(x.txt)} · ${fmt(x.ts,TZ[ME]||TZ.Malaaki)}</div>`).join('')}

function rHome(){const n=[...sorted('events').map(e=>({t:new Date(e.date).getTime(),l:'📅 '+e.title})),...sorted('reminders').map(r=>({t:nextAt(r),l:'🔔 '+r.title}))].filter(x=>x.t>=Date.now()-864e5).sort((a,b)=>a.t-b.t).slice(0,4);
 $('#home-next').innerHTML=n.map(x=>`<li><span>${esc(x.l)}<br><small class="muted">${new Date(x.t).toLocaleDateString([], {dateStyle:'medium'})}</small></span></li>`).join('')||'<div class="empty"><img src="assets/lululemon.jpg"><p>Nothing planned yet~</p></div>'}

// sparkles + floating hearts/stars
(()=>{const s=document.getElementById('sparkles');const ch='✦✧♡☆✨💙⭐'.match(/./gu);for(let i=0;i<22;i++){const e=document.createElement('span');e.textContent=ch[i%ch.length];e.style.left=Math.random()*100+'%';e.style.animationDelay=-Math.random()*14+'s';e.style.animationDuration=10+Math.random()*10+'s';e.style.fontSize=10+Math.random()*16+'px';s.appendChild(e)}})();
