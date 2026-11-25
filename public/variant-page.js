/* Variants tab pages. Reads ?v=AA|MECH|CAP2|...|EXPIRY_*, uses window.NL. Paper/demo only. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const f=(n,d=2)=>n==null||isNaN(n)?"—":Number(n).toLocaleString("en-IN",{minimumFractionDigits:d,maximumFractionDigits:d});
const sg=(n,d=2)=>n==null?"—":(n>0?"+":"")+f(n,d);
const cl=v=>v>0?"g":v<0?"p":"dm";

function pagesRoot(){
  const D=(window.NL&&NL.bundle&&NL.bundle.dash)||{};
  return D.variant_pages||{};
}
function orderOf(root){
  const vs=(root&&root.variants)||{};
  const ord=(root&&root.order)||Object.keys(vs);
  return (ord||[]).filter(n=>vs[n]);
}
function paramV(){
  const root=pagesRoot();
  const ord=orderOf(root);
  const v=String(new URLSearchParams(location.search).get("v")||ord[0]||"AA").toUpperCase();
  return ord.includes(v)?v:(ord[0]||"AA");
}
function variant(name){
  const root=pagesRoot();
  return (root.variants&&root.variants[name])||null;
}

function sparkSvg(bars, marks, w, h){
  w=w||320; h=h||88;
  if(!bars||!bars.length){
    return `<svg class="iceSpark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><text x="8" y="${h/2}" fill="#8b95a5" font-size="10">no chart data</text></svg>`;
  }
  const pad=6, ys=bars.map(b=>[b.high,b.low,b.close,b.open]).flat().filter(x=>x!=null);
  marks=(marks||[]).filter(m=>m&&m.price!=null);
  marks.forEach(m=>ys.push(Number(m.price)));
  let lo=Math.min.apply(null,ys), hi=Math.max.apply(null,ys);
  if(!(hi>lo)){hi=lo+1}
  const span=hi-lo;
  lo-=span*0.06; hi+=span*0.06;
  const x=i=>pad+(i/(bars.length-1||1))*(w-pad*2);
  const y=p=>pad+(1-(Number(p)-lo)/(hi-lo))*(h-pad*2);
  const line=bars.map((b,i)=>`${i?"L":"M"}${x(i).toFixed(1)} ${y(b.close).toFixed(1)}`).join(" ");
  const colors={level:"#3DDBD9",entry:"#3d8bfd",sl:"#ff5252",t1:"#00c853",t2:"#7cb87c",exit:"#ffb300"};
  const lines=marks.map(m=>{
    const yy=y(m.price);
    const col=colors[m.kind]||"#8b95a5";
    return `<line x1="${pad}" x2="${w-pad}" y1="${yy}" y2="${yy}" stroke="${col}" stroke-dasharray="3 3" stroke-width="1" opacity=".7"/>`;
  }).join("");
  return `<svg class="iceSpark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${lines}<path d="${line}" fill="none" stroke="#e8ecf1" stroke-width="1.2"/>${bars.map((b,i)=>{const up=b.close>=b.open;return `<rect x="${x(i)-1.2}" y="${Math.min(y(b.open),y(b.close))}" width="2.4" height="${Math.max(1,Math.abs(y(b.close)-y(b.open)))}" fill="${up?"#00c853":"#ff5252"}"/>`;}).join("")}</svg>`;
}

function barsOf(sym){
  try{
    const c=NL._synth?NL._synth("/api/candles?symbol="+encodeURIComponent(sym)+"&tf=5m"):null;
    if(c&&c.bars&&c.bars.length) return c.bars;
  }catch(e){}
  const raw=((NL.bundle||{}).candles||{})[sym];
  if(!raw||!raw.b) return [];
  return raw.b.map(a=>({time:a[0],open:a[1],high:a[2],low:a[3],close:a[4],volume:a[5]||0}));
}

function pnlOf(st){
  const tod=st&&(st.today||{})||{};
  return tod.total_pnl!=null?tod.total_pnl:tod.pnl;
}
function rOf(st){
  const tod=st&&(st.today||{})||{};
  return tod.total_r!=null?tod.total_r:tod.r;
}
function allPnl(st){
  const all=st&&(st.all||{})||{};
  return all.total_pnl!=null?all.total_pnl:all.pnl;
}
function allR(st){
  const all=st&&(st.all||{})||{};
  return all.total_r!=null?all.total_r:all.r;
}

function cardHtml(v, href){
  const st=v.stats||{};
  const nw=(v.watch||[]).length, nl=(v.live||[]).length, nc=(v.closed_today||[]).length;
  const sym=v.chart_symbol||"NIFTY";
  const marks=(v.marks||[]).filter(m=>m.symbol===sym);
  const svg=sparkSvg(barsOf(sym), marks);
  const sh=!!v.shadow;
  const badge=sh?`<span class="iceVarShadow">shadow, not in booked P&amp;L</span>`:`<span class="iceVarOfficial">${esc(v.info||v.family||"official")}</span>`;
  return `<a class="iceVarCard${sh?" shadow":""}" href="${esc(href)}">
    <div class="iceVarH"><b>${esc(v.name||v.book||"")}</b><span class="iceVarOpen">Open page →</span></div>
    <div class="iceVarDesc">${esc(v.label||v.book||"")} · PAPER ONLY</div>
    ${badge}
    ${svg}
    <div class="iceVarMeta">${esc(sym)} · 5m · WATCH ${nw} · LIVE ${nl} · CLOSED today ${nc}</div>
    <div class="iceVarStats">
      <span>TODAY <b class="${cl(pnlOf(st))}">₹${sg(pnlOf(st),0)} / ${sg(rOf(st),2)}R</b></span>
      <span>ALL <b class="${cl(allPnl(st))}">₹${sg(allPnl(st),0)} / ${sg(allR(st),2)}R</b></span>
    </div>
  </a>`;
}

function dirMark(r){
  return /SELL|SHORT/i.test(r.direction||r.side||"")?`<span class="p">▼</span>`:`<span class="g">▲</span>`;
}
function rowCard(r, kind){
  const st=String(r.status||"").toUpperCase();
  const e=r.entry!=null||r.fill!=null?`E <b class="dm">${f(r.entry!=null?r.entry:r.fill)}</b>`:"";
  const sl=r.sl!=null?`SL <b class="p">${f(r.sl)}</b>`:"";
  const t1=r.t1!=null?`T1 <b class="g">${f(r.t1)}</b>`:"";
  const t2=r.t2!=null?`T2 <b class="g">${f(r.t2)}</b>`:"";
  const lots=(r.lots||r.qtyOpenLots||r.qty)?`${esc(r.lots!=null?r.lots:(r.qtyOpenLots||"—"))}${r.lot?"×"+esc(r.lot):""}`:"";
  const opt=r.contract?`<div class="m">OPT ${esc(r.contract)}</div>`:"";
  const awaitT=(r.awaiting||r.triggerText||r.note||(kind==="watch"?r.reason:""))?`<div class="m">${esc(r.awaiting||r.triggerText||r.note||r.reason||"")}</div>`:"";
  let booked="";
  if(kind==="closed"){
    booked=`<div class="lv"><span class="m">P&amp;L <b class="${cl(r.pnl)}">₹${sg(r.pnl,0)}</b></span><span class="m">R <b class="${cl(r.r)}">${sg(r.r,2)}R</b></span></div>`;
  }
  // never show open/unrealised P&L
  return `<div class="card iceberg${kind==="watch"?" watch":""}${kind==="closed"?" closed":""}">
    <div class="h">${dirMark(r)} <b>${esc(r.symbol||"")}</b>
      <span class="tagIce">${esc(r.book||"VAR")} · paper</span>
      <span class="badge">${esc(st)}</span>
      <span class="m">${esc(r.time_ist||r.time||"")}</span>
    </div>
    <div class="lv">${e} ${sl} ${t1} ${t2} ${lots?`<span class="m">LOTS <b>${lots}</b></span>`:""}</div>
    ${opt}${awaitT}${booked}
  </div>`;
}

function renderSections(v){
  const watch=v.watch||[], live=v.live||[], closed=v.closed_today||[];
  $("watch").innerHTML=watch.length?watch.map(r=>rowCard(r,"watch")).join(""):`<div class="m">no armed signals</div>`;
  $("live").innerHTML=live.length?live.map(r=>rowCard(r,"live")).join(""):`<div class="m">no open / traded positions</div>`;
  $("closed").innerHTML=closed.length?closed.map(r=>rowCard(r,"closed")).join(""):`<div class="m">aaj koi booked trade nahi</div>`;
}

function renderStats(v){
  const st=v.stats||{};
  $("stats").innerHTML=`
    <div class="box"><div class="k">TODAY · booked</div><div class="v ${cl(pnlOf(st))}">₹${sg(pnlOf(st),0)} <span style="font-size:12px">/ ${sg(rOf(st),2)}R</span></div></div>
    <div class="box"><div class="k">ALL · booked</div><div class="v ${cl(allPnl(st))}">₹${sg(allPnl(st),0)} <span style="font-size:12px">/ ${sg(allR(st),2)}R</span></div></div>
    <div class="box"><div class="k">WATCH / LIVE</div><div class="v">${(v.watch||[]).length} / ${(v.live||[]).length}</div></div>
    <div class="box"><div class="k">CLOSED TODAY</div><div class="v">${(v.closed_today||[]).length}</div></div>`;
  const desc=$("varDesc");
  if(desc){
    const sh=v.shadow? " · shadow, not in booked P&L":"";
    desc.textContent=(v.label||v.book||"")+" — "+(v.desc||"")+sh+" · PAPER ONLY";
  }
}

let chartObj=null;
function renderChartBox(v, sym){
  const title=$("chartTitle");
  if(title) title.textContent=(v.name||v.book||"VAR")+" · "+sym+" · 5m";
  const marks=(v.marks||[]).filter(m=>m.symbol===sym);
  const bars=barsOf(sym);
  const el=$("iceChart");
  if(!el) return;
  if(window.LightweightCharts && bars.length){
    el.innerHTML="";
    if(chartObj){try{chartObj.remove()}catch(e){}}
    const ch=LightweightCharts.createChart(el,{
      layout:{background:{color:"#0b0e11"},textColor:"#8b95a5"},
      grid:{vertLines:{color:"#1a1f27"},horzLines:{color:"#1a1f27"}},
      rightPriceScale:{borderColor:"#2a313c"},
      timeScale:{borderColor:"#2a313c",timeVisible:true},
      width:el.clientWidth,height:el.clientHeight||240
    });
    const s=ch.addCandlestickSeries({upColor:"#00c853",downColor:"#ff5252",borderVisible:false,wickUpColor:"#00c853",wickDownColor:"#ff5252"});
    s.setData(bars.map(b=>({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close})));
    const cols={level:"#3DDBD9",entry:"#3d8bfd",sl:"#ff5252",t1:"#00c853",t2:"#7cb87c",exit:"#ffb300"};
    const seen={};
    marks.forEach(m=>{
      const k=m.kind+"|"+m.price;
      if(seen[k]||m.price==null)return;seen[k]=1;
      s.createPriceLine({price:Number(m.price),color:cols[m.kind]||"#8b95a5",lineWidth:1,lineStyle:2,title:m.label||m.kind,axisLabelVisible:true});
    });
    ch.timeScale().fitContent();
    chartObj=ch;
  }else{
    el.innerHTML=sparkSvg(bars, marks, Math.max(320,el.clientWidth||320), el.clientHeight||240);
  }
}

function fillSymSel(v, current){
  const sel=$("symSel"); if(!sel) return;
  const syms=v.symbols&&v.symbols.length?v.symbols.slice():[v.chart_symbol||"NIFTY"];
  if(!syms.includes(current)) syms.unshift(current);
  sel.innerHTML=syms.map(s=>`<option value="${esc(s)}"${s===current?" selected":""}>${esc(s)}</option>`).join("");
}

function paint(){
  const name=paramV();
  const v=variant(name);
  const ttl=$("varName"); if(ttl) ttl.textContent=name;
  document.title="Variant · "+name+" · paper";
  const badge=$("srcBadge");
  if(badge&&window.NL){try{const b=NL.badgeHTML();badge.className="srcb "+b.cls;badge.innerHTML=b.html}catch(e){}}
  if(!v){
    $("stats").innerHTML=`<div class="m">Yeh variant load nahi hua. Dashboard se wapas try karo.</div>`;
    $("watch").innerHTML=$("live").innerHTML=$("closed").innerHTML="";
    return;
  }
  renderStats(v);
  renderSections(v);
  const sym=($("symSel")&&$("symSel").value)||v.chart_symbol||"NIFTY";
  fillSymSel(v, sym);
  renderChartBox(v, sym);
}

function boot(){
  const sel=$("symSel");
  if(sel) sel.addEventListener("change",()=>{
    const v=variant(paramV()); if(v) renderChartBox(v, sel.value);
  });
  window.addEventListener("resize",()=>{
    const v=variant(paramV()); if(v) renderChartBox(v, ($("symSel")&&$("symSel").value)||v.chart_symbol);
  });
  const ready=()=>{if(window.NL&&NL.status().hasData){paint();return true}return false};
  if(!ready()){
    if(window.NL&&NL.onChange) NL.onChange(()=>{if(NL.status().hasData) paint()});
    const t=setInterval(()=>{if(ready()) clearInterval(t)},500);
  }
}

window.variantCards=function(baseHref){
  const root=pagesRoot();
  const order=orderOf(root);
  if(!order.length) return "";
  return `<div class="iceVarGrid varGrid">`+order.map(n=>{
    const href=(baseHref||"variant.html")+"?v="+encodeURIComponent(n);
    return cardHtml(root.variants[n], href);
  }).join("")+`</div>`;
};

if($("varPage")) boot();
})();
