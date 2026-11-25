(function(){
const K=new URLSearchParams(location.search).get("k")||"";
const api=p=>NL.api(p);
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const f=(n,d=2)=>n==null||isNaN(n)?"—":Number(n).toLocaleString("en-IN",{minimumFractionDigits:d,maximumFractionDigits:d});
const sg=(n,d=2)=>n==null?"—":(n>0?"+":"")+f(n,d);
const cl=v=>v>0?"g":v<0?"p":"dm";
const tv=s=>"https://www.tradingview.com/chart/?symbol="+encodeURIComponent(s==="NIFTY"?"NSE:NIFTY":"NSE:"+s.replace(/[&-]/g,"_"));
const ON_PUBLIC=/\/public\//.test(location.pathname);
function rememberedKey(){
  if(K) return K;
  try{const s=localStorage.getItem("nl_k")||"";if(s&&/^[0-9a-f]{16,64}$/.test(s)) return s}catch(e){}
  return "";
}
const lc=(s,opt)=>{
  if(ON_PUBLIC) return "chart-view.html?symbol="+encodeURIComponent(s)+(opt?"&tab=option":"");
  const k=rememberedKey();
  if(!k) return "public/chart-view.html?symbol="+encodeURIComponent(s)+(opt?"&tab=option":"");
  return "chart.html?k="+encodeURIComponent(k)+"&symbol="+encodeURIComponent(s)+(opt?"&tab=option":"");
};
const ist=()=>new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false});
let L={},D=null,lastOk=0,ltpAge=null,quoteAsOf=null;
$("niftyTv").href=tv("NIFTY");
let chartTf=localStorage.getItem("chartTf")||"5m";
if(!/^(1m|3m|5m|15m|30m|1H|D)$/.test(chartTf)) chartTf="5m";
let chartSym=localStorage.getItem("chartSym")||"NIFTY";
let wlFilter="";
let brokersCache=null;

function heatBg(p){if(p==null)return"#222";const a=Math.min(1,Math.abs(p)/3)*0.75+0.12;return p>=0?`rgba(0,229,160,${a})`:`rgba(255,45,149,${a})`;}
function renderLive(){
 const age=ltpAge==null?null:Math.max(0,ltpAge)+(lastOk?(Date.now()-lastOk)/1000:0);
 const ok=lastOk&&Date.now()-lastOk<10000&&age!=null&&age<10;
 const e=$("live");e.className="live "+(ok?"g":"m");e.textContent=(ok?"FRESH POLL ● ":"STALE ● ")+(age==null?"—":Math.round(age)+"s");
}
function renderCounters(){
 const n=L.NIFTY,v=L.INDIAVIX;
 let h=`<span class="ctr"><span class="k">NIFTY</span><span class="v ${n?cl(n.chg):""}">${n?f(n.ltp):"—"}</span><span class="d ${n?cl(n.chg):""}">${n?sg(n.chg)+" ("+sg(n.pct)+"%)":""}</span></span>`;
 h+=`<span class="ctr"><span class="k">VIX</span><span class="v b">${v?f(v.ltp):"—"}</span><span class="d ${v?cl(v.pct):""}">${v?sg(v.pct)+"%":""}</span></span>`;
 const _aN=((D&&D.state&&D.state.setups)||[]).filter(x=>(x.grade==="A"||x.grade==="A+")&&String(x.status||"").toUpperCase()!=="WATCH").length;const _gc=(D&&D.counts)||{};((D&&D.state&&D.state.counters)||[]).forEach(c=>{c=Object.assign({},c);if(/^P\s*&\s*L$|PNL|P&L/i.test(c.k||""))return;if(c.k==="GRADED TODAY"&&_gc.graded!=null)c.v=String(_gc.graded);if(c.k==="A / A+")c.v=String(Math.max(_aN,parseInt((_gc.a_or_a_plus!=null?_gc.a_or_a_plus:c.v))||0));h+=`<span class="ctr"><span class="k">${esc(c.k)}</span><span class="v ${c.tone==="pink"?"p":c.tone==="green"?"g":c.tone==="amber"?"a":"b"}">${esc(c.v)}</span></span>`});
 $("ctrs").innerHTML=h;
}
function iceTime(t){
 if(!t)return "—";
 const s=String(t),m=s.match(/T(\d{2}:\d{2}:\d{2})/);
 if(m)return m[1];
 try{return new Date(s).toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false})}catch(e){return s}
}
function iceInv(r){return r&&r.inverted?` <span class="bf" title="${esc(r.invert_why||("inverted: signal "+(r.signal_direction||"")+" → traded opposite"))}">INV${r.signal_direction?" of "+esc(r.signal_direction):""}</span>`:""}
function iceSigTable(rows, cols){
 if(!rows||!rows.length)return "";
 const th=cols.map(c=>`<th>${c[0]}</th>`).join("");
 const body=rows.map(r=>{
  const dir=String(r.direction||"");
  const dc=/SELL/i.test(dir)?"sell":(/BUY/i.test(dir)?"buy":"dm");
  const st=String(r.status||"");
  const sltxt=(st==="T1_DONE"&&r.sl!=null)?(String(r.sl)+" cost"):(r.sl??"—");
  const pR0=icePremR(r);
  const rr=pR0!=null?sg(pR0,2)+"R":(r.r!=null?sg(Number(r.r),2)+"R":"—");
  const rlab=r.r_label||(r.pnl_mode==="option_premium"?"premium R (fill basis)":(r.pnl_mode==="premium_na"?"spot R":""));
  let pn="";
  if(r.pnl_mode==="premium_na") pn="premium n/a";
  else if(r.pnl!=null) pn="₹"+sg(Number(r.pnl),0);
  else if(String(r.status||"").toUpperCase()!=="CLOSED") pn="—";
  const lots=r.lots||2, lot=r.lot, typ=r.option_type||"";
  const strike=r.option_strike!=null?r.option_strike:"";
  const cname=r.contract?esc(r.contract):"";
  const optHead=r.contract?`${cname}${strike!==""?` ${esc(String(strike))}${esc(typ)}`:""}${lot?` · ${lots}×${lot}`:""}`:"";
  const eP=r.premium_entry!=null?sg(Number(r.premium_entry),2):"";
  const x1=r.lot1_premium_exit, x2=r.lot2_premium_exit, xL=r.premium_ltp;
  let xP="";
  if(x1!=null&&x2!=null) xP=sg(Number(x1),2)+(Number(x1)===Number(x2)?"":"/"+sg(Number(x2),2));
  else if(x1!=null) xP=sg(Number(x1),2)+(xL!=null?" / ltp "+sg(Number(xL),2):"");
  else if(xL!=null) xP="ltp "+sg(Number(xL),2);
  const pLv=r.exit_basis==="premium"&&r.premium_sl!=null?` · PSL ${esc(String(r.premium_sl))}${st==="T1_DONE"&&r.premium_sl_now!=null?"→"+esc(String(r.premium_sl_now)):""} · PT1 ${esc(String(r.premium_t1??"—"))} · PT2 ${esc(String(r.premium_t2??"—"))}`:"";
  const optLine=r.pnl_mode==="premium_na"?"premium n/a":(optHead?(eP?`${optHead} · E ${eP}${xP?` → ${xP}`:""}${pLv}`:optHead+pLv):"");
  return `<tr><td class="dm">${esc(r.time_ist||iceTime(r.ts))}</td><td><b>${esc(r.symbol||"")}</b></td><td class="${dc}">${esc(dir||"—")}${iceInv(r)}</td><td>${esc(r.iceberg_level??"—")}</td><td>${esc(r.entry??"—")}</td><td>${esc(sltxt)}</td><td>${esc(r.t1??"—")}</td><td>${esc(r.t2??"—")}</td><td class="st-${esc(st)}">${esc(st)}${r.backfill?` <span class="bf">backfill</span>`:""}${r.invalid||st==="INVALID_DAY"?` <span class="bf">invalid 17 Nov</span>`:""}</td><td class="opt">${esc(rr)}${pn&&r.pnl_mode!=="premium_na"?" "+pn:""}${r.pnl_mode==="premium_na"?` <span class="m">premium n/a</span>`:""}${rlab?` <span class="m">${esc(rlab)}</span>`:""}${optLine?`<div class="m">${optLine}</div>`:""}</td></tr>`;
 }).join("");
 return `<div class="iceSigWrap"><table><tr>${th}</tr>${body}</table></div>`;
}
function iceChartUrl(r,opt){
 let u=lc(r.symbol,opt);
 const add=(k,v)=>{if(v!=null&&v!=="")u+="&"+k+"="+encodeURIComponent(v)};
 add("src","iceberg");
 add("side",/SELL/i.test(r.direction||"")?"SHORT":"LONG");
 if(r.entry!=null)add("entry",r.entry);
 const sl=r.orig_sl!=null?r.orig_sl:r.sl; if(sl!=null)add("sl",sl);
 if(r.t1!=null)add("t1",r.t1);
 if(r.t2!=null)add("t2",r.t2);
 if(r.iceberg_level!=null)add("level",r.iceberg_level);
 const tm=String(r.time_ist||"").match(/(\d{1,2}:\d{2})/);
 if(tm)add("time",tm[1]);
 if(r.status)add("status",r.status);
 return u;
}
function iceOptLine(r){
 const st=String(r.status||"").toUpperCase();
 if(st==="ARMED"&&!r.contract) return "";
 if(!r.contract&&r.pnl_mode!=="premium_na"&&r.pnl==null&&r.upnl==null&&r.premium_entry==null) return "";
 const bits=[];
 if(r.contract) bits.push(`<b class="a">${esc(r.contract)}</b>`);
 if(r.option_strike!=null) bits.push(esc((r.option_type||"")+" "+r.option_strike));
 if(r.lots&&r.lot) bits.push(esc(r.lots+"×"+r.lot));
 if(r.premium_entry!=null) bits.push(`E <b class="dm">${f(r.premium_entry)}</b>`);
 if(r.entry_bid!=null&&r.entry_ask!=null) bits.push(`bid/ask <b class="dm">${f(r.entry_bid)}/${f(r.entry_ask)}</b>`);
 const ex=r.premium_exit!=null?r.premium_exit:null;
 if(ex!=null) bits.push(`→ <b class="dm">${f(ex)}</b>`);
 else if(r.premium_ltp!=null) bits.push(`LTP <b class="dm">${f(r.premium_ltp)}</b>`);
 if(r.pnl!=null) bits.push(`<b class="${cl(r.pnl)}">₹${sg(r.pnl,0)}</b>`);
 else if(String(r.status||"").toUpperCase()!=="CLOSED") bits.push("status only");
 else if(r.pnl_mode==="premium_na") bits.push("premium n/a");
 if(r.r!=null&&st==="CLOSED") bits.push(`<b class="${cl(r.r)}">${sg(r.r,2)}R</b>`);
 if(r.r_label) bits.push(`<span class="m">${esc(r.r_label)}</span>`);
 return `<div class="lv optline"><span class="m">OPT ${bits.join(" · ")}</span></div>`;
}
function icePremLine(r){
 if(r.exit_basis!=="premium"||r.premium_sl==null) return "";
 const st=String(r.status||"").toUpperCase();
 const cost=st==="T1_DONE"&&r.premium_sl_now!=null&&Number(r.premium_sl_now)!==Number(r.premium_sl);
 const rk=r.premium_risk!=null?Number(r.premium_risk):null;
 const rs=rk&&r.lot?" · ₹"+Math.round(rk*r.lot*(r.lots||2)):"";
 return `<div class="lv premLv"><span class="m">PREM SL <b class="p">${f(r.premium_sl)}</b>${cost?` → cost <b class="dm">${f(r.premium_sl_now)}</b>`:""}</span><span class="m">P-T1 <b class="g">${f(r.premium_t1)}</b></span><span class="m">P-T2 <b class="g">${r.premium_t2!=null?f(r.premium_t2):"—"}</b></span><span class="m">R on premium${rk?" (1R "+f(rk)+"/unit"+rs+")":""}</span></div>`;
}
function icePremR(r){
 if(r.exit_basis!=="premium") return null;
 const st=String(r.status||"").toUpperCase();
 if(st==="CLOSED") return r.r!=null?Number(r.r):null;
 if(r.uR!=null) return Number(r.uR);
 const rk=Number(r.premium_risk), pe=Number(r.premium_entry), lp=Number(r.premium_ltp);
 if(rk>0&&!isNaN(pe)&&!isNaN(lp)) return (lp-pe)/rk;
 return null;
}
function icebergCard(r){
 const dir=String(r.direction||"");
 const buy=!/SELL/i.test(dir);
 const st=String(r.status||"ARMED").toUpperCase();
 const armed=st==="ARMED";
 const q=L[r.symbol];
 const entry=r.entry, sl=r.orig_sl!=null?r.orig_sl:r.sl, t1=r.t1, t2=(+r.t2>0)?r.t2:null;
 const risk=Math.abs((entry||0)-(sl||0)), sgn=buy?1:-1;
 let liveR=null;
 const pR=armed?null:icePremR(r);
 if(pR!=null) liveR=pR;
 else if(!armed&&st!=="CLOSED"&&q&&risk) liveR=sgn*(q.ltp-entry)/risk;
 else if(st==="CLOSED"&&r.r!=null) liveR=Number(r.r);
 const badgeSt=armed?"a":(st==="OPEN"||st==="T1_DONE"?"g":"m");
 let badge=`<span class="tagIce">ICEBERG · paper</span>${iceInv(r)} <span class="badge ${badgeSt}" style="border:1px ${armed?"dotted":"solid"} currentColor">${armed?"ARMED":esc(st)}${r.outcome&&st==="CLOSED"?" · "+esc(r.outcome):""}${r.backfill?' <span class="bf">backfill</span>':""}</span>`;
 const cls=" iceberg"+(armed?" watch":"")+(st==="CLOSED"?" closed":"");
 const note=armed?(r.awaiting||dir):"";
 const lv=armed
  ? `<div class="lv iceLv"><span class="m">LEVEL <b class="a">${f(r.iceberg_level)}</b></span>${r.awaiting?`<span class="m" style="grid-column:span 1">${esc(r.awaiting)}</span>`:""}</div>`
  : `<div class="lv"><span class="m">E <b class="dm">${f(entry)}</b></span><span class="m">SL <b class="p">${f(sl)}</b></span><span class="m">T1 <b class="g">${f(t1)}</b></span>${t2?`<span class="m">T2 <b class="g">${f(t2)}</b></span>`:""}</div>${r.iceberg_level!=null?`<div class="lv" style="grid-template-columns:1fr"><span class="m">ICEBERG <b class="a">${f(r.iceberg_level)}</b></span></div>`:""}`;
 return `<div class="card${cls}"><div class="h"><span><b class="${buy?"g":"p"}">${buy?"▲":"▼"} ${esc(r.symbol)}</b> ${badge} <span class="m">${esc(r.time_ist||"")}</span></span>
 <span>${q?f(q.ltp):"—"}${liveR==null?"":` <b class="${cl(liveR)}">${liveR>0?"+":""}${liveR.toFixed(2)}R</b>`}</span></div>
 ${lv}
 ${armed?"":icePremLine(r)}
 ${armed?"":iceOptLine(r)}
 ${note?`<div class="dm" style="font-size:11px;margin-bottom:4px;white-space:normal">${esc(note)}</div>`:""}
 ${stockNewsHtml({symbol:r.symbol})}
 <div class="btns"><a class="btn" href="${iceChartUrl(r)}" target="${ON_PUBLIC?"_self":"_blank"}">Live Chart</a><a class="btn" href="${iceChartUrl(r,1)}" target="${ON_PUBLIC?"_self":"_blank"}">Option</a><a class="btn" href="${tv(r.symbol)}" target="_blank" rel="noreferrer">TradingView</a></div></div>`;
}
function iceSkipReason(r){
 const raw=String((r&&r.skip_reason)||"");
 if(/PREMIUM_MOVE_TOO_SMALL/.test(raw)) return "skipped: premium move too small";
 if(raw) return "skipped: "+raw;
 return "skipped";
}
function iceSkipRow(r){
 const raw=String(r.skip_reason||"");
 const extra=/PREMIUM_MOVE_TOO_SMALL/.test(raw)&&raw.length>24?` <span class="m">${esc(raw.replace(/^PREMIUM_MOVE_TOO_SMALL\s*/,""))}</span>`:"";
 return `<div class="iceSkipRow st-SKIPPED"><span class="iceSkipT">${esc(r.time_ist||"")}</span><b>${esc(r.symbol||"")}</b> ${esc(r.direction||"")} · ${esc(iceSkipReason(r))}${extra}</div>`;
}
function iceNum(n,d){const x=Number(n);return n==null||n===""||isNaN(x)?"—":f(x,d)}
function iceWr(v){const x=Number(v);if(v==null||v===""||isNaN(x))return "—";return (Math.abs(x-Math.round(x))<1e-9?String(Math.round(x)):x.toFixed(1))+"%"}
function iceExitPx(r){
 const closed=String(r.status||"").toUpperCase()==="CLOSED";
 if(!closed) return "—";
 const x1=r.lot1_premium_exit, x2=r.lot2_premium_exit, px=r.premium_exit;
 const a=x1!=null?iceNum(x1,2):"";
 const b=x2!=null?iceNum(x2,2):"";
 if(a&&b) return a===b?a:a+"/"+b;
 if(a) return a;
 if(b) return b;
 if(px!=null) return iceNum(px,2);
 return "—";
}
function iceRowPnl(r){
 // GH / public: booked P&L only — never open/unrealised
 const closed=String(r.status||"").toUpperCase()==="CLOSED";
 if(!closed) return null;
 const v=r.pnl;
 return v==null||isNaN(Number(v))?null:Number(v);
}
function iceRowR(r){
 const closed=String(r.status||"").toUpperCase()==="CLOSED";
 if(!closed) return null;
 const v=r.r;
 return v==null||isNaN(Number(v))?null:Number(v);
}
function iceRowWhy(r){
 const st=String(r.status||"");
 const a=r.lot1_exit_reason, b=r.lot2_exit_reason;
 if(r.outcome) return st+(r.backfill?" backfill":"")+" · "+r.outcome;
 if(a&&b) return st+" · "+a+(a===b?"":"+"+b);
 if(a) return st+" · L1 "+a+(r.lot2_open?" · L2 open":"");
 return st||"—";
}
function iceBookTables(sig){
 const rows=(sig.rows||[]).filter(r=>!r.backfill && /^(OPEN|T1_DONE|CLOSED)$/.test(String(r.status||"")));
 const open=rows.filter(r=>r.status!=="CLOSED");
 const closed=rows.filter(r=>r.status==="CLOSED");
 const tr=r=>{
  const dir=r.direction||"—";
  const lots=(r.lots||2)+(r.lot?"×"+r.lot:"");
  const pnl=iceRowPnl(r), rr=iceRowR(r);
  const pn=pnl==null?"—":("₹"+sg(pnl,0));
  const rs=rr==null?"—":sg(rr,2)+"R";
  return `<tr><td><span class="${/SELL/i.test(dir)?"p":"g"}">${/SELL/i.test(dir)?"▼":"▲"}</span> ${esc(r.symbol||"")}</td><td>${esc(dir)}${iceInv(r)}</td><td style="white-space:normal">${esc(r.contract||"—")}</td><td>${esc(lots)}</td><td>${r.premium_entry==null?"—":iceNum(r.premium_entry,2)}</td><td>${iceExitPx(r)}</td><td class="${pnl==null?"dm":cl(pnl)}">${pn}</td><td class="${rr==null?"dm":cl(rr)}">${rs}</td><td>${esc(iceRowWhy(r))}</td></tr>`;
 };
 const th=`<tr><th>SYMBOL</th><th>SIDE</th><th>OPTION</th><th>LOTS</th><th>ENTRY</th><th>EXIT</th><th>₹ P&amp;L</th><th>R</th><th>STATUS</th></tr>`;
 let h=`<div class="aaSub">DEMO TRADES · this book's P&amp;L (option premium)</div>`;
 h+=`<table>${th}<tr><th colspan="9" class="m" style="padding-top:4px">OPEN</th></tr>`+(open.map(tr).join("")||`<tr><td colspan="9" class="m">no open positions</td></tr>`)+`</table>`;
 if(closed.length) h+=`<table style="margin-top:4px">${th}<tr><th colspan="9" class="m" style="padding-top:4px">CLOSED</th></tr>`+closed.map(tr).join("")+`</table>`;
 return h;
}
function iceStatsBlock(sig){
 const st=sig.stats||{}, all=st.all||{}, tod=st.today||{}, bf=st.backfill_excluded||{};
 const closed=tod.trades||0, open=st.open_now||0;
 const tp=tod.total_pnl, tr=tod.total_r, ap=all.total_pnl, ar=all.total_r;
 let h=`<div class="stats" id="iceStats">today <b class="${cl(tp)}">₹${sg(tp,0)} / ${sg(tr,2)}R</b> · closed ${closed} · open ${open} · win ${iceWr(tod.win_rate)} (${closed}) · all <b class="${cl(ap)}">₹${sg(ap,0)} / ${sg(ar,2)}R</b></div>`;
 h+=`<div class="lv" style="grid-template-columns:repeat(2,1fr)"><span class="m">TODAY <b class="${cl(tp)}">₹${sg(tp,0)} / ${sg(tr,2)}R</b></span><span class="m">CLOSED / OPEN <b>${closed} / ${open}</b></span><span class="m">ALL <b class="${cl(ap)}">₹${sg(ap,0)} / ${sg(ar,2)}R</b></span><span class="m">WIN <b class="a">${iceWr(tod.win_rate)} (${tod.wins!=null?tod.wins+"W · ":""}${closed})</b></span></div>`;
 const bfN=(bf.closed_trades||0)+(bf.open_or_t1||0);
 if(tod.charges!=null||all.charges!=null) h+=`<div class="m" style="margin:2px 0 4px">NET (charges + slippage alag): today <b class="${cl(tod.total_pnl_net)}">₹${sg(tod.total_pnl_net,0)} / ${sg(tod.total_r_net,2)}R</b> · charges ₹${f(tod.charges||0,0)} · slippage ₹${f(tod.slippage||0,0)} · all net <b class="${cl(all.total_pnl_net)}">₹${sg(all.total_pnl_net,0)} / ${sg(all.total_r_net,2)}R</b> · charges ₹${f(all.charges||0,0)} · slippage ₹${f(all.slippage||0,0)}</div>`;
 if(bfN) h+=`<div class="m" style="margin:2px 0 4px">backfill excluded: ${bf.closed_trades||0} trades · ₹${sg(bf.total_pnl,0)} / ${sg(bf.total_r,2)}R (not in totals above)</div>`;
 if(st.note) h+=`<div class="m" style="margin:2px 0 4px;color:#F5A524">${esc(st.note_text||st.note)}</div>`;
 if(all.premium_na_trades) h+=`<div class="m">${all.premium_na_trades} premium n/a (excluded from ₹ totals)</div>`;
 h+=iceBookTables(sig);
 return h;
}
let ICE_BOOK=(new URLSearchParams(location.search).get("book")||"").toUpperCase()||localStorage.getItem("iceBook")||"BASE";
function iceBookTabs(sig){
 const books=sig.books||{}, order=(sig.book_order||Object.keys(books)).filter(n=>books[n]);
 if(!order.length) return "";
 return `<div class="iceBookTabs">`+order.map(n=>{
  const st=(books[n]||{}).stats||{}, t=st.today||{}, a=st.all||{};
  return `<button type="button" class="iceBookBtn${n===ICE_BOOK?" on":""}" data-book="${esc(n)}"><b class="bn">${esc(n)}</b>today <b class="${cl(t.total_pnl)}">₹${sg(t.total_pnl,0)} / ${sg(t.total_r,2)}R</b><br>all <b class="${cl(a.total_pnl)}">₹${sg(a.total_pnl,0)} / ${sg(a.total_r,2)}R</b> · win ${iceWr(a.win_rate)} (${a.trades||0}) · open ${st.open_now||0}</button>`;
 }).join("")+`</div>`;
}
document.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest(".iceBookBtn");if(!b)return;ICE_BOOK=b.getAttribute("data-book")||"BASE";localStorage.setItem("iceBook",ICE_BOOK);try{renderIceberg()}catch(err){console.error(err)}});
function renderIcebergSignals(sig){
 sig=sig||{};
 const books=sig.books||{};
 if(!books[ICE_BOOK]) ICE_BOOK=books.BASE?"BASE":ICE_BOOK;
 const view=books[ICE_BOOK]?Object.assign({},ICE_BOOK==="BASE"?sig:{},books[ICE_BOOK]):sig;
 const armed=view.armed||[];
 const rows=view.rows||[];
 const skipped=view.skipped_today||[];
 const bk=books[ICE_BOOK];
 const varCards=(typeof iceVariantCards==="function")?iceVariantCards("iceberg.html"):"";
 const head=`<div class="iceSigH"><span>ICEBERG VARIANTS (paper)</span><span class="info">PAPER ONLY · not A/A+</span></div>`+varCards+iceBookTabs(sig)+(bk?`<div class="iceBookDesc">${esc(bk.label||ICE_BOOK)} — ${esc(bk.desc||"")} · separate ledger, no day stop · click a card for WATCH / LIVE / CLOSED</div>`:"")+iceStatsBlock(view);
 let body="";
 body+=`<div class="iceSigSub">ARMED · awaiting 5m confirmation</div>`;
 if(!armed.length) body+=`<div class="m">Koi armed setup nahi.</div>`;
 else body+=`<div class="iceCards">${armed.map(icebergCard).join("")}</div>`;
 body+=`<div class="iceSigSub">CONFIRMED / OPEN / CLOSED</div>`;
 if(!rows.length) body+=`<div class="m">Aaj abhi koi confirmed paper signal nahi.</div>`;
 else body+=`<div class="iceCards">${rows.map(icebergCard).join("")}</div>`;
 body+=`<div class="iceSigSub">SKIPPED TODAY</div>`;
 if(!skipped.length) body+=`<div class="m">Aaj koi skip nahi.</div>`;
 else body+=`<div class="iceSkip">${skipped.map(iceSkipRow).join("")}</div>`;
 return `<div id="iceSig">${head}${body}</div>`;
}
function renderIceberg(){
 const ice=(D&&D.iceberg)||((D&&D.state&&D.state.iceberg))||{};
 const rows=(ice.rows||ice.recent||ice.active||[]).slice().sort((a,b)=>String(b.ts||b.first_ts||"").localeCompare(String(a.ts||a.first_ts||""))).slice(0,10);
 const by=ice.by_signal||{};
 const sigs=Object.keys(by).sort().map(k=>esc(k)+" "+by[k]).join(" · ");
 const n=ice.detections_today!=null?ice.detections_today:rows.length;
 $("icebergN").innerHTML=`<span class="info">INFO ONLY · not a setup</span> · today ${esc(n)}${sigs?" · "+sigs:""}`;
 let html="";
 if(!rows.length) html='<div class="m">Aaj abhi koi iceberg detection nahi.</div>';
 else html=`<div class="icebergWrap"><table><tr><th>TIME IST</th><th>SYMBOL</th><th>SIDE</th><th>PRICE</th><th>SIGNAL(S)</th><th>CONF</th><th>EXEC vs VIS</th></tr>`+
  rows.map(r=>{
   const side=String(r.side||"");
   const sc=/buyer/i.test(side)?"buyer":(/seller/i.test(side)?"seller":"dm");
   const conf=String(r.confidence||"").toLowerCase();
   const nx=r.exec_multiple!=null?Number(r.exec_multiple).toFixed(1)+"x":"—";
   const vis=r.visible_size!=null?Number(r.visible_size).toLocaleString("en-IN"):"—";
   const exe=r.executed_est!=null?Number(r.executed_est).toLocaleString("en-IN"):"—";
   const sig=(r.signals||[]).join(", ")||"—";
   const px=r.price==null?"—":Number(r.price).toLocaleString("en-IN",{maximumFractionDigits:2});
   return `<tr><td class="dm">${esc(r.time_ist||iceTime(r.ts||r.first_ts))}</td><td><b>${esc(r.symbol||"")}</b></td><td class="${sc}">${esc(side)}</td><td>${esc(px)}</td><td class="dm">${esc(sig)}</td><td class="conf-${esc(conf)}">${esc(r.confidence||"—")}</td><td><span class="nx">${esc(nx)}</span> <span class="m">${esc(exe)}/${esc(vis)}</span></td></tr>`;
  }).join("")+`</table></div>`;
 $("iceberg").innerHTML=renderIcebergSignals(ice.signals||{})+html;
}
function renderNews(){
 const st=(D&&D.state)||{};$("newsAsOf").textContent=st.news_as_of?"as of "+st.news_as_of:"";
 const mk={bullish:["▲","g"],bearish:["▼","p"],neutral:["●","a"]};
 $("news").innerHTML=(st.news||[]).map(n=>{const m=mk[n.dir]||mk.neutral;return `<div class="nmeta">${esc(n.time)} · <span class="${m[1]}">${m[0]}</span> ${esc(n.tag)}<br>${esc(n.source||"")}</div><div><div class="nhi">${esc(n.hi)}</div><div class="nim ${m[1]}">${esc(n.impact||"")}</div></div>`}).join("")||'<div class="m">अभी कोई खबर नहीं</div>';
}
function renderNewsMovers(){
 const st=(D&&D.state)||{}, mv=st.news_movers||{}, rows=mv.rows||[];
 const nEl=$("newsMoversN");
 if(nEl) nEl.innerHTML=`<span class="nmInfo">INFO ONLY</span> · ${rows.length} names`+(mv.as_of||st.news_movers_as_of?" · as of "+esc(mv.as_of||st.news_movers_as_of):"");
 const box=$("newsMovers");
 if(!box) return;
 if(!rows.length){box.innerHTML='<div class="m">ताज़ा खबर और &gt;1% मूव वाला कोई ऑफ-WATCH F&amp;O नाम नहीं।</div>';return;}
 box.innerHTML=rows.slice(0,15).map(r=>{
  const pct=Number(r.pct), since=r.pct_since_news;
  const sinceTxt=(since==null||since===""||isNaN(Number(since)))?"":` · since news ${sg(Number(since))}%`;
  return `<div class="nmRow"><div><div class="nmSym">${esc(r.symbol)}</div><div class="nmMeta">${esc(r.time||"")} · ${esc(r.source||"")}</div></div><div class="nmPct ${cl(pct)}">${sg(pct)}%</div><div class="nmH">${esc(r.hi||r.headline||"")}<div class="nmMeta">${f(r.ltp)} vs prev ${f(r.prev_close)}${sinceTxt}</div></div></div>`;
 }).join("");
}
function stockNewsHtml(s){
 const bag=((D&&D.state&&D.state.stock_news)||{}),rec=bag[s.symbol]||s.news||null;
 if(!rec) return `<div class="snews m">समाचार · ला रहे हैं…</div>`;
 const items=rec.items||[];
 const asof=rec.as_of||((D&&D.state&&D.state.stock_news_as_of)||"");
 if(!items.length) return `<div class="snews m">समाचार · कोई नई हेडलाइन नहीं${asof?" · as of "+esc(asof):""}</div>`;
 return `<div class="snews">${items.slice(0,2).map(n=>`<div class="snewsL"><span class="nmeta">${esc(n.time||"")} · ${esc(n.source||"")}</span><div class="snewsH">${esc(n.hi||n.headline||"")}</div></div>`).join("")}</div>`;
}
function setupCard(s,watch){
 const q=L[s.symbol],risk=Math.abs((s.entry||0)-(s.sl||0)),sgn=s.side==="LONG"?1:-1;
 const st=String(s.status||"").toUpperCase();
 if(!(+s.t2>0))s=Object.assign({},s,{t2:null});
 watch=watch||st==="WATCH"||st==="TRIGGERED_LOWR";
 const lowr=st==="TRIGGERED_LOWR",trig=st==="TRIGGERED";
 const r=q&&risk?sgn*(q.ltp-s.entry)/risk:null,gc=s.grade==="A+"?"g":"b";
 let badge;
 if(lowr) badge=`<span class="badge m" style="border:1px dotted currentColor">TRIGGER · &lt;1R</span>`;
 else if(trig) badge=`<span class="badge g" style="border:1px solid currentColor">${esc(s.side||"LONG")} ${esc(s.grade||"A")} · TRIGGERED</span>`;
 else if(watch) badge=`<span class="badge a" style="border:1px solid currentColor">WATCH · ${esc(s.grade||"A")} on 5m close ${(sgn>0?">":"<")}${esc(s.entry)}</span>`;
 else if((s.paper_status||s.awaiting||s.note||"")==="waiting pullback-break") badge=`<span class="badge a" style="border:1px solid currentColor">${esc(s.grade||"A")} · waiting pullback-break</span>`;
 else badge=`<span class="badge ${gc}" style="border:1px solid currentColor">${esc(s.grade||"")}</span>`;
 const cls=lowr?" lowr":(trig?"":(watch?" watch":""));
 return `<div class="card${cls}${trig?" triggered":""}"><div class="h"><span><b class="${sgn>0?"g":"p"}">${sgn>0?"▲":"▼"} ${esc(s.symbol)}</b> ${badge} <span class="m">${esc(s.time||"")}</span></span>
 <span>${q?f(q.ltp):"—"} ${r==null?"":`<b class="${cl(r)}">${r>0?"+":""}${r.toFixed(2)}R</b>`}</span></div>
 <div class="lv"><span class="m">E <b class="dm">${f(s.entry)}</b></span><span class="m">SL <b class="p">${f(s.sl)}</b></span><span class="m">T1 <b class="g">${f(s.t1)}</b></span>${s.t2?`<span class="m">T2 <b class="g">${f(s.t2)}</b></span>`:""}</div>
 ${(o=>o&&o.contract?`<div class="lv" style="margin-top:2px"><span class="m">OPT <b class="a">${esc(o.contract)}</b></span><span class="m">E <b class="dm">${f(o.entry)}</b></span><span class="m">SL <b class="p">${f(o.sl)}</b></span><span class="m">T1 <b class="g">${f(o.t1)}</b></span>${o.t2?`<span class="m">T2 <b class="g">${f(o.t2)}</b></span>`:""}</div>`:"")(s.option)}
 ${s.triggerText||s.note||s.why?`<div class="dm" style="font-size:11px;margin-bottom:4px;white-space:normal">${esc(s.triggerText||s.why||s.note)}</div>`:""}
 ${stockNewsHtml(s)}
 <div class="btns"><a class="btn" href="${lc(s.symbol)}" target="${ON_PUBLIC?"_self":"_blank"}">Live Chart</a><a class="btn" href="${lc(s.symbol,1)}" target="${ON_PUBLIC?"_self":"_blank"}">Option</a><a class="btn" href="${tv(s.symbol)}" target="_blank" rel="noreferrer">TradingView</a></div></div>`;
}
function setupRank(s){
 const g=String(s.grade||"").toUpperCase();
 const st=String(s.status||"").toUpperCase();
 const watch=!!s.recheck_only||st==="WATCH"||st==="TRIGGERED_LOWR";
 if(g==="A+"&&!watch) return 0;
 if(g==="A"&&!watch) return 1;
 if(g==="A+") return 2;
 if(g==="A") return 3;
 return 4;
}
function renderSetups(){
 const st=(D&&D.state)||{};const live=((D&&D.setups&&D.setups.setups)||[]);
 const seen=new Set(),list=[];
 [...live,...(st.setups||[]),...(st.watch||[])].forEach(s=>{if(!s||!s.symbol)return;if(s.recheck_only||s.kind==="reject_recheck")return;if(!seen.has(s.symbol+s.side)){seen.add(s.symbol+s.side);list.push(s)}});
 list.sort((a,b)=>{const d=setupRank(a)-setupRank(b);return d||String(b.time||"").localeCompare(String(a.time||""))});
 const liveList=list.filter(s=>setupRank(s)<=1), watchList=list.filter(s=>setupRank(s)>1);
 const nLive=liveList.length,nWatch=watchList.length;
 const sn=$("setupsN"); if(sn) sn.textContent=nLive+" live · "+nWatch+" watch";
 $("setups").innerHTML=liveList.map(s=>setupCard(s,false)).join("")||'<div class="m" style="padding:6px 0">No A/A+ setups yet — waiting for structure.</div>';
 const wc=$("watchCards");
 if(wc) wc.innerHTML=watchList.map(s=>setupCard(s,true)).join("")||'<div class="m" style="padding:8px 0">No WATCH names right now.</div>';
 const wn=$("watchN"); if(wn) wn.textContent=nWatch+" watch";
}
function renderAudit(){
 const a=(D&&D.audit)||{},iss=(a.issues||[]).filter(i=>!i.handled);
 const el=$("auditStrip");
 if(!iss.length){el.className="";el.innerHTML="";return}
 el.className="show";
 el.innerHTML='<span class="ah">⚠ CHECK · '+iss.length+'</span>'+iss.slice(0,6).map(i=>'<div class="ai">'+(i.severity==="high"?"🔴":"🟡")+" "+esc(i.symbol?i.symbol+" · ":"")+esc(i.msg_hinglish||"")+"</div>").join("");
}
function renderGraded(){
 const g=(D&&D.graded)||[],acts=((D&&D.state.actions)||[]);
 const rows=g.length?g.map(x=>({t:x.time,a:String(x.grade||"").toUpperCase(),s:x.symbol,m:x.why})):acts.map(x=>({t:x.time,a:x.action,s:x.symbol,m:x.message}));
 $("gradN").textContent=rows.length+" rows";
 $("graded").innerHTML=rows.map(x=>{const c=/REJ/.test(x.a)?"p":/A/.test(x.a)?"g":"a";return `<div class="row"><span class="m">${esc(x.t)}</span><span class="badge ${c}">${esc(x.a)}</span><a class="b" href="${tv(x.s)}" target="_blank" rel="noreferrer">${esc(x.s)}</a><span class="w">${esc(x.m)}</span></div>`}).join("")||'<div class="m">—</div>';
}
let heatMode=(new URLSearchParams(location.search).get("heat"))||localStorage.getItem("heatMode")||"nifty";if(heatMode!=="sector")heatMode="nifty";
let SECT=null;
$("heatBtn").onclick=()=>{heatMode=heatMode==="sector"?"nifty":"sector";localStorage.setItem("heatMode",heatMode);renderHeat();if(heatMode==="sector")loadSect().then(renderHeat)};
function quotePct(q){
 if(!q) return null;
 const p=Number(q.pct);
 if(q.pct!=null&&q.pct!==""&&!isNaN(p)) return p;
 const ltp=Number(q.ltp), prev=Number(q.prev_close!=null?q.prev_close:q.close);
 if(!prev||isNaN(ltp)) return null;
 return (ltp-prev)/prev*100;
}
function heatAsOf(){
 const t=quoteAsOf?String(quoteAsOf):"";
 const hm=t.length>=19?t.slice(11,19):ist();
 return hm?("as of "+hm+" IST"):"";
}
function heatQuotes(){
 const sec=(D&&D.state&&D.state.sectors)||{};
 const out=[];
 Object.values(L||{}).forEach(q=>{
  if(!q||!q.symbol||q.symbol==="NIFTY"||q.symbol==="INDIAVIX"||/\d(CE|PE)$/.test(q.symbol)) return;
  const pct=quotePct(q); if(pct==null||q.ltp==null) return;
  out.push(Object.assign({},q,{pct:pct}));
 });
 const mapped=out.filter(q=>sec[q.symbol]);
 return {sec, qs: mapped.length?mapped:out};
}
async function loadSect(){try{const r=await api("/api/sectors");if(r)SECT=r;else if(SECT)SECT.err="no data"}catch(e){if(SECT)SECT.err="fetch failed"}}
function sectorAsOf(){
 const t=(SECT&&(SECT.as_of||SECT.fetched||SECT.nse_ts))||"";
 if(!t)return heatAsOf();
 const m=String(t).match(/(\d{2}:\d{2}:\d{2})/);
 return "as of "+(m?m[1]:t)+" IST";
}
function renderSect(){
 // Official sector INDEX LTP vs previous session close (from /api/sectors).
 // Do not fall back to a prior-session snapshot; empty beats stale.
 $("heatT").textContent="SECTOR HEAT";$("heatBtn").textContent="NIFTY 50";
 const a=((SECT&&SECT.sectors)||[]).filter(x=>x&&x.pct!=null).slice().sort((x,y)=>y.pct-x.pct);
 const up=a.filter(x=>x.pct>0).length;
 const as=sectorAsOf();
 $("breadth").innerHTML=a.length?`<span class="g">${up}↑</span> <span class="p">${a.length-up}↓</span> <span class="dm">${esc(as)} · vs prev close</span>`:`<span class="dm">${esc(as)||"waiting for live sector quotes"}</span>`;
 $("heat").innerHTML=a.map(x=>{
  const raw=String(x.name||""), stripped=raw.replace(/^NIFTY\s+/,""), label=(stripped && stripped!=="50")?stripped:raw;
  return `<a class="tile" style="background:${heatBg(x.pct)}" href="#" onclick="return false"><b>${esc(label)}</b><br>${f(x.last)} ${sg(x.pct)}%</a>`;
 }).join("")||'<div class="m">waiting for live sector quotes</div>';
}
function renderHeat(){
 if(heatMode==="sector")return renderSect();
 $("heatT").textContent="NIFTY 50 HEAT";$("heatBtn").textContent="SECTOR";
 const {sec,qs}=heatQuotes();
 const by={};qs.forEach(q=>(by[sec[q.symbol]||"OTHERS"]=by[sec[q.symbol]||"OTHERS"]||[]).push(q));
 const groups=Object.entries(by).map(([n,a])=>({n,a:a.sort((x,y)=>y.pct-x.pct),avg:a.reduce((s,x)=>s+x.pct,0)/a.length})).sort((x,y)=>y.avg-x.avg);
 const up=qs.filter(q=>q.pct>0).length; const as=heatAsOf();
 $("breadth").innerHTML=`<span class="g">${up}↑</span> <span class="p">${qs.length-up}↓</span> <span class="dm">${esc(as)}</span>`;
 $("heat").innerHTML=groups.map(g=>`<div class="sec">${esc(g.n)} <span class="${cl(g.avg)}">${sg(g.avg)}%</span></div>`+g.a.map(q=>`<a class="tile" style="background:${heatBg(q.pct)}" href="${tv(q.symbol)}" target="_blank" rel="noreferrer"><b>${esc(q.symbol)}</b><br>${f(q.ltp)} ${sg(q.pct)}%</a>`).join("")).join("")||'<div class="m">waiting for live quotes</div>';
}
function backtestNoteText(){
 const n=(D&&D.backtest_note)||(D&&D.state&&D.state.backtest_note)||{};
 if(n&&n.text) return String(n.text);
 try{const e=$("backtestNoteSrc"); if(e){const j=JSON.parse(e.textContent); if(j&&j.text) return String(j.text)}}catch(err){}
 return "1 minute pullback-break backtest, 4 to 23 November: +₹24,724, 62.5% win rate (backtest, not booked)";
}
function expiryOiVolNote(){
 const n=(D&&D.expiry_oivol_note)||(D&&D.state&&D.state.expiry_oivol_note)||{};
 if(n&&(n.text||n.status_base)) return n;
 try{const e=$("expiryOiVolNoteSrc"); if(e){const j=JSON.parse(e.textContent); if(j) return j}}catch(err){}
 return {status_base:"BASE: original 19 Nov rules (OI/volume only logged, not gating)",
  status_shadow:"Shadow: EXPIRY_BASE_OIVOL — same rules + OI/volume gate, paper, not in booked P&L",
  text:"23 Nov missed trades unchanged at +₹13,275; the gate would have blocked two 15:03 trades (BANKNIFTY, NIFTY) that hit SL at −1R each (index path, no ₹); one day only, sample small (backtest, not booked)",
  label:"backtest, not booked"};
}
function renderExpiryOiVolNote(){
 const j=expiryOiVolNote();
 const st=$("expOiVolStatus"), nt=$("expOiVolNote");
 if(st) st.innerHTML=esc(j.status_base||"")+"<br>"+esc(j.status_shadow||"");
 if(nt) nt.textContent=j.text||"";
}
function renderBtst(){
 const b=(D&&D.state&&D.state.btst)||{},p=b.picks||[];$("btstN").textContent=(b.date||"")+(b.as_of?" · "+b.as_of+" IST":"");
 $("btst").innerHTML=p.map(x=>{const lg=/LONG/i.test(x.side||""),q=L[x.symbol];return `<div class="card"><div class="h"><span><b class="${lg?"g":"p"}">${lg?"▲":"▼"} ${esc(x.symbol)}</b> <span class="badge ${lg?"g":"p"}" style="border:1px solid currentColor">${esc(x.side||"")} · ${esc(x.grade||"")}</span></span><span>${q?f(q.ltp):""}</span></div>
 <div class="lv"><span class="m">E <b class="dm">${esc(x.entry)}</b></span><span class="m">SL <b class="p">${esc(x.sl)}</b></span><span class="m">T1 <b class="g">${esc(x.t1)}</b></span>${x.t2?`<span class="m">T2 <b class="g">${esc(x.t2)}</b></span>`:""}</div>
 ${x.option?`<div class="lv" style="grid-template-columns:1fr"><span class="m">OPT <b class="a">${esc(x.option)}</b> ${esc(x.prem||"")}${x.lot?" · lot "+esc(x.lot):""}${x.risk_1lot?" · risk ₹"+esc(x.risk_1lot)+"/lot":""}</span></div>`:""}
 ${x.reason?`<div class="dm" style="font-size:11px;margin-bottom:4px;white-space:normal">${esc(x.reason)}</div>`:""}
 <div class="btns"><a class="btn" href="${lc(x.symbol)}" target="${ON_PUBLIC?"_self":"_blank"}">Live Chart</a><a class="btn" href="${tv(x.symbol)}" target="_blank" rel="noreferrer">TradingView</a></div></div>`}).join("")||'<div class="m">Aaj koi BTST/STBT pick nahi.</div>';
}
function renderPaper(){
 const p=(D&&D.paper)||{},d=p.day||{},t=p.total||{},u=p.unrealized||{};
 const bn=$("aaBacktestNote"); if(bn) bn.textContent=backtestNoteText();
 const pu=$("paperU"); if(pu) pu.innerHTML=`open <span class="${cl(u.pnl)}">₹${sg(u.pnl,0)}</span>`;
 const st=$("aaStats");
 if(st) st.innerHTML=`today <b class="${cl(d.pnl)}">₹${sg(d.pnl,0)} / ${sg(d.r)}R</b> · trades ${d.trades||0} · win ${f(t.winRate,0)}% (${t.trades||0}) · all <b class="${cl(t.pnl)}">₹${sg(t.pnl,0)} / ${sg(t.r)}R</b>`;
 let h=`<div class="lv" style="grid-template-columns:repeat(2,1fr)"><span class="m">TODAY <b class="${cl(d.pnl)}">₹${sg(d.pnl,0)} / ${sg(d.r)}R</b></span><span class="m">TRADES <b>${d.trades||0}</b></span><span class="m">ALL <b class="${cl(t.pnl)}">₹${sg(t.pnl,0)} / ${sg(t.r)}R</b></span><span class="m">WIN <b class="a">${f(t.winRate,0)}% (${t.trades||0})</b></span></div>`+(d.charges!=null?`<div class="m" style="margin:2px 0 4px">NET today <b class="${cl(d.pnl_net)}">₹${sg(d.pnl_net,0)} / ${sg(d.r_net)}R</b> · charges ₹${f(d.charges||0,0)} · slippage ₹${f(d.slippage||0,0)} · all net <b class="${cl(t.pnl_net)}">₹${sg(t.pnl_net,0)}</b> (charges ₹${f(t.charges||0,0)} · slippage ₹${f(t.slippage||0,0)})</div>`:"");
 const op=p.open||[],td=p.today||[];
 h+=`<table><tr><th>OPEN</th><th>LOTS</th><th>FILL</th><th>LTP</th><th>SL</th><th>T1</th><th>T2</th><th>uPnL</th></tr>`+(op.map(o=>{const c2c=o.c2c||o.cost_moved||o.t1_done;const lotsLbl=`${o.qtyOpenLots??o.lots??1}${c2c?' <span class="a">C2C</span>':''}`;return `<tr><td><span class="${o.side==="LONG"?"g":"p"}">${o.side==="LONG"?"▲":"▼"}</span> ${esc(o.mode==="option"&&o.contract?o.contract.replace(/^([A-Z&-]+?)\d{2}[A-Z]{3}\d{2}(\d+(?:\.\d+)?)(CE|PE)$/,"$1 $2$3"):o.symbol)}</td><td>${lotsLbl}</td><td>${f(o.fill)}</td><td>${f(o.ltp)}</td><td class="p">${f(o.sl)}${c2c?' <span class="a">C2C</span>':''}</td><td class="g">${f(o.t1)}</td><td class="g">${o.t2!=null?f(o.t2):"—"}</td><td class="${cl(o.uPnl)}">₹${sg(o.uPnl,0)} ${o.uR!=null?sg(o.uR)+"R":""}</td></tr>`}).join("")||`<tr><td colspan="8" class="m">no open positions</td></tr>`)+`</table>`;
 const pend=(p.pending||[]).filter(x=>x&& (x.status==="waiting pullback-break"||x.note==="waiting pullback-break"));
 if(pend.length)h+=`<table style="margin-top:4px"><tr><th>WAITING</th><th>SIDE</th><th>STATUS</th><th>SL</th><th>T1</th></tr>`+pend.map(x=>`<tr><td><span class="${x.side==="LONG"?"g":"p"}">${x.side==="LONG"?"▲":"▼"}</span> ${esc(x.contract||x.symbol)}</td><td>${esc(x.side||"")}</td><td class="a">${esc(x.grade||"A")} · waiting pullback-break</td><td class="p">${f(x.spot_sl||x.sl)}</td><td class="g">${f(x.spot_t1||x.t1)}</td></tr>`).join("")+`</table>`;

 if(td.length)h+=`<table style="margin-top:4px"><tr><th>CLOSED</th><th>LOTS</th><th>L1</th><th>L2</th><th>P&amp;L</th></tr>`+td.map(x=>{const l1=x.lot1Pnl!=null?`₹${sg(x.lot1Pnl,0)}`:"";const l2=x.lot2Pnl!=null?`₹${sg(x.lot2Pnl,0)}`:"";const note=x.note||x.close_note||"";return `<tr><td>${esc(x.mode==="option"&&x.contract?x.contract:x.symbol)}</td><td>${x.lots??1}</td><td class="${cl(x.lot1Pnl)}">${l1}</td><td class="${cl(x.lot2Pnl)}">${l2}</td><td class="${cl(x.pnl)}">₹${sg(x.pnl,0)} ${x.r!=null?sg(x.r)+"R":""}</td></tr>`+(note?`<tr><td colspan="5" class="dm" style="white-space:normal">${esc(x.reason?x.reason+" — ":"")}${esc(note)}</td></tr>`:"")}).join("")+`</table>`;
 $("paper").innerHTML=h;
}
function renderWatchLong(){
 const el=$("paperWL"); if(!el) return;
 const w=(D&&D.state&&D.state.watch_long)||(D&&D.watch_long)||null;
 if(!w){el.innerHTML='<div class="m">WATCH-LONG book abhi data nahi.</div>';return}
 const d=w.day||{},t=w.total||{},op=w.open||[],td=w.today||[];
 let h=`<div class="lv" style="grid-template-columns:repeat(2,1fr)"><span class="m">TODAY <b class="${cl(d.pnl)}">₹${sg(d.pnl,0)} / ${sg(d.r)}R</b></span><span class="m">TRADES <b>${d.trades||0}</b></span><span class="m">ALL <b class="${cl(t.pnl)}">₹${sg(t.pnl,0)} / ${sg(t.r)}R</b></span><span class="m">WIN <b class="a">${f(t.winRate,0)}% (${t.trades||0})</b></span></div>`+(d.charges!=null?`<div class="m" style="margin:2px 0 4px">NET today <b class="${cl(d.pnl_net)}">₹${sg(d.pnl_net,0)} / ${sg(d.r_net)}R</b> · charges ₹${f(d.charges||0,0)} · slippage ₹${f(d.slippage||0,0)} · all net <b class="${cl(t.pnl_net)}">₹${sg(t.pnl_net,0)}</b> (charges ₹${f(t.charges||0,0)} · slippage ₹${f(t.slippage||0,0)})</div>`:"");
 const nm=c=>c?String(c).replace(/^([A-Z&-]+?)\d{2}[A-Z]{3}\d{2}(\d+(?:\.\d+)?)(CE|PE)$/,"$1 $2$3"):"";
 h+=`<table><tr><th>OPEN · LONG</th><th>LOTS</th><th>FILL</th><th>SL</th><th>T1</th><th>T2</th><th>GATE</th></tr>`+(op.map(o=>`<tr><td><span class="g">▲</span> ${esc(nm(o.contract)||o.symbol)}</td><td>${o.qtyOpenLots??o.lots??2}${o.c2c?' <span class="a">C2C</span>':''}</td><td>${f(o.fill)}</td><td class="p">${f(o.sl)}</td><td class="g">${f(o.t1)}</td><td class="g">${o.t2!=null?f(o.t2):"—"}</td><td class="${o.gateOk?"g":"dm"}">${o.gateOk?"pass":"blocked"}</td></tr>`).join("")||`<tr><td colspan="7" class="m">no open WATCH-LONG demo</td></tr>`)+`</table>`;
 if(td.length)h+=`<table style="margin-top:4px"><tr><th>CLOSED · LONG</th><th>TIME</th><th>EXIT</th><th>P&amp;L</th></tr>`+td.map(x=>`<tr><td><span class="g">▲</span> ${esc(nm(x.contract)||x.symbol)}</td><td>${esc(x.time||"")}</td><td class="dm">${esc(x.reason||"")}</td><td class="${cl(x.pnl)}">₹${sg(x.pnl,0)} ${x.r!=null?sg(x.r)+"R":""}</td></tr>`).join("")+`</table>`;
 el.innerHTML=h;
}
let varSel=null;
function renderVariants(){
 const box=$("varBoxes"),tl=$("varTrades"); if(!box||!tl) return;
 const v=(D&&D.state&&D.state.variants)||(D&&D.variants)||null;
 const bk=(v&&v.books)||[];
 if(!bk.length){box.innerHTML='<div class="m">Variant books abhi data nahi (daemon 09:15 IST se).</div>';tl.innerHTML="";return}
 if(!varSel||!bk.some(b=>b.name===varSel)) varSel=bk[0].name;
 const wr=x=>x==null?"—":f(x,0)+"%";
 const vCards=(typeof variantCards==="function")?variantCards("variant.html"):"";
 const vHead=vCards?`<div class="iceSigH"><span>VARIANT BOOKS (paper)</span><span class="info">click a card · shadows booked P&amp;L me nahi</span></div>`+vCards:"";
 box.innerHTML=vHead+bk.map(b=>{const d=b.day||{},t=b.total||{};return `<div class="varBox${b.name===varSel?" on":""}" data-vb="${esc(b.name)}"><h4>${esc(b.label||b.name)}</h4><div class="kv"><span>TODAY <b class="${cl(d.pnl)}">₹${sg(d.pnl,0)}</b></span><span>R <b class="${cl(d.r)}">${sg(d.r)}R</b></span><span>ALL <b class="${cl(t.pnl)}">₹${sg(t.pnl,0)}</b></span><span>ALL R <b class="${cl(t.r)}">${sg(t.r)}R</b></span><span>TRADES <b>${d.trades||0}</b> / ${t.trades||0}</span><span>WIN <b class="a">${t.trades?wr(t.winRate):"—"}</b></span></div>${d.pnl_gross!=null?`<div class="dm" style="font-size:10px">NET of costs · gross today ₹${sg(d.pnl_gross,0)} (${sg(d.r_gross)}R) · ${d.charges!=null?`charges ₹${f(d.charges||0,0)} · slippage ₹${f(d.slippage||0,0)}`:`costs ₹${f(d.costs||0,0)}`} · all gross ₹${sg(t.pnl_gross,0)} ${t.charges!=null?`charges ₹${f(t.charges||0,0)} · slippage ₹${f(t.slippage||0,0)}`:`costs ₹${f(t.costs||0,0)}`}</div>`:''}${d.stopped?'<div class="p">−2R stop hit (aaj band)</div>':''}</div>`}).join("");
 box.querySelectorAll(".varBox").forEach(el=>{el.onclick=()=>{varSel=el.getAttribute("data-vb");renderVariants()}});
 const b=bk.find(z=>z.name===varSel)||bk[0];
 const nm=c=>c?String(c).replace(/^([A-Z&-]+?)\d{2}[A-Z]{3}\d{2}(\d+(?:\.\d+)?)(CE|PE)$/,"$1 $2$3"):"";
 const lab=s=>s==="LONG"?'<span class="g">▲ LONG</span>':'<span class="p">▼ SHORT</span>';
 let h=`<div class="aaSub">${esc(b.label||b.name)} · ${esc(b.desc||"")}</div>`;
 const op=b.open||[];
 h+=`<table><tr><th>OPEN</th><th>SIDE</th><th>LOTS</th><th>FILL</th><th>SL</th><th>T1</th><th>T2</th><th>TIME</th></tr>`+(op.map(o=>`<tr><td>${esc(nm(o.contract)||o.symbol)}</td><td>${lab(o.side)}</td><td>${o.qtyOpenLots??o.lots??2}${o.c2c?' <span class="a">C2C</span>':''}</td><td>${f(o.fill)}</td><td class="p">${f(o.sl)}</td><td class="g">${f(o.t1)}</td><td class="g">${o.t2!=null?f(o.t2):"—"}</td><td>${esc(String(o.time||"").slice(0,8))}</td></tr>`).join("")||`<tr><td colspan="8" class="m">no open position</td></tr>`)+`</table>`;
 const rc=(b.recent&&b.recent.length?b.recent:(b.today||[]));
 h+=`<table style="margin-top:4px"><tr><th>TRADES</th><th>SIDE</th><th>DATE</th><th>TIME</th><th>FILL</th><th>EXIT</th><th>WHY</th><th>P&amp;L</th></tr>`+(rc.map(x=>`<tr><td>${esc(nm(x.contract)||x.symbol)}</td><td>${lab(x.side)}</td><td>${esc(String(x.date||"").slice(5))}</td><td>${esc(x.time||"")}</td><td>${f(x.fill)}</td><td>${f(x.exit)}</td><td class="dm">${esc(x.reason||"")}</td><td class="${cl(x.pnl)}">₹${sg(x.pnl,0)} ${x.r!=null?sg(x.r)+"R":""}${x.gross!=null?` <span class="dm">(gross ₹${sg(x.gross,0)} · ${x.charges!=null?`charges ₹${f(x.charges,0)} · slip ₹${f(x.slippage||0,0)}`:`costs ₹${f(x.costs||0,0)}`})</span>`:""}</td></tr>`).join("")||`<tr><td colspan="8" class="m">abhi koi closed trade nahi</td></tr>`)+`</table>`;
 const dc=b.decisions||[];
 if(dc.length)h+=`<table style="margin-top:4px"><tr><th>DECISIONS (latest)</th><th>SIDE</th><th>STATE</th><th>WHY</th></tr>`+dc.slice().reverse().slice(0,15).map(z=>`<tr><td>${esc(z.time||"")} ${esc(z.symbol||"")}</td><td>${lab(z.side)}</td><td>${esc(z.state||"")}</td><td class="dm" style="white-space:normal">${esc(z.reason||"")}</td></tr>`).join("")+`</table>`;
 tl.innerHTML=h;
}
function ensureExpiryOiVolBook(books, jn){
 const list=[...(books||[])];
 const nameOf=b=>String((b&& (b.name||b.book))||"");
 if(list.some(b=>nameOf(b)==="EXPIRY_BASE_OIVOL")) return list;
 const z={pnl:0,pnl_gross:0,costs:0,r:0,charges:0,slippage:0,trades:0,winRate:null};
 const syn={name:"EXPIRY_BASE_OIVOL",book:"EXPIRY_BASE_OIVOL",
  label:"EXPIRY_BASE_OIVOL · SHADOW · BASE + 19 Nov 14:27 OI/volume gate · paper, not in booked P&L",
  shadow:true,day:Object.assign({},z),total:Object.assign({},z),open:[],today:[],recent:[],decisions:[],
  backtest:{label:(jn&&jn.label)||"backtest, not booked",text:(jn&&jn.text)||"",missed_counted_net:jn&&jn.missed_counted_net,not_booked:true}};
 const i=list.findIndex(b=>nameOf(b)==="EXPIRY_BASE");
 if(i>=0) list.splice(i+1,0,syn); else list.unshift(syn);
 return list;
}
function renderExpiry(){
 try{renderExpiryOiVolNote()}catch(e){console.error(e)}
 const el=$("expiryBox"); if(!el) return;
 const X=(D&&D.state&&D.state.expiry)||null;
 if(!X){el.innerHTML='<div class="m">Expiry engine data abhi nahi aaya.</div>';return}
 const EXP_LIVEPNL=false; /* user rule 11 Nov: no open/unrealised P&L on the GitHub page */
 const LIVEPNL=(typeof EXP_LIVEPNL!=="undefined")?EXP_LIVEPNL:true;
 const nm=c=>String(c||"").replace(/^(SENSEX|BANKEX)\d{2}[A-Z0-9]\d{2}(\d+)(CE|PE)$/,"$1 $2$3").replace(/^([A-Z]+)\d{2}[A-Z]{3}\d{2}(\d+)(CE|PE)$/,"$1 $2$3");
 const md=X.mode_today||{};
 let h=`<div class="aaSub">${esc(X.note||"")} · updated ${esc(String(X.updated||"").slice(11,19))} IST · mode today: <b>${esc(md.mode||"rules")}</b>${md.pdh_flip?" · PDH flip ON":""}${md.scalp1m_bull?" · 1m bull scalp ON":""}</div>`;
 // 23 Nov 2026 (user voice ~18:44 IST): missed expiry setups (engine down) — hypothetical, NOT booked; driven by expiry/data/missed_pnl.json via engine summary
 try{const DT=X.day_totals||{},MPa=(X.missed_pnl||[]);if(MPa.length){const MPc=MPa.filter(m=>!m.excluded&&!m.unpriced);const mn=(DT.missed_net!=null)?DT.missed_net:MPc.reduce((a,m)=>a+(+m.net||0),0);const ex=MPa.length-MPc.length;
  h+=`<div class="varBox" id="expMissedLine" style="margin-top:6px;border-style:dashed"><div class="kv"><span>BOOKED expiry today <b class="${cl(DT.booked_net||0)}">₹${sg(DT.booked_net||0,0)}</b></span><span>${esc(DT.missed_label||"Missed (engine down, not booked)")}: <b class="${cl(mn)}">₹${sg(mn,0)}</b> (${MPc.length} setups${ex?` counted · ${ex} excluded by engine rules`:""})</span><span class="dm">${esc(DT.date||"")} · hypothetical, real Angel 1m option prices, after charges · NOT in booked P&amp;L</span></div></div>`;
  h+=`<table><tr><th>MISSED (not booked)</th><th>TRIG</th><th>ENTRY</th><th>EXITS</th><th>NET</th><th>STATUS</th></tr>`+MPa.map(m=>`<tr><td><b>${esc(nm(m.contract))}</b><div class="dm">${esc(m.index||"")} ${esc(m.tf||"")} ${esc(m.setup||"")}</div></td><td>${esc(m.trigger_time||"")}</td><td>${m.entry!=null?f(m.entry):"—"}</td><td class="dm" style="white-space:normal">${(m.legs||[]).map(l=>`${esc(l.lot)} ${esc(l.time)} @${f(l.price)}`).join(" · ")}</td><td><b class="${cl(m.net)}">${m.net!=null?"₹"+sg(m.net,0):"—"}</b></td><td class="dm" style="white-space:normal">${m.unpriced?esc("unpriced: "+m.unpriced):(m.excluded?esc("excluded: "+(m.exclude_reason||"")):"counted")}</td></tr>`).join("")+`</table>`;}}catch(e){console.error(e)}
 const lv=X.levels||{};
 h+=`<table><tr><th>INDEX</th><th>EXPIRY</th><th>LTP</th><th>PDH</th><th>PDL</th><th>PDC</th><th>STATUS</th><th>CONTEXT (extra)</th></tr>`+Object.values(lv).map(v=>{const ev=(X.events||{})[v.index]||{};const sp=ev.spot;const pos=sp==null?"":(sp>v.pdh?'<span class="g">above PDH</span>':sp<v.pdl?'<span class="p">below PDL</span>':(sp>v.pdc?"PDC–PDH":"PDL–PDC"));return `<tr><td><b>${esc(v.index)}</b></td><td>${esc(v.expiry)}</td><td><b>${sp!=null?f(sp):"—"}</b> ${pos}</td><td>${f(v.pdh)}</td><td>${f(v.pdl)}</td><td>${f(v.pdc)}</td><td>${esc(v.status)} (${esc(v.session)})</td><td class="dm" style="white-space:normal">wk H ${f((v.extra||{}).week_high)} / L ${f((v.extra||{}).week_low)} · Dow ${esc((v.extra||{}).dow_trend_daily||"")} · ${esc((v.extra||{}).crt_context||"")}</td></tr>`}).join("")+`</table>`;
 const oi=X.oi||{};
 Object.entries(oi).forEach(([k,s])=>{if(!s)return;h+=`<div class="aaSub" style="margin-top:6px">OI · ${esc(k)} ATM ${esc(s.atm)} · PCR(ATM±2) <b>${s.pcr!=null?s.pcr:"—"}</b> · CE OI ${f(s.ce_oi,0)} · PE OI ${f(s.pe_oi,0)} · ${esc(String(s.t||"").slice(11,19))}</div><table><tr>`+Object.entries(s.legs||{}).map(([kk,v])=>`<td class="dm">${esc(kk)}<br><b>${f(v.ltp)}</b><br>OI ${f(v.oi,0)}</td>`).join("")+`</tr></table>`});
 const jn=expiryOiVolNote();
 h+=`<div class="varBox on" id="expOiVolBanner" style="margin-top:8px"><h4>BASE vs SHADOW · OI/volume</h4><div class="dm" style="white-space:normal">${esc(jn.status_base||"")}</div><div class="dm" style="white-space:normal">${esc(jn.status_shadow||"")}</div><div class="btxt"><b>${esc(jn.label||"backtest, not booked")}</b> — ${esc(jn.text||"")}</div></div>`;
 const books=ensureExpiryOiVolBook(X.books||[], jn);
 for(const b of books){
  const d=b.day||{},t=b.total||{};
  const isSh=!!(b.shadow||b.name==="EXPIRY_BASE_OIVOL"||b.book==="EXPIRY_BASE_OIVOL");
  const bt=b.backtest||(isSh?{label:jn.label||"backtest, not booked",text:jn.text,missed_counted_net:jn.missed_counted_net}:null);
  h+=`<div class="varBox on${isSh?" expOiVolCard":""}" style="margin-top:8px"><h4 style="${isSh?"white-space:normal;overflow:visible;text-overflow:unset":""}">${esc(b.label||b.name)}</h4><div class="kv"><span>TODAY net <b class="${cl(d.pnl)}">₹${sg(d.pnl,0)}</b></span><span>gross <b class="${cl(d.pnl_gross)}">₹${sg(d.pnl_gross,0)}</b></span><span>${d.charges!=null?`charges ₹${f(d.charges||0,0)} · slippage ₹${f(d.slippage||0,0)}`:`costs ₹${f(d.costs||0,0)}`}</span><span>R <b>${sg(d.r)}R</b></span><span>TRADES <b>${d.trades||0}</b></span><span>WIN <b>${d.winRate!=null?f(d.winRate,0)+"%":"—"}</b></span><span>ALL net ₹${sg(t.pnl,0)}</span></div>${bt&&(bt.text||bt.label)?`<div class="btxt"><b>${esc(bt.label||"backtest, not booked")}</b> — ${esc(bt.text||"")}${bt.missed_counted_net!=null?" · counted net ₹"+sg(bt.missed_counted_net,0):""} · paper, not in booked P&amp;L</div>`:""}</div>`;
  const op=b.open||[];
  h+=`<table><tr><th>OPEN</th><th>QTY</th><th>FILL</th><th>LTP</th>${LIVEPNL?"<th>LIVE P&amp;L</th>":""}<th>SL</th><th>TP</th><th>TRAIL</th><th>PEAK</th><th>GREEKS</th><th>OI/VOL</th><th>TIME</th></tr>`+(op.map(o=>{const g=o.greeks||{},c=o.confirm||{};const lp=(o.ltp!=null)?((o.ltp-o.fill)*(o.qty_open||0)+(o.realized||0)):null;const tr=o.lot1_done?'<span class="g">lot1 booked · lot2 trailing</span>':(o.c2c?'<span class="a">C2C</span>':'—');return `<tr><td><b>${esc(nm(o.contract))}</b><div class="dm">${esc(o.level||"")} ${esc(o.pattern||"")} ${esc(o.tf||"")} trig ${esc(o.trigger_time||"")}</div></td><td>${o.qty_open}/${o.qty}</td><td>${f(o.fill)}</td><td><b>${o.ltp!=null?f(o.ltp):"—"}</b> <span class="dm">${esc(o.ltp_t||"")}</span></td>${LIVEPNL?`<td class="${cl(lp)}">${lp!=null?"₹"+sg(lp,0):"—"}</td>`:""}<td class="p">${f(o.prem_sl)} <span class="dm">idx ${f(o.spot_sl)}</span></td><td class="g">${o.prem_tp!=null?f(o.prem_tp):f(o.spot_t1)}</td><td>${tr}</td><td>${o.peak!=null?f(o.peak):"—"}</td><td class="dm">Δ ${g.delta??"—"} Γ ${g.gamma??"—"} θ/hr ${g.theta_per_hr??g.theta??"—"} IV ${g.iv??"—"}</td><td class="dm">${esc(c.tag||"—")} vol ${c.vol_ratio??"—"}x PCR ${c.pcr_then??"—"}→${c.pcr_now??"—"}</td><td>${esc(String(o.time||"").slice(0,8))}</td></tr>`}).join("")||`<tr><td colspan="12" class="m">no open position</td></tr>`)+`</table>`;
  const rc=(b.recent||[]).slice().reverse();
  h+=`<table style="margin-top:4px"><tr><th>CLOSED</th><th>DATE</th><th>TIME</th><th>QTY</th><th>FILL</th><th>EXIT avg</th><th>PEAK</th><th>WHY</th><th>NET</th><th>GROSS · CHARGES · SLIP</th></tr>`+(rc.map(x=>`<tr><td>${esc(nm(x.contract))}<div class="dm">${esc(x.level||"")} ${esc(x.pattern||"")}</div></td><td>${esc(String(x.date||"").slice(5))}</td><td>${esc(String(x.time||"").slice(0,5))}→${esc(String(x.closed_at||"").slice(11,16))}</td><td>${x.qty}</td><td>${f(x.fill)}</td><td>${f(x.exit)}</td><td>${x.peak!=null?f(x.peak):"—"}</td><td class="dm" style="white-space:normal">${esc(x.reason||"")}</td><td class="${cl(x.pnl)}">₹${sg(x.pnl,0)} ${x.r!=null?sg(x.r)+"R":""}</td><td class="dm">₹${sg(x.gross,0)} · ${x.charges!=null?`₹${f(x.charges,0)} · ₹${f(x.slippage||0,0)}`:`₹${f(x.costs||0,0)}`}</td></tr>`).join("")||`<tr><td colspan="10" class="m">abhi koi closed trade nahi</td></tr>`)+`</table>`;
  const dc=(b.decisions||[]).slice().reverse().slice(0,8);
  if(dc.length)h+=`<table style="margin-top:4px"><tr><th>DECISIONS</th><th>STATE</th><th>WHY</th></tr>`+dc.map(z=>`<tr><td>${esc(z.time||"")}</td><td>${esc(z.state||"")}</td><td class="dm" style="white-space:normal">${esc(z.reason||"")}</td></tr>`).join("")+`</table>`;
 }
 el.innerHTML=h;
}
function renderLog(){
 const qs=Object.values(L).filter(q=>q&&q.pct!=null&&q.symbol!=="NIFTY"&&q.symbol!=="INDIAVIX"&&!/\d(CE|PE)$/.test(q.symbol)).sort((a,b)=>b.pct-a.pct);
 const ch=q=>`<a class="tile" style="background:${heatBg(q.pct)};display:inline-block;margin:0 3px 3px 0" href="${tv(q.symbol)}" target="_blank" rel="noreferrer"><b>${esc(q.symbol)}</b> ${sg(q.pct)}%</a>`;
 $("log").innerHTML=`<div>${qs.slice(0,4).map(ch).join("")}</div><div>${qs.slice(-4).reverse().map(ch).join("")}</div>`+((D&&D.state.log)||[]).map(l=>`<div class="dm" style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l)}</div>`).join("");
}
function chartLabel(x){
 if(!x||!x.t)return "";
 if(chartTf==="D"||chartTf==="1D") return String(x.t).slice(5,10);
 return String(x.t).slice(11,16)||String(x.t).slice(5,10);
}
function renderChart(bars){
 const svg=$("chart"); if(!svg) return;
 const q=L[chartSym]||L[chartSym==="NIFTY"?"NIFTY":chartSym], W=svg.clientWidth||600,H=svg.clientHeight||220;
 const ttl=$("chartTitle"); if(ttl) ttl.textContent=(chartSym||"NIFTY")+" · "+chartTf.toUpperCase();
 const clink=$("chartLive"); if(clink){ const href=lc(chartSym==="NIFTY"?"NIFTY":chartSym); clink.href=href; if(ON_PUBLIC||href.indexOf("chart-view.html")>=0) clink.target="_self"; }
 const tvEl=$("niftyTv"); if(tvEl) tvEl.href=tv(chartSym||"NIFTY");
 if(!bars||!bars.length){svg.innerHTML="";return}
 let b=bars;
 if(chartTf==="D"||chartTf==="1D") b=bars.slice(-180);
 else if(chartTf==="1H"||chartTf==="30m") b=bars.slice(-80);
 else {
  const today=bars[bars.length-1].t.slice(0,10);
  b=bars.filter(x=>x.t.slice(0,10)===today);
  if(b.length<6)b=bars.slice(-40);
 }
 const pc=q&&q.prev_close;let lo=Math.min(...b.map(x=>x.l)),hi=Math.max(...b.map(x=>x.h));if(pc){lo=Math.min(lo,pc);hi=Math.max(hi,pc)}
 const pad=(hi-lo)*0.08||1;lo-=pad;hi+=pad;const R=50,cw=(W-R)/Math.max(b.length,20),y=v=>(hi-v)/(hi-lo)*(H-16);
 let s="";b.forEach((x,i)=>{const cx=i*cw+cw/2,up=x.c>=x.o,c=up?"#00E5A0":"#FF2D95";s+=`<line x1="${cx}" x2="${cx}" y1="${y(x.h)}" y2="${y(x.l)}" stroke="${c}"/><rect x="${cx-cw*0.35}" width="${Math.max(1,cw*0.7)}" y="${y(Math.max(x.o,x.c))}" height="${Math.max(1,Math.abs(y(x.o)-y(x.c)))}" fill="${c}"/>`;if(i%Math.ceil(b.length/6)===0)s+=`<text x="${cx}" y="${H-2}" fill="#6B7280" font-size="9" text-anchor="middle">${chartLabel(x)}</text>`});
 for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4;s+=`<text x="${W-2}" y="${y(v)+3}" fill="#6B7280" font-size="9" text-anchor="end">${f(v, chartTf==="D"?0:2)}</text><line x1="0" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#2a2e39"/>`}
 if(pc)s+=`<line x1="0" x2="${W-R}" y1="${y(pc)}" y2="${y(pc)}" stroke="#F5A623" stroke-dasharray="3 3"/><text x="2" y="${y(pc)-2}" fill="#F5A623" font-size="9">prev ${f(pc)}</text>`;
 const last=b[b.length-1], down=q?q.chg<0:(last.c<last.o);
 s+=`<rect x="${W-R+1}" y="${y(last.c)-7}" width="${R-2}" height="13" fill="${down?"#FF2D95":"#00E5A0"}"/><text x="${W-3}" y="${y(last.c)+3}" fill="#000" font-size="9" text-anchor="end">${f(last.c,2)}</text>`;
 svg.setAttribute("viewBox",`0 0 ${W} ${H}`);svg.innerHTML=s;
 const oh=$("chartOhlc");
 if(oh){const ch=q&&q.chg!=null?` <span class="${cl(q.chg)}">${sg(q.chg)} (${sg(q.pct)}%)</span>`:"";oh.innerHTML=`<b>${esc(chartSym)}</b> O ${f(last.o)} H ${f(last.h)} L ${f(last.l)} C <span class="${cl(last.c-last.o)}">${f(last.c)}</span>${ch}`;}
}
let bars=null,inFlight=false,nextPoll=null,failures=0,lastChartPoll=0,lastSectorPoll=0;
const TZS=19800000; // bars are true UTC epoch; shift to IST for labels
async function refresh(){
 if(inFlight||document.hidden||navigator.onLine===false)return;
 inFlight=true;
 try{
 const stamp=Date.now(),chartDue=stamp-lastChartPoll>=10000,sectorDue=heatMode==="sector"&&stamp-lastSectorPoll>=30000;
 if(chartDue)lastChartPoll=stamp;if(sectorDue)lastSectorPoll=stamp;
 const [,l,d,c]=await Promise.allSettled([sectorDue?loadSect():null,api("/api/ltp"),api("/api/dash"),chartDue?api("/api/candles?symbol="+encodeURIComponent(chartSym||"NIFTY")+"&tf="+encodeURIComponent(chartTf||"5m")):null]);
 failures=(l.status==="rejected"&&d.status==="rejected")?Math.min(failures+1,4):0;
 if(l.status==="fulfilled"){L=l.value.quotes||{};ltpAge=l.value.age_s;quoteAsOf=l.value.updated;lastOk=Date.now()}
 if(d.status==="fulfilled")D=d.value;
 if(c.status==="fulfilled"&&c.value)bars=(c.value.bars||[]).map(x=>{const dt=new Date(x.time*1000+TZS);return {t:dt.toISOString().slice(0,16).replace("T"," "),o:x.open,h:x.high,l:x.low,c:x.close}});
 for(const fn of [renderCounters,renderNews,renderNewsMovers,renderIceberg,renderSetups,renderAudit,renderGraded,renderHeat,renderBtst,renderPaper,renderWatchLong,renderVariants,renderExpiry,renderLog,()=>renderChart(bars)]){try{fn()}catch(e){console.error(e)}}
 try{renderWatchlist()}catch(e){console.error(e)} try{renderPortfolio()}catch(e){console.error(e)} if(typeof renderBtst==="function"){try{renderBtst()}catch(e){console.error(e)}} else {try{renderBtstLocal()}catch(e){}}
 renderLive();$("upd").textContent="poll "+ist()+" IST · quotes asof "+(quoteAsOf?quoteAsOf.slice(11,19)+" IST":"unavailable")+(D&&D.graded_last_run?" · graded "+D.graded_last_run.slice(11):"");
 }finally{inFlight=false}
}
async function pollLoop(){clearTimeout(nextPoll);try{await refresh()}catch(e){console.error(e);failures=Math.min(failures+1,4)}finally{nextPoll=setTimeout(pollLoop,document.hidden||navigator.onLine===false?15000:Math.min(30000,2000*Math.pow(2,failures)))}}
document.addEventListener("visibilitychange",()=>{if(!document.hidden){clearTimeout(nextPoll);if(!inFlight)pollLoop()}});
window.addEventListener("online",()=>{clearTimeout(nextPoll);if(!inFlight)pollLoop()});

function defaultIndices(){ return ["NIFTY","BANKNIFTY","FINNIFTY","MIDCPNIFTY","NIFTYNXT50","SENSEX","BANKEX","SENSEX50","INDIAVIX","NIFTY100","NIFTY200","NIFTY500","NIFTYMIDCAP50","NIFTYMIDCAP100","NIFTYMIDCAP150","NIFTYSMLCAP50","NIFTYSMLCAP100","NIFTYSMLCAP250","NIFTYIT","NIFTYAUTO","NIFTYPHARMA","NIFTYMETAL","NIFTYFMCG","NIFTYENERGY","NIFTYREALTY","NIFTYMEDIA","NIFTYPSUBANK","NIFTYPVTBANK","NIFTYINFRA","NIFTYPSE","NIFTYMNC","NIFTYCONSUMPTION","NIFTYCOMMODITIES","NIFTYCPSE","NIFTYSERVSECTOR"]; }
function indexList(){
 try{
  const b=(typeof NL!=="undefined"&&NL.bundle&&NL.bundle.symbols)||{};
  if(b.indices&&b.indices.length) return b.indices.slice();
 }catch(e){}
 return defaultIndices();
}
function foList(){
 try{
  const b=(typeof NL!=="undefined"&&NL.bundle&&NL.bundle.symbols)||{};
  if(b.fo&&b.fo.length) return b.fo.slice();
  if(b.n50&&b.n50.length) return b.n50.slice();
 }catch(e){}
 return [];
}
function researchSymbols(){
 const set=new Set(defaultIndices());
 const st=(D&&D.state)||{};
 [...((D&&D.setups&&D.setups.setups)||[]),...(st.setups||[]),...(st.watch||[])].forEach(s=>{if(s&&s.symbol)set.add(s.symbol)});
 const ice=(D&&D.iceberg&&D.iceberg.signals)||{};
 [...(ice.armed||[]),...(ice.rows||[])].forEach(r=>{if(r&&r.symbol)set.add(r.symbol)});
 ((st.news_movers&&st.news_movers.rows)||[]).forEach(r=>{if(r&&r.symbol)set.add(r.symbol)});
 return set;
}
function watchUniverse(){
 const set=new Set(indexList());
 foList().forEach(s=>{if(s)set.add(s)});
 try{
  const b=(typeof NL!=="undefined"&&NL.bundle&&NL.bundle.symbols)||{};
  (b.n50||[]).forEach(s=>{if(s)set.add(s)});
  (b.extra||[]).forEach(s=>{if(s&&!/\d(CE|PE)$/.test(s))set.add(s)});
 }catch(e){}
 researchSymbols().forEach(s=>{if(s)set.add(s)});
 Object.keys(L||{}).forEach(s=>{if(s&&!/\d(CE|PE)$/.test(s))set.add(s)});
 return set;
}
function chartHref(sym){
  if(ON_PUBLIC) return "chart-view.html?symbol="+encodeURIComponent(sym);
  const k=rememberedKey();
  if(!k) return "public/chart-view.html?symbol="+encodeURIComponent(sym);
  return "?go=chart&k="+encodeURIComponent(k)+"&symbol="+encodeURIComponent(sym);
}
function quotesAreLastSession(){
 if(ltpAge!=null&&ltpAge>6*3600) return true;
 const as=String(quoteAsOf||"");
 if(!as) return false;
 const day=as.slice(0,10);
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});
 return day && day!==today;
}
function lastSessionLabel(){
 const as=String(quoteAsOf||"");
 const m=as.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
 const mon=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
 if(!m) return "Last session close";
 return "Last session close · "+Number(m[3])+" "+mon[Number(m[2])-1]+" "+m[4]+":"+m[5]+" IST";
}
function renderWatchlist(){
 const box=$("watchlist"); if(!box) return;
 const idxOrder=indexList();
 const idxSet=new Set(idxOrder);
 const q=wlFilter.trim().toLowerCase();
 const rows=[];
 watchUniverse().forEach(sym=>{
  if(!sym||/\d(CE|PE)$/.test(sym)) return;
  if(q && !String(sym).toLowerCase().includes(q)) return;
  const x=L[sym]||{};
  rows.push({symbol:sym,ltp:x.ltp,pct:x.pct,index:idxSet.has(sym)});
 });
 rows.sort((a,b)=>{
  if(a.index||b.index){
   if(a.index&&b.index){
    const pa=idxOrder.indexOf(a.symbol), pb=idxOrder.indexOf(b.symbol);
    return (pa<0?999:pa)-(pb<0?999:pb);
   }
   return a.index?-1:1;
  }
  return String(a.symbol).localeCompare(String(b.symbol));
 });
 const note=quotesAreLastSession()?`<div class="m" style="padding:6px 8px">${esc(lastSessionLabel())}</div>`:"";
 const rowHtml=x=>`<a class="wlrow ${x.symbol===chartSym?"on":""}" href="${chartHref(x.symbol)}" data-sym="${esc(x.symbol)}"><span class="wls">${esc(x.symbol)}</span><span class="wlpx">${x.ltp==null?"—":f(x.ltp, x.symbol==="INDIAVIX"?2:2)}</span><span class="wlp ${cl(x.pct)}">${x.pct==null||x.pct===undefined?"—":sg(x.pct)+"%"}</span></a>`;
 let html=note;
 if(!q){
  const ix=rows.filter(r=>r.index), st=rows.filter(r=>!r.index);
  if(ix.length) html+=`<div class="m" style="padding:8px 8px 2px">INDICES · ${ix.length}</div>`+ix.map(rowHtml).join("");
  if(st.length) html+=`<div class="m" style="padding:10px 8px 2px">F&amp;O STOCKS · ${st.length}</div>`+st.map(rowHtml).join("");
  if(!ix.length&&!st.length) html+='<div class="m" style="padding:8px">No symbols</div>';
 }else{
  html+=rows.map(rowHtml).join("")||'<div class="m" style="padding:8px">No symbols</div>';
 }
 box.innerHTML=html;
}
function forceChart(){ lastChartPoll=0; if(!inFlight){clearTimeout(nextPoll);pollLoop()} }
function closeWatchlist(){ document.body.classList.remove("wl-open"); }
function setChartSym(sym){
 if(!sym) return;
 chartSym=sym;
 localStorage.setItem("chartSym",sym);
 const lab=$("chartSymLabel"); if(lab) lab.textContent=sym;
 forceChart();
 renderWatchlist();
 closeWatchlist();
}
function setChartTf(tf){
 chartTf=tf;
 localStorage.setItem("chartTf",tf);
 document.querySelectorAll(".tfbtn").forEach(b=>b.classList.toggle("on",b.getAttribute("data-tf")===tf));
 forceChart();
}
function showTab(id){
 document.querySelectorAll(".tabbtn").forEach(b=>b.classList.toggle("on",b.getAttribute("data-tab")===id));
 document.querySelectorAll(".tabpane").forEach(p=>p.classList.toggle("on",p.getAttribute("data-tab")===id));
 localStorage.setItem("dashTab",id);
 const u=new URL(location.href); u.searchParams.set("tab",id); history.replaceState(null,"",u);
 if(id==="heat"||id==="portfolio"){ try{ if(id==="heat") renderHeat(); if(id==="portfolio") renderPortfolio(); }catch(e){} }
 requestAnimationFrame(()=>renderChart(bars));
}
function renderBtstLocal(){
 const box=$("btst")||$("btstSlot"); if(!box) return;
 const b=(D&&D.state&&D.state.btst)||{}, p=b.picks||[];
 const n=$("btstN"); if(n) n.textContent=(b.date||"")+(b.as_of?" · "+b.as_of+" IST":"");
 box.innerHTML=p.length?p.map(x=>{const lg=/LONG/i.test(x.side||""),q=L[x.symbol];return `<div class="card"><div class="h"><span><b class="${lg?"g":"p"}">${lg?"▲":"▼"} ${esc(x.symbol)}</b> <span class="badge ${lg?"g":"p"}" style="border:1px solid currentColor">${esc(x.side||"")} · ${esc(x.grade||"")}</span></span><span>${q?f(q.ltp):""}</span></div>
 <div class="lv"><span class="m">E <b class="dm">${esc(x.entry)}</b></span><span class="m">SL <b class="p">${esc(x.sl)}</b></span><span class="m">T1 <b class="g">${esc(x.t1)}</b></span>${x.t2?`<span class="m">T2 <b class="g">${esc(x.t2)}</b></span>`:""}</div>
 ${x.reason?`<div class="dm" style="font-size:11px;margin-bottom:4px;white-space:normal">${esc(x.reason)}</div>`:""}
 <div class="btns"><a class="btn" href="${lc(x.symbol)}" target="${ON_PUBLIC?"_self":"_blank"}">Live Chart</a><a class="btn" href="${tv(x.symbol)}" target="_blank" rel="noreferrer">TradingView</a></div></div>`}).join(""):'<div class="m">Aaj koi BTST/STBT pick nahi.</div>';
}
function iceHoldings(sig){
 const rows=((sig&&sig.rows)||[]).filter(r=>!r.backfill && /^(OPEN|T1_DONE|CLOSED)$/.test(String(r.status||"")));
 return rows.map(r=>{
  const open=r.status!=="CLOSED";
  const qty=(r.lots||2);
  const avg=r.premium_entry, ltp=open?(r.premium_ltp!=null?r.premium_ltp:r.premium_exit):null;
  const exit=open?ltp:null;
  const pnl=iceRowPnl(r), rr=iceRowR(r);
  return {book:"Iceberg", symbol:r.symbol, side:r.direction||"BUY", inst:r.contract||r.symbol, qty, avg, ltp: open?(r.premium_ltp!=null?r.premium_ltp:null): (r.lot1_exit!=null&&r.lot2_exit!=null?null:null), mark: open?(r.premium_ltp!=null?r.premium_ltp:(r.premium_exit!=null?r.premium_exit:null)): (function(){const a=r.lot1_exit,b=r.lot2_exit; if(a!=null&&b!=null&&a!==b) return null; return a!=null?a:(r.premium_exit!=null?r.premium_exit:null)})(), exitPx: iceExitPx(r), pnl, r:rr, status:r.status, why:iceRowWhy(r), t:r.closed_at||r.updated||r.ts||r.time||""};
 });
}
function aaHoldings(p){
 const out=[];
 (p.open||[]).forEach(o=>{
  out.push({book:"A/A+", symbol:o.symbol, side:o.side||"LONG", inst:o.mode==="option"&&o.contract?o.contract:o.symbol, qty:o.qtyOpenLots??o.lots??1, avg:o.fill, mark:o.ltp, exitPx:o.ltp!=null?f(o.ltp):"—", pnl:o.uPnl, r:o.uR, status:"OPEN", why:"", t:o.time||""});
 });
 (p.today||[]).forEach(x=>{
  out.push({book:"A/A+", symbol:x.symbol, side:x.side||"LONG", inst:x.mode==="option"&&x.contract?x.contract:x.symbol, qty:x.lots??1, avg:x.fill, mark:x.exit, exitPx:x.exit!=null?f(x.exit):"—", pnl:x.pnl, r:x.r, status:"CLOSED", why:x.reason||"", t:x.time||""});
 });
 return out;
}
function holdRow(o){
 const dir=/SELL|SHORT/i.test(o.side||"")?"p":"g";
 const pn=o.pnl==null?"—":("₹"+sg(o.pnl,0));
 const rs=o.r==null?"—":sg(o.r,2)+"R";
 const mark=o.exitPx!=null&&o.exitPx!=="—"?o.exitPx:(o.mark!=null?f(o.mark):"—");
 return `<tr><td>${esc(o.book)}</td><td><span class="${dir}">${/SELL|SHORT/i.test(o.side||"")?"▼":"▲"}</span> ${esc(o.symbol||"")}</td><td>${esc(o.side||"")}</td><td style="white-space:normal">${esc(o.inst||"")}</td><td>${esc(o.qty)}</td><td>${o.avg==null?"—":f(o.avg)}</td><td>${mark}</td><td class="${o.pnl==null?"dm":cl(o.pnl)}">${pn}</td><td class="${o.r==null?"dm":cl(o.r)}">${rs}</td><td>${esc(o.status||"")}${o.why?" · "+esc(o.why):""}</td></tr>`;
}
function drawCurve(svgId, series, color){
 const svg=$(svgId); if(!svg) return;
 const W=svg.clientWidth||420, H=svg.clientHeight||120;
 if(!series||series.length<1){svg.innerHTML='<text x="12" y="24" fill="#6B7280" font-size="11">No closed trades to plot yet</text>';svg.setAttribute("viewBox",`0 0 ${W} ${H}`);return;}
 const ys=series.map(p=>p.v), lo=Math.min(0,...ys), hi=Math.max(0,...ys), pad=(hi-lo)*0.12||100;
 const min=lo-pad, max=hi+pad, R=54;
 const x=i=> 8+(W-R-16)*(series.length===1?0.5:i/(series.length-1));
 const y=v=> 8+(H-24)*(1-(v-min)/(max-min||1));
 let d=series.map((p,i)=>(i?"L":"M")+x(i)+","+y(p.v)).join(" ");
 const z=y(0);
 let s=`<line x1="8" x2="${W-R}" y1="${z}" y2="${z}" stroke="#2a2e39"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8"/>`;
 series.forEach((p,i)=>{if(i===0||i===series.length-1||i%Math.max(1,Math.ceil(series.length/5))===0)s+=`<text x="${x(i)}" y="${H-4}" fill="#6B7280" font-size="9" text-anchor="middle">${esc(String(p.t||"").slice(0,5))}</text>`});
 s+=`<text x="${W-2}" y="${y(hi)+3}" fill="#6B7280" font-size="9" text-anchor="end">₹${sg(hi,0)}</text>`;
 s+=`<text x="${W-2}" y="${y(lo)+3}" fill="#6B7280" font-size="9" text-anchor="end">₹${sg(lo,0)}</text>`;
 const last=series[series.length-1];
 s+=`<circle cx="${x(series.length-1)}" cy="${y(last.v)}" r="3" fill="${color}"/><text x="${W-2}" y="${y(last.v)+3}" fill="${color}" font-size="10" text-anchor="end">₹${sg(last.v,0)}</text>`;
 svg.setAttribute("viewBox",`0 0 ${W} ${H}`);svg.innerHTML=s;
}
function cumPts(items){
 const pts=[{t:"open",v:0}];
 let c=0;
 items.forEach(x=>{c+=Number(x.pnl)||0; pts.push({t:x.t||"",v:c});});
 return pts;
}
function iceBooksSum(){
 const books=(D&&D.iceberg_books&&D.iceberg_books.books)||{};
 const names=["BASE","A2","C"];
 let dayP=0,dayR=0,allP=0,allR=0,dayT=0,allT=0,open=0,bits=[];
 let used=false;
 for(const n of names){
  const b=books[n]||{};
  if(!b.today && !b.all) continue;
  used=true;
  const tod=b.today||{}, all=b.all||{};
  dayP+=Number(tod.total_pnl)||0; dayR+=Number(tod.total_r)||0; dayT+=Number(tod.trades)||0;
  allP+=Number(all.total_pnl)||0; allR+=Number(all.total_r)||0; allT+=Number(all.trades)||0;
  open+=Number(b.open_now)||0;
  bits.push(`${n} ₹${sg(all.total_pnl,0)}`);
 }
 if(!used){
  const st=((D&&D.iceberg&&D.iceberg.signals)||{}).stats||{};
  const tod=st.today||{}, all=st.all||{};
  return {dayP:Number(tod.total_pnl)||0,dayR:Number(tod.total_r)||0,allP:Number(all.total_pnl)||0,allR:Number(all.total_r)||0,dayT:tod.trades||0,allT:all.trades||0,open:st.open_now||0,meta:"BASE only (books feed missing)"};
 }
 return {dayP,dayR,allP,allR,dayT,allT,open,meta:bits.join(" · ")};
}
function renderPortfolio(){
 const root=$("portfolioBody"); if(!root) return;
 const p=(D&&D.paper)||{}, d=p.day||{}, t=p.total||{};
 const sig=(D&&D.iceberg&&D.iceberg.signals)||{};
 const w=(D&&D.state&&D.state.watch_long)||(D&&D.watch_long)||{};
 const wd=w.day||{}, wt=w.total||{};
 const vbooks=(((D&&D.state&&D.state.variants)||{}).books)||[];
 const mech=(Array.isArray(vbooks)?vbooks:[]).find(b=>String((b&&b.book)||"").includes("MECH"))||{};
 const md=mech.day||{}, mt=mech.total||{};
 const ice=iceBooksSum();
 const aaRows=aaHoldings(p), iceRows=iceHoldings(sig);
 const aaOpen=aaRows.filter(r=>r.status==="OPEN").length, iceOpen=iceRows.filter(r=>r.status!=="CLOSED").length;
 const setH=(id,html)=>{const el=root.querySelector("#"+id); if(el) el.innerHTML=html;};
 const setT=(id,txt)=>{const el=root.querySelector("#"+id); if(el) el.textContent=txt;};
 setH("pfAaDay",`<b class="${cl(d.pnl)}">₹${sg(d.pnl,0)} / ${sg(d.r)}R</b>`);
 setH("pfAaAll",`<b class="${cl(t.pnl)}">₹${sg(t.pnl,0)} / ${sg(t.r)}R</b>`);
 setT("pfAaMeta",`win ${f(t.winRate,0)}% · ${t.trades||0} trades · open ${aaOpen}`);
 setH("pfWlDay",`<b class="${cl(wd.pnl)}">₹${sg(wd.pnl,0)} / ${sg(wd.r)}R</b>`);
 setH("pfWlAll",`<b class="${cl(wt.pnl)}">₹${sg(wt.pnl,0)} / ${sg(wt.r)}R</b>`);
 setT("pfWlMeta",`win ${f(wt.winRate,0)}% · ${wt.trades||0} trades · open ${(w.open||[]).length}`);
 setH("pfIceDay",`<b class="${cl(ice.dayP)}">₹${sg(ice.dayP,0)} / ${sg(ice.dayR,2)}R</b>`);
 setH("pfIceAll",`<b class="${cl(ice.allP)}">₹${sg(ice.allP,0)} / ${sg(ice.allR,2)}R</b>`);
 setT("pfIceMeta",`${ice.meta||""} · today ${ice.dayT||0} closed · open ${ice.open||iceOpen}`);
 setH("pfMechDay",`<b class="${cl(md.pnl)}">₹${sg(md.pnl,0)} / ${sg(md.r)}R</b>`);
 setH("pfMechAll",`<b class="${cl(mt.pnl)}">₹${sg(mt.pnl,0)} / ${sg(mt.r)}R net</b>`);
 setT("pfMechMeta",`gross ₹${sg(mt.pnl_gross||md.pnl_gross,0)} · ${(mt.charges??md.charges)!=null?`charges ₹${sg(mt.charges??md.charges,0)} · slippage ₹${sg(mt.slippage??md.slippage,0)}`:`costs ₹${sg(mt.costs||md.costs,0)}`} · ${mt.trades||0} trades · open ${(mech.open||[]).length}`);
 const sumD=(Number(d.pnl)||0)+(Number(wd.pnl)||0)+ice.dayP+(Number(md.pnl)||0);
 const sumA=(Number(t.pnl)||0)+(Number(wt.pnl)||0)+ice.allP+(Number(mt.pnl)||0);
 const hist=((D&&D.portfolio_history)||{}).combined||{};
 const histAll=(hist.all&&hist.all.pnl!=null)?Number(hist.all.pnl):sumA;
 setH("pfSumDay",`<b class="${cl(sumD)}">₹${sg(sumD,0)}</b>`);
 setH("pfSumAll",`<b class="${cl(histAll)}">₹${sg(histAll,0)}</b>`);
 setT("pfSumMeta",`A/A+ + WATCH-LONG + ICEBERG (BASE+A2+C) + MECH net. CAP* empty. Broker holdings not included. A/A++iceberg only ₹${sg((Number(t.pnl)||0)+ice.allP,0)}.`);
 const th=`<tr><th>BOOK</th><th>SYMBOL</th><th>SIDE</th><th>INSTRUMENT</th><th>QTY</th><th>AVG</th><th>LTP / EXIT</th><th>₹ P&amp;L</th><th>R</th><th>STATUS</th></tr>`;
 root.querySelector("#pfAaTable").innerHTML=`<table>${th}`+(aaRows.map(holdRow).join("")||`<tr><td colspan="10" class="m">no A/A+ paper rows today</td></tr>`)+`</table>`;
 root.querySelector("#pfIceTable").innerHTML=`<table>${th}`+(iceRows.map(holdRow).join("")||`<tr><td colspan="10" class="m">no iceberg paper rows</td></tr>`)+`</table>`;
 const aaClosed=aaRows.filter(r=>r.status==="CLOSED").slice().sort((a,b)=>String(a.t).localeCompare(String(b.t)));
 const iceClosed=iceRows.filter(r=>r.status==="CLOSED").slice().sort((a,b)=>String(a.t).localeCompare(String(b.t)));
 drawCurve("pfAaCurve", cumPts(aaClosed), "#4CC9F0");
 drawCurve("pfIceCurve", cumPts(iceClosed), "#3DDBD9");
 const merged=[...aaClosed.map(x=>({...x,_b:"aa"})),...iceClosed.map(x=>({...x,_b:"ice"}))].sort((a,b)=>String(a.t).localeCompare(String(b.t)));
 drawCurve("pfCombCurve", cumPts(merged), "#2962FF");
 const eq=(((D&&D.portfolio_history)||{}).equity_curve)||[];
 const histPts=eq.map(x=>({t:x.date,pnl:x.pnl,cum:x.cum}));
 if(histPts.length){
  const pts=histPts.map((x,i)=>({t:x.t,v:x.cum!=null?x.cum:null}));
  // drawCurve expects cumPts items with .pnl; build synthetic cumulative points
  drawCurve("pfHistCurve", histPts.map(x=>({t:x.t,pnl:x.pnl})), "#F5A623");
 }
}
function brokerCard(a){
 const creds=(a.credentials_required||[]).map(c=>`<li><b>${esc(c.name)}</b> — ${esc(c.why)}</li>`).join("");
 return `<div class="brokerCard" data-broker="${esc(a.id)}">
  <div class="h"><span><b>${esc(a.broker)}</b> <span class="m">${esc(a.api)}</span></span><span class="badge a" style="border:1px solid currentColor">NOT CONNECTED</span></div>
  <div class="dm" style="white-space:normal;margin:4px 0 6px">${esc(a.used_for||"Read-only holdings / P&L.")} This terminal will never place orders.</div>
  <button type="button" class="btn connBtn" data-broker="${esc(a.id)}">Connect</button>
 </div>`;
}
async function loadBrokers(){
 const box=$("brokerCards"); if(!box) return;
 try{
  brokersCache=await api("/api/brokers");
 }catch(e){
  brokersCache={connect_wired:false,connect_flow:"Connect is not active yet. It will be wired to a secure secret-input vault later. This terminal never accepts or stores API keys or secrets.",accounts:[
   {id:"angelone",broker:"Angel One",api:"SmartAPI",used_for:"Holdings, positions, and P&L view only.",credentials_required:[
    {name:"Client ID",why:"Angel One trading user / client code"},
    {name:"API Key",why:"SmartAPI app key from the Angel One developer portal"},
    {name:"MPIN or password",why:"Used only to open a SmartAPI session"},
    {name:"TOTP secret or current TOTP",why:"2FA for the session. The TOTP secret belongs in a vault, not this dashboard"}]},
   {id:"zerodha",broker:"Zerodha Kite",api:"Kite Connect",used_for:"Holdings, positions, and P&L view only.",credentials_required:[
    {name:"API Key",why:"Kite Connect app key"},
    {name:"API Secret",why:"Server-side only, to exchange request_token for access_token. Never sent to the browser"},
    {name:"Official Kite Connect login redirect",why:"Produces a request_token, then an access_token. Do not type your Zerodha password into this terminal"}]}
  ]};
 }
 box.innerHTML=(brokersCache.accounts||[]).map(brokerCard).join("");
}
function openBrokerModal(id){
 const a=((brokersCache&&brokersCache.accounts)||[]).find(x=>x.id===id);
 const modal=$("brokerModal"); if(!modal||!a) return;
 $("brokerModalTitle").textContent="Connect "+a.broker+" · read-only";
 $("brokerModalBody").innerHTML=`<p>This flow is <b>not wired yet</b>. When it is, credentials will be entered through a secure secret-input vault — they will <b>not</b> be typed into or stored on this dashboard.</p>
  <p>${esc((brokersCache&&brokersCache.connect_flow)||"")}</p>
  <p><b>What ${esc(a.broker)} needs (for a later read-only connection):</b></p>
  <ul>${(a.credentials_required||[]).map(c=>`<li><b>${esc(c.name)}</b> — ${esc(c.why)}</li>`).join("")}</ul>
  <p class="a">Read-only: holdings, positions, and P&L. This terminal will never place or modify orders. Do not paste keys here.</p>`;
 modal.classList.add("show");
}
function bindUi(){
 document.querySelectorAll(".tfbtn").forEach(b=>{
  b.classList.toggle("on", b.getAttribute("data-tf")===chartTf);
  b.onclick=()=>setChartTf(b.getAttribute("data-tf"));
 });
 document.querySelectorAll(".tabbtn").forEach(b=>b.onclick=()=>showTab(b.getAttribute("data-tab")));
 const want=new URLSearchParams(location.search).get("tab")||localStorage.getItem("dashTab")||"aa";
 showTab(want);
 const lab=$("chartSymLabel"); if(lab) lab.textContent=chartSym;
 const wl=$("watchlist");
 if(wl) wl.addEventListener("click",e=>{
  const row=e.target.closest("[data-sym]"); if(!row) return;
  if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
  if(ON_PUBLIC) return; /* public: follow chart-view.html so the full chart opens */
  e.preventDefault();
  setChartSym(row.getAttribute("data-sym"));
 });
 const s=$("symSearch"); if(s) s.addEventListener("input",()=>{wlFilter=s.value; renderWatchlist();});
 const tog=$("wlToggle"); if(tog) tog.onclick=()=>document.body.classList.toggle("wl-open");
 const wlc=$("wlClose"); if(wlc) wlc.onclick=closeWatchlist;
 const wlb=$("wlBackdrop"); if(wlb) wlb.addEventListener("click",closeWatchlist);
 document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeWatchlist(); });
 const br=$("brokerCards");
 if(br) br.addEventListener("click",e=>{const btn=e.target.closest(".connBtn"); if(btn) openBrokerModal(btn.getAttribute("data-broker"));});
 const close=$("brokerModalClose"), modal=$("brokerModal");
 if(close) close.onclick=()=>modal.classList.remove("show");
 if(modal) modal.addEventListener("click",e=>{if(e.target===modal) modal.classList.remove("show");});
 loadBrokers();
}
function tickClock(){
 const el=$("istClock");
 if(el) el.textContent=new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata",hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"})+" IST";
}

bindUi();
tickClock();
function renderSrc(){const b=NL.badgeHTML(),e=$("srcBadge");e.className="srcb "+b.cls;e.innerHTML=b.html}
NL.onChange(()=>{renderSrc();if(!inFlight){clearTimeout(nextPoll);pollLoop()}});
pollLoop();const _vis=f=>()=>{if(!document.hidden)f()};setInterval(_vis(renderLive),1000);setInterval(_vis(renderSrc),1000);renderSrc();setInterval(_vis(tickClock),1000);
window.addEventListener("resize",()=>renderChart(bars));
})();
