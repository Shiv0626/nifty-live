(function(){
"use strict";
const REPO="Shiv0626/nifty-live";
const RAW="https://raw.githubusercontent.com/"+REPO+"/live/";
const API="https://api.github.com/repos/"+REPO;
const LAG=10;
let B=30, data=null, lastAt=0, lastErr="", heatMode="sector", missing=new Set(), lastApi=0;

function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function to(u,ms){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return fetch(u,{signal:c.signal,cache:"no-store"}).finally(()=>clearTimeout(t))}
async function getJ(u,ms){const r=await to(u,ms);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
function isPublic(j){
  return !!(j && typeof j==="object" && j.kind==="public" && j.enc!=="aesgcm" && !j.ct);
}
function inr(n){
  if(n==null||n==="")return "—";
  const x=Number(n); if(!isFinite(x))return "—";
  const sign=x>0?"+":x<0?"−":"";
  return sign+"₹"+Math.abs(x).toLocaleString("en-IN",{maximumFractionDigits:2});
}
function rfmt(n){
  if(n==null||n==="")return "—";
  const x=Number(n); if(!isFinite(x))return "—";
  const sign=x>0?"+":x<0?"−":"";
  return sign+Math.abs(x).toFixed(2)+"R";
}
function tone(n){const x=Number(n); if(!isFinite(x)||x===0)return "m"; return x>0?"g":"p"}
function px(n){if(n==null||n==="")return "—"; const x=Number(n); return isFinite(x)?x.toLocaleString("en-IN",{maximumFractionDigits:2}):esc(n)}
function chgLine(q){
  if(!q)return "";
  const ch=q.chg, pct=q.pct;
  const bits=[];
  if(ch!=null) bits.push((Number(ch)>0?"+":"")+px(ch));
  if(pct!=null) bits.push((Number(pct)>0?"+":"")+Number(pct).toFixed(2)+"%");
  return bits.join(" ");
}
function heatColor(pct){
  if(pct==null||!isFinite(Number(pct))) return "#2a2e39";
  const a=Math.min(1, Math.abs(Number(pct))/2);
  if(Number(pct)>=0) return "rgba(0,229,160,"+(0.18+0.72*a)+")";
  return "rgba(255,45,149,"+(0.18+0.72*a)+")";
}
function clock(){
  try{
    $("istClock").textContent=new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false})+" IST";
  }catch(e){}
}
function badge(txt, cls){
  if(txt==null||txt==="")return "";
  const t=String(txt);
  return '<span class="badge '+(cls||t.replace(/[^A-Za-z0-9]/g,""))+'">'+esc(t)+"</span>";
}
function accept(j){
  if(!isPublic(j)) return false;
  if(data && j.pushed_ms && data.pushed_ms && j.pushed_ms<=data.pushed_ms) return false;
  data=j; lastAt=Date.now(); lastErr="";
  if(j.B) B=j.B;
  render();
  return true;
}
async function tryPaths(paths){
  const rs=await Promise.all(paths.filter(p=>!missing.has(p)).map(p=>
    getJ(RAW+p,7000).then(j=>isPublic(j)?j:null).catch(e=>{
      if(String(e.message).includes("404")) missing.add(p);
      return null;
    })
  ));
  const ok=rs.filter(Boolean).sort((a,b)=>(b.pushed_ms||0)-(a.pushed_ms||0));
  return ok[0]||null;
}
async function load(){
  const now=Date.now()/1000, f=Math.floor((now-LAG)/B);
  let j=await tryPaths(["p/"+f+".json","p/"+(f-1)+".json","p/"+(f-2)+".json"]);
  if(j && accept(j)) return;
  j=await tryPaths(["public.json"]);
  if(j && accept(j)) return;
  if(Date.now()-lastApi>180000){
    lastApi=Date.now();
    try{
      const r=await getJ(API+"/git/ref/heads/live",6000);
      const sha=r && r.object && r.object.sha;
      if(sha){
        j=await getJ(RAW.replace(/\/live\/$/,"/"+sha+"/")+"public.json",8000);
        if(accept(j)) return;
      }
    }catch(e){}
  }
  if(!data) lastErr=lastErr||"Public data abhi nahi mili";
  render();
}
function levels(o){
  if(!o) return "";
  const bits=["entry","sl","t1","t2"].map(k=>o[k]==null?"":'<span class="dm">'+k.toUpperCase()+'</span> '+esc(px(o[k]))+(o[k+"R"]!=null?" <span class='m'>("+esc(o[k+"R"])+"R)</span>":""));
  return '<div class="lv">'+bits.filter(Boolean).join("")+"</div>";
}
function renderSetups(list){
  const el=$("setups");
  $("setupsN").textContent=(list&&list.length?list.length+" setups":"");
  if(!list||!list.length){el.innerHTML='<div class="empty">Is session ka koi setup nahi</div>';return}
  el.innerHTML=list.map(s=>{
    const q=s.q||{};
    const opt=s.option&&s.option.contract?('<div class="note">OPT '+esc(s.option.contract)+"</div>"+levels(s.option)):"";
    return '<article class="card"><div class="h"><span class="sym">'+esc(s.symbol)+"</span><span>"+
      badge(s.grade)+" "+badge(s.side)+" "+badge(s.status)+'</span></div>'+
      '<div class="note m">'+(s.session_date?esc(s.session_date)+" · ":"")+(s.time?esc(s.time):"")+
      (q.ltp!=null?" · LTP "+esc(px(q.ltp))+" <span class='"+tone(q.pct)+"'>"+esc(chgLine(q))+"</span>":"")+"</div>"+
      levels(s)+opt+(s.note?'<div class="note">'+esc(s.note)+"</div>":"")+"</article>";
  }).join("");
}
function renderBooks(books){
  const el=$("books"), tradesEl=$("bookedTrades");
  if(!books||!books.length){el.innerHTML='<div class="empty">Koi book nahi</div>';tradesEl.innerHTML="";return}
  el.innerHTML=books.map(b=>{
    const day=b.day||{}, tot=b.total||{};
    const tag=b.shadow||b.not_in_booked_pnl?'<div class="tag">SHADOW · not in booked P&L</div>':"";
    return '<div class="book'+(b.shadow?" shadow":"")+'"><h4>'+esc(b.label||b.id)+"</h4>"+tag+
      '<div class="kv"><span class="m">TODAY</span><span class="'+tone(day.pnl)+'">'+esc(inr(day.pnl))+" · "+esc(rfmt(day.r))+"</span>"+
      '<span class="m">ALL</span><span class="'+tone(tot.pnl_net!=null?tot.pnl_net:tot.pnl)+'">'+
      esc(inr(tot.pnl_net!=null?tot.pnl_net:tot.pnl))+" · "+esc(rfmt(tot.r_net!=null?tot.r_net:tot.r))+
      (tot.trades!=null?" · "+esc(tot.trades)+" tr":"")+"</span></div>"+
      (b.note?'<div class="note" style="margin-top:4px">'+esc(b.note)+"</div>":"")+"</div>";
  }).join("");
  const rows=[];
  books.forEach(b=>(b.today||[]).forEach(t=>rows.push(Object.assign({book:b.id},t))));
  if(!rows.length){tradesEl.innerHTML='<div class="empty">Aaj koi booked trade nahi</div>';return}
  tradesEl.innerHTML='<table><thead><tr><th>BOOK</th><th>SYM</th><th>SIDE</th><th>GR</th><th>FILL</th><th>EXIT</th><th>PNL</th><th>R</th><th>WHY</th></tr></thead><tbody>'+
    rows.map(t=>'<tr><td>'+esc(t.book)+"</td><td>"+esc(t.symbol)+"</td><td>"+esc(t.side||"")+"</td><td>"+esc(t.grade||"")+
      "</td><td>"+esc(px(t.fill))+"</td><td>"+esc(px(t.exit))+"</td><td class='"+tone(t.pnl)+"'>"+esc(inr(t.pnl))+
      "</td><td class='"+tone(t.r)+"'>"+esc(rfmt(t.r))+"</td><td>"+esc(t.reason||t.status||"")+"</td></tr>").join("")+
    "</tbody></table>";
}
function renderBtst(bt){
  if(!bt){ $("btstPicks").innerHTML=""; $("btstRows").innerHTML=""; $("btstNote").textContent=""; $("btstTotal").textContent=""; $("btstN").textContent=""; return}
  $("btstN").textContent=[bt.date&&("pick "+bt.date), bt.exit_day&&("exit "+bt.exit_day)].filter(Boolean).join(" · ");
  $("btstNote").textContent=bt.note||"";
  const picks=bt.picks||[];
  $("btstPicks").innerHTML=picks.length?picks.map(s=>{
    const opt=s.option&&s.option.contract?('<div class="note">OPT '+esc(s.option.contract)+"</div>"+levels(s.option)):"";
    return '<article class="card"><div class="h"><span class="sym">'+esc(s.symbol)+"</span><span>"+
      badge(s.grade)+" "+badge(s.side)+"</span></div>"+
      '<div class="note m">'+(s.entry_zone?"zone "+esc(s.entry_zone)+" · ":"")+(s.ref_entry!=null?"ref "+esc(px(s.ref_entry)):"")+"</div>"+
      levels(s)+opt+(s.reason?'<div class="note">'+esc(s.reason)+"</div>":"")+"</article>";
  }).join(''):('<div class="empty">Koi pick nahi</div>');
  const tot=(bt.results&&bt.results.total)||{};
  $("btstTotal").innerHTML=tot&&(tot.pnl!=null||tot.trades!=null)
    ? ('Booked total <span class="'+tone(tot.pnl)+'">'+esc(inr(tot.pnl))+" · "+esc(rfmt(tot.r))+"</span> · "+
       esc(tot.trades||0)+" trades"+(tot.win_rate!=null?" · win "+esc(tot.win_rate)+"%":""))
    : "";
  const rows=(bt.results&&bt.results.rows)||[];
  $("btstRows").innerHTML=rows.length
    ? '<table><thead><tr><th>DATE</th><th>SYM</th><th>SIDE</th><th>KIND</th><th>NET</th><th>R</th><th>EXIT</th></tr></thead><tbody>'+
      rows.map(t=>'<tr><td>'+esc(t.date||"")+"</td><td>"+esc(t.symbol)+"</td><td>"+esc(t.side||"")+"</td><td>"+esc(t.kind||"")+
        "</td><td class='"+tone(t.net!=null?t.net:t.pnl)+"'>"+esc(inr(t.net!=null?t.net:t.pnl))+
        "</td><td class='"+tone(t.r)+"'>"+esc(rfmt(t.r))+"</td><td>"+esc(t.exit_reason||t.reason||t.status||"")+"</td></tr>").join("")+
      "</tbody></table>"
    : '<div class="empty">Koi booked BTST result nahi</div>';
}
function tile(name, pct, extra){
  return '<span class="tile" style="background:'+heatColor(pct)+'"><b>'+esc(name)+"</b>"+
    (pct==null?"—":((Number(pct)>0?"+":"")+Number(pct).toFixed(2)+"%"))+
    (extra?" "+esc(extra):"")+"</span>";
}
function renderHeat(d){
  const el=$("heat");
  if(heatMode==="n50"){
    const rows=d.n50_heat||[];
    el.innerHTML=rows.length?rows.map(r=>tile(r.symbol,r.pct,r.ltp!=null?px(r.ltp):"")).join(""):'<div class="empty">Nifty 50 heat nahi mili</div>';
  }else{
    const rows=d.sectors||[];
    el.innerHTML=rows.length?rows.map(r=>tile(r.name,r.pct,r.last!=null?px(r.last):"")).join(""):'<div class="empty">Sector heat nahi mili</div>';
  }
}
function renderResults(r){
  if(!r){["resLine","resAfter","resItems","resUpcoming","resAsOf"].forEach(id=>{const e=$(id); if(e) e.textContent="";}); return}
  $("resAsOf").textContent=[r.date,r.as_of].filter(Boolean).join(" · ");
  $("resLine").textContent=r.line||"";
  $("resAfter").textContent=r.after_close||"";
  const items=r.items||[];
  $("resItems").innerHTML=items.length?("<ul>"+items.map(it=>{
    if(typeof it==="string") return "<li>"+esc(it)+"</li>";
    return "<li>"+esc([it.symbol||it.name,it.date||it.when,it.detail||it.line].filter(Boolean).join(" — "))+"</li>";
  }).join("")+"</ul>"):"";
  $("resUpcoming").textContent=r.upcoming||"";
}
function renderNotes(notes){
  const el=$("notes");
  if(!notes||!notes.length){el.innerHTML='<div class="empty">Koi note nahi</div>';return}
  el.innerHTML=notes.map(n=>'<div class="btnote">'+esc(n.text||"")+
    (n.label?'<div class="m" style="margin-top:4px">'+esc(n.label)+"</div>":"")+"</div>").join("");
}
function renderIndices(idx){
  const el=$("indices");
  const keys=["NIFTY","BANKNIFTY","FINNIFTY","MIDCPNIFTY","SENSEX","INDIAVIX"];
  const bits=keys.filter(k=>idx&&idx[k]).map(k=>{
    const q=idx[k];
    return '<div class="idx"><div class="n">'+esc(k)+'</div><div class="px">'+esc(px(q.ltp))+
      '</div><div class="ch '+tone(q.pct)+'">'+esc(chgLine(q))+"</div></div>";
  });
  el.innerHTML=bits.length?bits.join(""):'<div class="empty">Index quotes nahi mile</div>';
}
function render(){
  clock();
  const badgeEl=$("srcBadge"), live=$("live");
  if(!data){
    badgeEl.className="srcb "+(lastErr?"bad":"warn");
    badgeEl.textContent=lastErr?("● "+lastErr):"● data load ho rahi hai…";
    live.textContent="● —";
    return;
  }
  const age=data.pushed_ms?Math.round((Date.now()-data.pushed_ms)/1000):null;
  badgeEl.className="srcb ok";
  badgeEl.textContent="● GitHub public"+(age!=null?(" · "+(age<90?age+"s":Math.round(age/60)+" min")):"");
  live.className="live "+(data.market?"g":"m");
  live.textContent=data.market?"● MARKET":"● CLOSED";
  $("sessDate").textContent=data.session_date||"—";
  $("upd").textContent=data.pushed?("Updated "+data.pushed+" IST"):"—";
  // disclaimer is fixed in the banner / footer; keep banner text stable
  $("banner").textContent=data.disclaimer||"Paper/demo trading only, not advice";
  renderIndices(data.indices||{});
  renderSetups(data.setups||[]);
  renderBooks(data.books||[]);
  renderBtst(data.btst||null);
  renderHeat(data);
  renderResults(data.results||null);
  renderNotes(data.notes||[]);
}

$("heatBtn").addEventListener("click",()=>{heatMode="sector"; $("heatBtn").classList.add("on"); $("heatBtnN50").classList.remove("on"); if(data) renderHeat(data)});
$("heatBtnN50").addEventListener("click",()=>{heatMode="n50"; $("heatBtnN50").classList.add("on"); $("heatBtn").classList.remove("on"); if(data) renderHeat(data)});
clock(); setInterval(clock,1000);
load(); setInterval(()=>{ if(!document.hidden) load(); }, 30000);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) load(); });
})();
