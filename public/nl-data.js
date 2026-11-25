/* nl-data.js — keyless data layer for the public Nifty dashboard (/public/).
   Loads the filtered plaintext feed (public.json / p/*.json) on branch 'live'.
   Same window.NL API as the private page so app.js/app.css/markup can be reused.
   Never decrypts, never reads a dashboard key, never probes a tunnel, and
   never fetches the sealed private feed. */
(function(){
"use strict";
const REPO="Shiv0626/nifty-live",RAW="https://raw.githubusercontent.com/"+REPO+"/live/",API="https://api.github.com/repos/"+REPO;
const JSD="https://cdn.jsdelivr.net/gh/"+REPO+"@live/";
const LAG=10;
let Bs=30,SLOWs=300;
let bundle=null,lastBundleAt=0,lastErr="",inflight=null,missing=new Set(),lastApiPtr=0;
const listeners=[];
function emit(){listeners.forEach(f=>{try{f()}catch(e){}})}
function to(u,ms,o){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return fetch(u,Object.assign({signal:c.signal},o||{})).finally(()=>clearTimeout(t))}
async function getJ(u,ms,o){const r=await to(u,ms,o);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}

function isPublic(j){
  return !!(j && typeof j==="object" && j.kind==="public" && !j.ct && !j.iv && j.dash);
}
function accept(b){
  if(!isPublic(b)) return false;
  if(!b.pushed_ms) return false;
  if(bundle && b.pushed_ms<=bundle.pushed_ms) return false;
  bundle=b; lastBundleAt=Date.now(); Bs=b.B||Bs; SLOWs=b.slow||SLOWs; lastErr="";
  emit(); return true;
}
async function tryPaths(paths){
  const roots=[RAW,JSD];
  for(const root of roots){
    const rs=await Promise.all(paths.filter(p=>!missing.has(root+p)).map(p=>
      getJ(root+p,7000).then(j=>isPublic(j)?j:null).catch(e=>{
        if(String(e.message).includes("404")) missing.add(root+p);
        return null;
      })
    ));
    const ok=rs.filter(Boolean).sort((a,b)=>(b.pushed_ms||0)-(a.pushed_ms||0));
    if(ok[0]) return ok[0];
  }
  return null;
}
async function loadBundle(){
  if(inflight)return inflight;
  inflight=(async()=>{
    const now=Date.now()/1000,f=Math.floor((now-LAG)/Bs);
    if(bundle&&bundle.fb>=f)return;
    let b=await tryPaths(["p/"+f+".json","p/"+(f-1)+".json","p/"+(f-2)+".json"]);
    if(b&&accept(b))return;
    b=await tryPaths(["public.json"]);
    if(b&&accept(b))return;
    if(bundle)return;

    if(!lastErr) lastErr="GitHub public data abhi nahi mili";
  })().catch(e=>{lastErr=String(e.message||e)}).finally(()=>{inflight=null});
  return inflight;
}

function parsePath(p){const u=new URL(p,"https://x.invalid");return {path:u.pathname,qs:u.searchParams}}
function quoteAge(lt){let n=null;Object.values((lt&&lt.quotes)||{}).forEach(x=>{if(x&&x.ts){const t=Date.parse(x.ts);if(!isNaN(t)&&(n==null||t>n))n=t}});return n==null?null:(Date.now()-n)/1000}
function expand(c){return (c&&c.b||[]).map(a=>({time:a[0],open:a[1],high:a[2],low:a[3],close:a[4],volume:a[5]||0}))}
function agg(bars,mins){
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
    if(!qt){const c=(bundle.candles||{})[sym];if(c&&c.b&&c.b.length){
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
    case "/api/symbols":{const s=bundle.symbols||{};return {symbols:[...(s.indices||[]),...(s.fo||s.n50||[])],n50:s.n50||[],indices:s.indices||[],fo:s.fo||[],extra:s.extra||[]}}
    case "/api/brokers":return {connect_wired:false,accounts:[]};
  }
  throw new Error("HTTP 404");
}
async function api(p){
  if(!bundle)await loadBundle();
  return JSON.parse(JSON.stringify(synth(p)));
}
function status(){
  const b=bundle,ageS=b?Math.max(0,(Date.now()-b.pushed_ms)/1000):null;
  const n=new Date(Date.now()+19800000),dow=n.getUTCDay(),hm=n.getUTCHours()*60+n.getUTCMinutes();
  const mkt=dow>=1&&dow<=5&&hm>=555&&hm<=930;
  return {mode:"github",host:null,ageS,pushed:b&&b.pushed,changed:b&&b.changed,
          stale:ageS==null||(mkt&&ageS>300),mkt,err:lastErr,noTunnel:true,hasData:!!b};
}
function istHMS(iso){try{return new Date(iso).toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false})}catch(e){return "—"}}
function fmtAge(s){if(s==null)return "—";s=Math.round(s);return s<90?s+"s":s<5400?Math.round(s/60)+" min":Math.round(s/3600)+" hr"}
function badgeHTML(){
  const s=status();
  if(!s.hasData)return {cls:"warn",html:"● GitHub data load ho raha hai…"+(s.err?" ("+s.err+")":"")};
  return {cls:s.stale?"bad":"ok",html:"● GitHub · updated "+istHMS(s.pushed)+" IST · "+fmtAge(s.ageS)+" pehle"};
}
function tick(){if(document.hidden)return;loadBundle()}
loadBundle();setInterval(tick,5000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden){tick()}});
window.NL={api,status,badgeHTML,onChange:f=>listeners.push(f),loadBundle,probe:()=>Promise.resolve(null),get bundle(){return bundle},_synth:synth};
})();
