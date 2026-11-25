/* Public keyless chart. Uses window.NL public feed. No keys, no tunnels, no open P&L. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const f=(n,d=2)=>n==null||isNaN(n)?"—":Number(n).toLocaleString("en-IN",{minimumFractionDigits:d,maximumFractionDigits:d});
const sg=(n,d=2)=>n==null?"—":(n>0?"+":"")+f(n,d);
const cl=v=>v>0?"g":v<0?"p":"dm";
const TFS=["1m","3m","5m","15m","30m","1H","D"];
const q=new URLSearchParams(location.search);
let SYM=String(q.get("symbol")||"NIFTY").toUpperCase();
let TF=TFS.includes(q.get("tf"))?q.get("tf"):"5m";
let chartObj=null;

function linesFromQuery(){
  const out=[];
  const add=(k,kind,label)=>{const v=q.get(k); if(v==null||v==="")return; const n=Number(v); if(!isNaN(n)) out.push({kind,price:n,label});};
  add("level","level","LVL"); add("entry","entry","E"); add("sl","sl","SL"); add("t1","t1","T1"); add("t2","t2","T2");
  return out;
}

function expand(c){return (c&&c.b||[]).map(a=>({time:a[0],open:a[1],high:a[2],low:a[3],close:a[4],volume:a[5]||0}))}
function agg(bars,mins){
  if(!bars||!bars.length) return [];
  if(!mins||mins<=5) return bars;
  const out=[]; let cur=null;
  bars.forEach(b=>{
    const ist=b.time+19800, day=Math.floor(ist/86400)*86400, open=day+9*3600+15*60;
    const st=ist<open?Math.floor(ist/(mins*60))*mins*60:open+Math.floor((ist-open)/(mins*60))*mins*60, key=st-19800;
    if(!cur||cur.time!==key){if(cur)out.push(cur);cur={time:key,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume||0}}
    else{cur.high=Math.max(cur.high,b.high);cur.low=Math.min(cur.low,b.low);cur.close=b.close;cur.volume+=(b.volume||0)}
  });
  if(cur) out.push(cur);
  return out;
}
function daily(bars){
  const out=[]; let cur=null;
  bars.forEach(b=>{
    const day=Math.floor((b.time+19800)/86400)*86400-19800;
    if(!cur||cur.time!==day){if(cur)out.push(cur);cur={time:day,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume||0}}
    else{cur.high=Math.max(cur.high,b.high);cur.low=Math.min(cur.low,b.low);cur.close=b.close;cur.volume+=(b.volume||0)}
  });
  if(cur) out.push(cur);
  return out;
}
function barsOf(sym,tf){
  try{
    const c=NL._synth?NL._synth("/api/candles?symbol="+encodeURIComponent(sym)+"&tf="+encodeURIComponent(tf==="1H"?"30m":tf)) :null;
    if(c&&c.bars&&c.bars.length && (tf!=="1H" && tf!=="D" && tf!=="30m")) return c.bars;
  }catch(e){}
  const raw=((NL.bundle||{}).candles||{})[sym];
  if(!raw||!raw.b) return [];
  const base=expand(raw);
  if(tf==="D") return daily(base);
  const mins={"1m":1,"3m":3,"5m":5,"15m":15,"30m":30,"1H":60}[tf]||5;
  return agg(base, mins);
}
function quote(sym){
  try{
    const lt=((NL.bundle||{}).ltp||{}).quotes||{};
    return lt[sym]||null;
  }catch(e){return null}
}
function symbolList(){
  const set=new Set();
  const b=(NL.bundle||{}).symbols||{};
  (b.n50||[]).forEach(s=>s&&set.add(s));
  (b.indices||[]).forEach(s=>s&&set.add(s));
  (b.extra||[]).forEach(s=>s&&!/\d(CE|PE)$/.test(s)&&set.add(s));
  Object.keys(((NL.bundle||{}).candles)||{}).forEach(s=>s&&!/\d(CE|PE)$/.test(s)&&set.add(s));
  if(SYM) set.add(SYM);
  return [...set].sort();
}

function renderHead(){
  const qte=quote(SYM);
  const px=$("cvPx"), sub=$("cvSub");
  if(px){
    if(qte&&qte.ltp!=null){
      px.innerHTML=`${esc(SYM)} <span class="${cl(qte.chg)}">${f(qte.ltp)}</span> <span class="${cl(qte.chg)}" style="font-size:13px">${sg(qte.chg)} (${sg(qte.pct)}%)</span>`;
    }else px.textContent=SYM;
  }
  if(sub) sub.textContent="Public ·  "+TF+" · paper/demo only · no open P&L";
  document.title=SYM+" · Public chart · paper";
  const badge=$("srcBadge");
  if(badge&&window.NL){try{const b=NL.badgeHTML();badge.className="srcb "+b.cls;badge.innerHTML=b.html}catch(e){}}
  const sel=$("cvSym");
  if(sel){
    const list=symbolList();
    sel.innerHTML=list.map(s=>`<option value="${esc(s)}"${s===SYM?" selected":""}>${esc(s)}</option>`).join("");
  }
  document.querySelectorAll(".cvTfbtn").forEach(b=>b.classList.toggle("on", b.getAttribute("data-tf")===TF));
}

function renderChart(){
  const el=$("cvChart"); if(!el) return;
  const bars=barsOf(SYM, TF);
  const marks=linesFromQuery();
  if(!bars.length){
    el.innerHTML=`<div class="m" style="padding:24px">Is symbol ka public chart data abhi nahi mila (${esc(SYM)}).</div>`;
    return;
  }
  if(window.LightweightCharts){
    el.innerHTML="";
    if(chartObj){try{chartObj.remove()}catch(e){}}
    const ch=LightweightCharts.createChart(el,{
      layout:{background:{color:"#0b0e11"},textColor:"#8b95a5"},
      grid:{vertLines:{color:"#1a1f27"},horzLines:{color:"#1a1f27"}},
      rightPriceScale:{borderColor:"#2a313c"},
      timeScale:{borderColor:"#2a313c",timeVisible:TF!=="D",secondsVisible:false},
      width:el.clientWidth,height:el.clientHeight||280
    });
    const s=ch.addCandlestickSeries({upColor:"#00c853",downColor:"#ff5252",borderVisible:false,wickUpColor:"#00c853",wickDownColor:"#ff5252"});
    s.setData(bars.map(b=>({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close})));
    const cols={level:"#3DDBD9",entry:"#3d8bfd",sl:"#ff5252",t1:"#00c853",t2:"#7cb87c"};
    marks.forEach(m=>{
      s.createPriceLine({price:Number(m.price),color:cols[m.kind]||"#8b95a5",lineWidth:1,lineStyle:2,title:m.label||m.kind,axisLabelVisible:true});
    });
    ch.timeScale().fitContent();
    chartObj=ch;
  }else{
    el.innerHTML=`<div class="m">Chart library load nahi hui.</div>`;
  }
}

function setSym(s){
  SYM=String(s||"NIFTY").toUpperCase();
  const u=new URL(location.href);
  u.searchParams.set("symbol",SYM);
  history.replaceState(null,"",u.toString());
  paint();
}
function setTf(tf){
  if(!TFS.includes(tf)) return;
  TF=tf;
  const u=new URL(location.href);
  u.searchParams.set("tf",TF);
  history.replaceState(null,"",u.toString());
  paint();
}
function paint(){
  if(!window.NL||!NL.status().hasData){
    const el=$("cvChart");
    if(el) el.innerHTML=`<div class="m" style="padding:24px">Public data load ho raha hai…</div>`;
    return;
  }
  renderHead();
  renderChart();
}

function boot(){
  const sel=$("cvSym");
  if(sel) sel.addEventListener("change",()=>setSym(sel.value));
  document.querySelectorAll(".cvTfbtn").forEach(b=>b.addEventListener("click",()=>setTf(b.getAttribute("data-tf"))));
  window.addEventListener("resize",()=>{if(window.NL&&NL.status().hasData) renderChart()});
  const ready=()=>{if(window.NL&&NL.status().hasData){paint();return true}return false};
  if(!ready()){
    if(window.NL&&NL.onChange) NL.onChange(()=>{if(NL.status().hasData) paint()});
    const t=setInterval(()=>{if(ready()) clearInterval(t)},400);
  }
}
if($("cvPage")) boot();
})();
