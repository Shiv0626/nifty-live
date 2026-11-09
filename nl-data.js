/* nl-data.js — data layer for the GitHub-hosted Nifty dashboard.
   PRIMARY source: GitHub branch 'live' (pushed every ~30s by gh_live.py on the box).
   OPTIONAL enhancement: hostc tunnel (live ~2s ticks) when reachable.
   Pages never blank: all reads fall back to the last GitHub bundle in memory. */
(function(){
"use strict";
const REPO="Shiv0626/nifty-live",RAW="https://raw.githubusercontent.com/"+REPO+"/",BR="live",API="https://api.github.com/repos/"+REPO;
const q=new URLSearchParams(location.search),K=q.get("k")||"";
const NOTUN=q.get("noTunnel")==="1"||q.get("forceFallback")==="1";
const LAG=10;               // seconds after a bucket starts before we ask for it (push takes ~2-4s)
let Bs=30,SLOWs=300;        // updated from bundle
let bundle=null,lastBundleAt=0,lastErr="",inflight=null,missing=new Set(),lastApiPtr=0;
let tHost=null,tOkAt=0,tHosts=[],probing=null,lastProbe=0,hostJsonAt=0,hostJson=[];
const listeners=[];
function emit(){listeners.forEach(f=>{try{f()}catch(e){}})}
function to(u,ms,o){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return fetch(u,Object.assign({signal:c.signal},o||{})).finally(()=>clearTimeout(t))}
async function getJ(u,ms,o){const r=await to(u,ms,o);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
function accept(b){
  if(!b||!b.pushed_ms)return false;
  if(bundle&&b.pushed_ms<=bundle.pushed_ms)return false;
  bundle=b;lastBundleAt=Date.now();Bs=b.B||Bs;SLOWs=b.slow||SLOWs;lastErr="";
  (b.hosts||[]).forEach(h=>{if(typeof h==="string"&&h.startsWith("https://")&&!tHosts.includes(h))tHosts.unshift(h)});
  tHosts=tHosts.slice(0,8);
  emit();return true;
}
async function tryPaths(paths){
  const rs=await Promise.all(paths.filter(p=>!missing.has(p)).map(p=>getJ(RAW+BR+"/"+p,7000).catch(e=>{if(String(e.message).includes("404"))missing.add(p);return null})));
  const ok=rs.filter(Boolean).sort((a,b)=>b.pushed_ms-a.pushed_ms);return ok[0]||null;
}
async function loadBundle(){
  if(inflight)return inflight;
  inflight=(async()=>{
    const now=Date.now()/1000,f=Math.floor((now-LAG)/Bs),s=Math.floor((now-LAG)/SLOWs);
    if(bundle&&bundle.fb>=f)return;
    let b=await tryPaths(["f/"+f+".json"]);
    if(!b)b=await tryPaths(["f/"+(f-1)+".json","f/"+(f-2)+".json"]);
    if(b&&accept(b))return;
    if(bundle&&bundle.fb>=f-2)return;           // already have one of these
    b=await tryPaths(["s/"+s+".json","s/"+(s-1)+".json"]);
    if(b&&accept(b))return;
    if(bundle&&bundle.sb>=s-1)return;
    // gap (box asleep / pusher down): scan back up to ~2h of slow buckets
    const back=[];for(let i=2;i<24;i++)back.push("s/"+(s-i)+".json");
    b=await tryPaths(back);if(b&&accept(b))return;
    if(!bundle){
      b=await getJ(RAW+BR+"/latest.json",8000).catch(()=>null);if(b&&accept(b))return;
    }
    // last resort, at most every 3 min: GitHub API pointer (60/h per IP) -> immutable sha URL
    if(Date.now()-lastApiPtr>180000){lastApiPtr=Date.now();
      try{const r=await getJ(API+"/git/ref/heads/"+BR,6000);b=await getJ(RAW+r.object.sha+"/latest.json",8000);if(accept(b))return}catch(e){}}
    lastErr="GitHub data abhi nahi mili";
  })().catch(e=>{lastErr=String(e.message||e)}).finally(()=>{inflight=null});
  return inflight;
}
// ---------- tunnel (optional) ----------
async function loadHostJson(){
  if(Date.now()-hostJsonAt<120000)return;hostJsonAt=Date.now();
  try{const j=await getJ("host.json?t="+Date.now(),5000,{cache:"no-store"});const l=[];[j.host,...(j.hosts||[])].forEach(h=>{if(typeof h==="string"&&h.startsWith("https://")&&!l.includes(h))l.push(h)});hostJson=l}catch(e){}
}
async function alive(h){try{const r=await to(h+"/api/audit?k="+encodeURIComponent(K),4000,{cache:"no-store"});return r.ok}catch(e){return false}}
function probe(){
  if(NOTUN||!K)return Promise.resolve(null);
  if(probing)return probing;
  lastProbe=Date.now();
  probing=(async()=>{
    await loadHostJson();
    const list=[...(tHost?[tHost]:[]),...tHosts,...hostJson].filter((h,i,a)=>a.indexOf(h)===i).slice(0,8);
    if(!list.length){tHost=null;return null}
    const h=await new Promise(res=>{let n=list.length;list.forEach(x=>alive(x).then(ok=>{if(ok)res(x);else if(--n===0)res(null)}))});
    const was=!!tunnelLive();
    if(h){tHost=h;tOkAt=Date.now()}else{tHost=null}
    if(was!==!!tunnelLive())emit();
    return h;
  })().finally(()=>{probing=null});
  return probing;
}
function tunnelLive(){return !!(tHost&&Date.now()-tOkAt<25000)}
// ---------- synthesize /api/* from the bundle ----------
function parsePath(p){const u=new URL(p,"https://x.invalid");return {path:u.pathname,qs:u.searchParams}}
function quoteAge(lt){let n=null;Object.values((lt&&lt.quotes)||{}).forEach(x=>{if(x&&x.ts){const t=Date.parse(x.ts);if(!isNaN(t)&&(n==null||t>n))n=t}});return n==null?null:(Date.now()-n)/1000}
function expand(c){return (c&&c.b||[]).map(a=>({time:a[0],open:a[1],high:a[2],low:a[3],close:a[4],volume:a[5]||0}))}
function agg(bars,mins){ // session-aligned (09:15 IST) buckets
  if(mins<=5)return bars;const out=[];let cur=null;
  bars.forEach(b=>{const ist=b.time+19800,day=Math.floor(ist/86400)*86400,open=day+9*3600+15*60;
    const st=ist<open?Math.floor(ist/(mins*60))*mins*60:open+Math.floor((ist-open)/(mins*60))*mins*60,key=st-19800;
    if(!cur||cur.time!==key){if(cur)out.push(cur);cur={time:key,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume}}
    else{cur.high=Math.max(cur.high,b.high);cur.low=Math.min(cur.low,b.low);cur.close=b.close;cur.volume+=b.volume}});
  if(cur)out.push(cur);return out}
function candles(sym,tf){
  const c=(bundle.candles||{})[sym];const mins={"1m":1,"3m":3,"5m":5,"15m":15}[tf]||5;
  if(!c)return {symbol:sym,tf,bars:[],updated:null,src:"github: is symbol ka chart data nahi",count:0};
  const bars=agg(expand(c),mins);
  return {symbol:sym,tf,bars,updated:c.u,src:"github "+(mins<5?"5m(fallback)":mins===5?"5m":"5m->"+tf),count:bars.length};
}
function ltp(sym){
  const lt=bundle.ltp||{},age=quoteAge(lt);
  const base={updated:lt.updated,age_s:age,fresh:age!=null&&age<=60};
  if(sym){sym=String(sym).toUpperCase();let qt=(lt.quotes||{})[sym]||null;
    if(!qt){const c=(bundle.candles||{})[sym];if(c&&c.b&&c.b.length){   // no tick quote (e.g. option contract): use last 5m bar
      const b=c.b,last=b[b.length-1],dayOf=t=>Math.floor((t+19800)/86400),prev=b.filter(x=>dayOf(x[0])<dayOf(last[0])).pop();
      const pc=prev?prev[4]:b.filter(x=>dayOf(x[0])===dayOf(last[0]))[0][1],chg=+(last[4]-pc).toFixed(2);
      qt={symbol:sym,ltp:last[4],high:last[2],low:last[3],prev_close:pc,chg,pct:pc?+(chg/pc*100).toFixed(2):0,ts:c.u,src:"5m bar"}}}
    return Object.assign(base,{quote:qt})}
  return Object.assign(base,{quotes:lt.quotes||{}});
}
function option(sym,typ,tf){
  sym=String(sym||"").toUpperCase();const o=(bundle.options||{})[sym]||{},a=o.atm||{};
  const setup=(((bundle.dash||{}).setups||{}).setups||[]).find(s=>String(s.symbol).toUpperCase()===sym)||{};
  let contract=null,levels=null,source=null;
  if(o.contract&&!typ){contract=o.contract;levels=o.levels;source="setup"}
  else{const nat=setup.side==="SHORT"?"PE":"CE";typ=(typ||nat).toUpperCase();contract=a[typ]||null;source="atm"}
  const d={symbol:sym,side:setup.side||null,contract,type:(contract||"").slice(-2)||typ,source,levels,atm:o.atm||null,tf,grade:setup.grade,status:setup.status,trigger:setup.triggerText,lot:o.lot};
  if(!contract)return Object.assign(d,{bars:[],ltp:null,pending:true});
  const c=candles(contract,tf);d.bars=c.bars;d.updated=c.updated;d.ltp=ltp(contract);return d;
}
function synth(p){
  if(!bundle)throw new Error("GitHub data abhi load ho raha hai");
  const {path,qs}=parsePath(p),D=bundle.dash||{};
  switch(path){
    case "/api/dash":return D;
    case "/api/ltp":return ltp(qs.get("symbol"));
    case "/api/paper":return D.paper||{};
    case "/api/setups":return D.setups||{setups:[]};
    case "/api/audit":return D.audit||{issues:[]};
    case "/api/sectors":return bundle.sectors||{sectors:[],err:"github: sector data nahi"};
    case "/api/candles":return candles((qs.get("symbol")||"NIFTY").toUpperCase(),qs.get("tf")||"5m");
    case "/api/option":return option(qs.get("symbol"),qs.get("type"),qs.get("tf")||"1m");
    case "/api/symbols":{const s=bundle.symbols||{};return {symbols:[...(s.n50||[]),...(s.indices||[])],n50:s.n50||[],indices:s.indices||[],extra:s.extra||[]}}
  }
  throw new Error("HTTP 404");
}
async function api(p){
  if(tunnelLive()){
    try{const r=await to(tHost+p+(p.includes("?")?"&":"?")+"k="+encodeURIComponent(K),3500,{cache:"no-store"});
      if(r.ok){tOkAt=Date.now();const j=await r.json();
        if(bundle&&p.startsWith("/api/ltp")){const bq=(bundle.ltp||{}).quotes||{};   // fill non-N50 symbols (setups/BTST/options) from GitHub copy
          if(j.quotes){Object.keys(bq).forEach(s=>{if(!j.quotes[s])j.quotes[s]=bq[s]})}else if(!j.quote){const sy=(parsePath(p).qs.get("symbol")||"").toUpperCase();if(bq[sy])j.quote=bq[sy]}}
        return j}
    }catch(e){}
    tHost=null;emit();probe();          // tunnel dropped -> GitHub copy, no blank
  }
  if(!bundle)await loadBundle();
  return JSON.parse(JSON.stringify(synth(p)));
}
function status(){
  const b=bundle,ageS=b?Math.max(0,(Date.now()-b.pushed_ms)/1000):null;
  const n=new Date(Date.now()+19800000),dow=n.getUTCDay(),hm=n.getUTCHours()*60+n.getUTCMinutes();
  const mkt=dow>=1&&dow<=5&&hm>=555&&hm<=930;
  return {mode:tunnelLive()?"tunnel":"github",host:tHost,ageS,pushed:b&&b.pushed,changed:b&&b.changed,
          stale:ageS==null||(mkt&&ageS>300),mkt,err:lastErr,noTunnel:NOTUN,hasData:!!b};
}
function istHMS(iso){try{return new Date(iso).toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false})}catch(e){return "—"}}
function fmtAge(s){if(s==null)return "—";s=Math.round(s);return s<90?s+"s":s<5400?Math.round(s/60)+" min":Math.round(s/3600)+" hr"}
function badgeHTML(){
  const s=status();
  if(s.mode==="tunnel")return {cls:"ok",html:"● LIVE (tunnel) · GitHub backup "+(s.pushed?istHMS(s.pushed)+" IST":"—")};
  if(!s.hasData)return {cls:"warn",html:"● GitHub data load ho raha hai…"+(s.err?" ("+s.err+")":"")};
  return {cls:s.stale?"bad":"ok",html:"● GitHub · updated "+istHMS(s.pushed)+" IST · "+fmtAge(s.ageS)+" pehle"+(s.noTunnel?" · TEST: noTunnel":"")};
}
// schedule: bundle check every 5s (fetches only when a new 30s bucket is due); tunnel probe every 15s
function tick(){loadBundle();if(!NOTUN&&(!tunnelLive()||Date.now()-lastProbe>15000)&&Date.now()-lastProbe>(tunnelLive()?15000:20000))probe()}
loadBundle();probe();setInterval(tick,5000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden){tick()}});
window.NL={api,status,badgeHTML,onChange:f=>listeners.push(f),loadBundle,probe,get bundle(){return bundle},_synth:synth};
})();
