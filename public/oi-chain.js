/* oi-chain.js — strike-wise OI view for NIFTY + SENSEX index options (data only, paper/demo).
   Reads NL.bundle.oi_chain (private sealed feed or keyless public feed; same shape).
   Renders into every element with [data-oichain]. Plain SVG, no library. Never links chart.html. */
(function(){
"use strict";
var ST={idx:"NIFTY",exp:0,mode:"oi"};
try{var s=JSON.parse(localStorage.getItem("oiChainUi")||"{}");if(s.idx)ST.idx=s.idx;if(s.mode)ST.mode=s.mode;}catch(e){}
function save(){try{localStorage.setItem("oiChainUi",JSON.stringify({idx:ST.idx,mode:ST.mode}))}catch(e){}}
var RED="#FF4D6D",RED_L="#7a2a3a",GRN="#00C98B",GRN_L="#1f5a47",AMB="#F5A623",BLU="#4CC9F0";
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fmt(n){if(n==null||isNaN(n))return "—";var a=Math.abs(n),s=n<0?"−":"";
 if(a>=1e7)return s+(a/1e7).toFixed(a>=1e8?1:2)+"Cr";if(a>=1e5)return s+(a/1e5).toFixed(a>=1e6?1:2)+"L";if(a>=1e3)return s+(a/1e3).toFixed(1)+"K";return s+Math.round(a)}
function sfmt(n){if(n==null||isNaN(n))return "—";return (n>0?"+":n<0?"":"")+fmt(n)}
function px(n,d){if(n==null||isNaN(n))return "—";return Number(n).toLocaleString("en-IN",{minimumFractionDigits:d==null?2:d,maximumFractionDigits:d==null?2:d})}
function arrow(n){return n==null||n===0?"":(n>0?"▲":"▼")}
function cls(n){return n==null||n===0?"oc-0":(n>0?"oc-up":"oc-dn")}
function chg(n){if(n==null)return '<span class="oc-0">—</span>';return '<span class="'+cls(n)+'">'+arrow(n)+" "+sfmt(n)+"</span>"}
/* % change computed in the browser from OI and its change (base = OI before the change); no extra feed fields */
function pct(ch,cur){if(ch==null||cur==null)return null;var b=cur-ch;if(!(b>0))return null;return ch/b*100}
function pfmt(p){if(p==null||isNaN(p))return "";var a=Math.abs(p);return (p>0?"+":p<0?"−":"")+(a>=100?a.toFixed(0):a.toFixed(1))+"%"}
function pspan(p,extra){if(p==null||isNaN(p))return "";return '<span class="oc-pct '+(p>0?"oc-up":p<0?"oc-dn":"oc-0")+(extra?" "+extra:"")+'">'+pfmt(p)+'</span>'}
var BU={"Long build-up":["LB","oc-lb"],"Short build-up":["SB","oc-sb"],"Short covering":["SC","oc-sc"],"Long unwinding":["LU","oc-lu"]};
function bu(b){if(!b||!BU[b])return '<span class="oc-0">—</span>';return '<span class="oc-bu '+BU[b][1]+'" title="'+esc(b)+'"><b class="oc-bus">'+BU[b][0]+'</b><span class="oc-bul">'+esc(b)+'</span></span>'}
function ist(ts){if(!ts)return "—";var d=new Date(ts);if(isNaN(d))return esc(ts);return d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Kolkata"})+" IST"}
function dlabel(iso){if(!iso)return "";var d=new Date(iso+"T00:00:00+05:30");return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",timeZone:"Asia/Kolkata"})}

/* ---------- strike butterfly: CE bars left (red), PE bars right (green) ---------- */
function butterfly(ex,idx,W,mode){
 var rows=(ex.rows||[]).slice().sort(function(a,b){return b.k-a.k});
 if(!rows.length)return '<div class="oc-empty">Strikes ka data nahi</div>';
 var narrow=W<560,mid=narrow?60:84,lab=narrow?96:176,rh=narrow?26:28,top=30,H=top+rows.length*rh+26;
 var half=(W-mid)/2,barW=Math.max(30,half-lab-10);
 function val(l){if(!l)return null;if(mode==="d15")return l.d15;if(mode==="doi")return l.doi;return l.oi}
 var mx=1;rows.forEach(function(r){["ce","pe"].forEach(function(s){var l=r[s];if(!l)return;
   if(mode==="oi"){var p=(l.oi||0)-(l.doi||0);mx=Math.max(mx,l.oi||0,p)}else{var v=val(l);if(v!=null)mx=Math.max(mx,Math.abs(v))}})});
 var sc=function(v){return Math.max(0,v)/mx*barW};
 var o=['<svg class="oc-svg" viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="xMidYMin meet">',
  '<defs><pattern id="ocHatchR" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="none"/><line x1="0" y1="0" x2="0" y2="6" stroke="'+RED+'" stroke-width="2"/></pattern>',
  '<pattern id="ocHatchG" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="none"/><line x1="0" y1="0" x2="0" y2="6" stroke="'+GRN+'" stroke-width="2"/></pattern></defs>'];
 var ttl=mode==="oi"?(narrow?"OI + aaj ka % · bright = add · dhaariyan = kam":"OI + aaj ka % change (bright = aaj add hua · dhaariyan = aaj kam hua)"):mode==="doi"?"OI change + % vs pichhla din":"OI change + % · last 15 min";
 o.push('<text x="2" y="16" class="oc-t" fill="'+RED+'">CALL (CE)</text>');
 o.push('<text x="'+(W-2)+'" y="16" text-anchor="end" class="oc-t" fill="'+GRN+'">PUT (PE)</text>');
 o.push('<text x="'+(W/2)+'" y="16" text-anchor="middle" class="oc-ts">STRIKE</text>');
 rows.forEach(function(r,i){
  var y=top+i*rh,cy=y+rh/2;
  if(r.atm)o.push('<rect x="0" y="'+y+'" width="'+W+'" height="'+rh+'" fill="#2962FF" opacity=".16"/>');
  if(r.k===ex.res)o.push('<rect x="'+(half)+'" y="'+(y+1)+'" width="'+mid+'" height="'+(rh-2)+'" fill="none" stroke="'+RED+'" stroke-width="1.5" rx="3"/>');
  if(r.k===ex.sup)o.push('<rect x="'+(half)+'" y="'+(y+1)+'" width="'+mid+'" height="'+(rh-2)+'" fill="none" stroke="'+GRN+'" stroke-width="1.5" rx="3"/>');
  o.push('<text x="'+(W/2)+'" y="'+(cy+4.5)+'" text-anchor="middle" class="oc-k'+(r.atm?" oc-katm":"")+'">'+px(r.k,0)+'</text>');
  ["ce","pe"].forEach(function(s){
   var l=r[s];if(!l)return;var left=s==="ce",C=left?RED:GRN,CL=left?RED_L:GRN_L,H2=left?"url(#ocHatchR)":"url(#ocHatchG)";
   var x0=left?half:half+mid,bh=rh-8,by=y+4,txt="",tc="#D1D4DC";
   function bar(a,b,fill,op){var w=Math.abs(b-a);if(w<.5)return;var xa=left?x0-6-Math.max(a,b):x0+6+Math.min(a,b);o.push('<rect x="'+xa.toFixed(1)+'" y="'+by+'" width="'+w.toFixed(1)+'" height="'+bh+'" fill="'+fill+'"'+(op?' opacity="'+op+'"':'')+' rx="2"/>')}
   var end=0,pv=null;
   if(mode==="oi"){
    var cur=l.oi||0,d=l.doi,prev=d==null?cur:cur-d;
    if(d!=null&&d>0){bar(0,sc(prev),CL);bar(sc(prev),sc(cur),C);end=sc(cur)}
    else if(d!=null&&d<0){bar(0,sc(cur),CL);bar(sc(cur),sc(prev),H2);o.push('<rect x="'+(left?x0-6-sc(prev):x0+6+sc(cur)).toFixed(1)+'" y="'+by+'" width="'+(sc(prev)-sc(cur)).toFixed(1)+'" height="'+bh+'" fill="none" stroke="'+C+'" stroke-width="1" stroke-dasharray="3 2" rx="2"/>');end=sc(prev)}
    else{bar(0,sc(cur),CL);end=sc(cur)}
    txt=fmt(cur)+(d&&!narrow?(" "+arrow(d)+fmt(Math.abs(d))):"");tc="#E5E7EB";pv=pct(d,cur);
   }else{
    var v=val(l);if(v==null){txt="—"}else{if(v>=0)bar(0,sc(v),C);else{bar(0,sc(-v),H2);o.push('<rect x="'+(left?x0-6-sc(-v):x0+6).toFixed(1)+'" y="'+by+'" width="'+sc(-v).toFixed(1)+'" height="'+bh+'" fill="none" stroke="'+C+'" stroke-width="1" stroke-dasharray="3 2" rx="2"/>')}
     end=sc(Math.abs(v));txt=arrow(v)+(narrow?"":" ")+sfmt(v);tc=v>0?"#00C98B":v<0?"#FF4D6D":"#D1D4DC";pv=pct(v,l.oi)}
   }
   /* labels sit at the outer edge (CE left, PE right), bars grow from the strike column */
   var tx=left?2:W-2;
   var pc=pv==null?"":'<tspan dx="4" class="oc-vp" fill="'+(pv>0?"#00C98B":pv<0?"#FF4D6D":"#9CA3AF")+'">'+pfmt(pv)+'</tspan>';
   o.push('<text x="'+tx+'" y="'+(cy+4)+'" text-anchor="'+(left?"start":"end")+'" class="oc-v"><tspan fill="'+tc+'">'+esc(txt)+'</tspan>'+pc+'</text>');
  });
 });
 // spot line between strikes
 var sp=idx.spot;if(sp!=null&&rows.length>1){
  var hi=rows[0].k,lo=rows[rows.length-1].k;
  if(sp<=hi&&sp>=lo){var step=(hi-lo)/(rows.length-1),f=(hi-sp)/step,yy=top+f*rh+rh/2,yb=top+Math.round(f+.5)*rh;
   o.push('<line x1="'+(half-6-barW)+'" x2="'+(half+mid+6+barW)+'" y1="'+yy.toFixed(1)+'" y2="'+yy.toFixed(1)+'" stroke="'+AMB+'" stroke-width="1.6" stroke-dasharray="6 4"/>');
   /* pill sits on the row boundary nearest the spot so it never covers a strike number */
   o.push('<rect x="'+(W/2-44)+'" y="'+(yb-6.5)+'" width="88" height="13" rx="6.5" fill="'+AMB+'"/>');
   o.push('<text x="'+(W/2)+'" y="'+(yb+3.5)+'" text-anchor="middle" class="oc-spot">SPOT '+px(sp,0)+'</text>');}
 }
 o.push('<text x="4" y="'+(H-8)+'" class="oc-ts">'+esc(ttl)+'</text>');
 o.push('</svg>');return o.join("");
}

/* ---------- intraday: spot + total CE/PE OI change + PCR ---------- */
function daychart(idx,W){
 var S=(idx.series||[]).filter(function(p){return p&&p.t});
 if(S.length<2)return '<div class="oc-empty">Din ka OI chart market khulne ke kuch minute baad banega (har 2 min point).</div>';
 var narrow=W<560,L=narrow?44:56,R=narrow?40:50,T=22,H1=narrow?110:130,G=26,H2=narrow?150:180,B=24,H=T+H1+G+H2+B,iw=W-L-R;
 function mins(t){var a=t.split(":");return +a[0]*60+(+a[1])}
 var t0=555,t1=Math.max(930,mins(S[S.length-1].t));
 var X=function(t){return L+(mins(t)-t0)/(t1-t0)*iw};
 var o=['<svg class="oc-svg" viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="xMidYMin meet">'];
 // spot panel
 var sp=S.filter(function(p){return p.spot!=null});
 o.push('<text x="'+L+'" y="14" class="oc-t" fill="'+BLU+'">'+esc(idx._name||"")+' spot</text>');
 if(sp.length>1){var a=Math.min.apply(null,sp.map(function(p){return p.spot})),b=Math.max.apply(null,sp.map(function(p){return p.spot}));if(b-a<1){a-=1;b+=1}
  var pad=(b-a)*.08;a-=pad;b+=pad;var Y=function(v){return T+H1-(v-a)/(b-a)*H1};
  [a+pad,b-pad].forEach(function(v){o.push('<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="#2a2e39"/><text x="'+(L-4)+'" y="'+(Y(v)+4)+'" text-anchor="end" class="oc-ax">'+px(v,0)+'</text>')});
  o.push('<polyline fill="none" stroke="'+BLU+'" stroke-width="2" points="'+sp.map(function(p){return X(p.t).toFixed(1)+","+Y(p.spot).toFixed(1)}).join(" ")+'"/>');
 }else o.push('<text x="'+(L+8)+'" y="'+(T+H1/2)+'" class="oc-ax">spot series nahi</text>');
 // OI change panel
 var y0=T+H1+G,vals=[];S.forEach(function(p){vals.push(p.ce_doi||0,p.pe_doi||0)});
 var lo=Math.min(0,Math.min.apply(null,vals)),hi=Math.max(0,Math.max.apply(null,vals));if(hi-lo<1)hi=lo+1;var pd=(hi-lo)*.08;lo-=pd;hi+=pd;
 var Y2=function(v){return y0+H2-(v-lo)/(hi-lo)*H2};
 o.push('<text x="'+L+'" y="'+(y0-8)+'" class="oc-t"><tspan fill="'+RED+'">━ CE OI Δ</tspan>  <tspan fill="'+GRN+'">━ PE OI Δ</tspan>  <tspan fill="'+AMB+'">┅ PCR</tspan></text>');
 o.push('<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y2(0)+'" y2="'+Y2(0)+'" stroke="#6B7280" stroke-dasharray="2 3"/>');
 [hi-pd,0,lo+pd].forEach(function(v){if(v===0&&(hi-pd===0||lo+pd===0))return;o.push('<text x="'+(L-4)+'" y="'+(Y2(v)+4)+'" text-anchor="end" class="oc-ax">'+sfmt(v)+'</text>')});
 o.push('<polyline fill="none" stroke="'+RED+'" stroke-width="2.4" points="'+S.map(function(p){return X(p.t).toFixed(1)+","+Y2(p.ce_doi||0).toFixed(1)}).join(" ")+'"/>');
 o.push('<polyline fill="none" stroke="'+GRN+'" stroke-width="2.4" points="'+S.map(function(p){return X(p.t).toFixed(1)+","+Y2(p.pe_doi||0).toFixed(1)}).join(" ")+'"/>');
 var pc=S.filter(function(p){return p.pcr!=null});
 if(pc.length>1){var pa=Math.min.apply(null,pc.map(function(p){return p.pcr})),pb=Math.max.apply(null,pc.map(function(p){return p.pcr}));if(pb-pa<.05){pa-=.025;pb+=.025}
  var Y3=function(v){return y0+H2-(v-pa)/(pb-pa)*H2*.9-H2*.05};
  o.push('<polyline fill="none" stroke="'+AMB+'" stroke-width="1.6" stroke-dasharray="5 3" points="'+pc.map(function(p){return X(p.t).toFixed(1)+","+Y3(p.pcr).toFixed(1)}).join(" ")+'"/>');
  [pa,pb].forEach(function(v){o.push('<text x="'+(W-R+4)+'" y="'+(Y3(v)+4)+'" class="oc-ax" fill="'+AMB+'">'+v.toFixed(2)+'</text>')});
  var lp=pc[pc.length-1];o.push('<circle cx="'+X(lp.t)+'" cy="'+Y3(lp.pcr)+'" r="3" fill="'+AMB+'"/>');
 }
 var last=S[S.length-1];
 [[last.ce_doi,RED],[last.pe_doi,GRN]].forEach(function(z){o.push('<circle cx="'+X(last.t)+'" cy="'+Y2(z[0]||0)+'" r="3.5" fill="'+z[1]+'"/>')});
 // x axis
 ["09:15","10:30","11:30","12:30","13:30","14:30","15:30"].forEach(function(t){var x=X(t);o.push('<line x1="'+x+'" x2="'+x+'" y1="'+T+'" y2="'+(y0+H2)+'" stroke="#2a2e39" stroke-width=".6"/><text x="'+x+'" y="'+(H-6)+'" text-anchor="middle" class="oc-ax">'+(narrow&&t!=="09:15"&&t!=="15:30"?t.slice(0,2):t)+'</text>')});
 o.push('</svg>');return o.join("");
}

function card(k,v,sub,c,x){return '<div class="oc-card'+(x?" "+x:"")+'"><div class="oc-ck">'+k+'</div><div class="oc-cv '+(c||"")+'">'+v+'</div>'+(sub?'<div class="oc-cs">'+sub+'</div>':"")+'</div>'}

function table(ex){
 var rows=(ex.rows||[]).slice().sort(function(a,b){return a.k-b.k});
 var h=['<div class="oc-tw"><table class="oc-tbl"><thead><tr class="oc-side"><th colspan="6" class="oc-ceh oc-x">CALLS (CE)</th><th colspan="2" class="oc-ceh oc-y">CALLS (CE)</th><th></th><th colspan="6" class="oc-peh oc-x">PUTS (PE)</th><th colspan="2" class="oc-peh oc-y">PUTS (PE)</th></tr><tr>',
  '<th class="oc-x">Build-up</th><th class="oc-x">LTP</th><th class="oc-x">15m</th><th class="oc-x">5m</th><th>Δ Day</th><th>OI</th><th class="oc-st">Strike</th><th>OI</th><th>Δ Day</th><th class="oc-x">5m</th><th class="oc-x">15m</th><th class="oc-x">LTP</th><th class="oc-x">Build-up</th></tr></thead><tbody>'];
 rows.forEach(function(r){var c=r.ce||{},p=r.pe||{};
  var itmC=r.k<(ex._spot||0),itmP=r.k>(ex._spot||Infinity);
  h.push('<tr class="'+(r.atm?"oc-atm":"")+'">',
   '<td class="oc-x">'+bu(c.bu)+'</td>',
   '<td class="oc-x'+(itmC?" oc-itm":"")+'">'+px(c.ltp)+'<div class="'+cls(c.lc)+' oc-sm">'+(c.lc==null?"":arrow(c.lc)+" "+px(Math.abs(c.lc)))+'</div></td>',
   '<td class="oc-x">'+chg(c.d15)+'<div class="oc-sm">'+pspan(pct(c.d15,c.oi))+'</div></td><td class="oc-x">'+chg(c.d5)+'<div class="oc-sm">'+pspan(pct(c.d5,c.oi))+'</div></td>',
   '<td>'+chg(c.doi)+'<div class="oc-sm">'+pspan(pct(c.doi,c.oi))+'</div><div class="oc-sm oc-m15">15m '+(pct(c.d15,c.oi)==null?'<span class="oc-0">—</span>':pspan(pct(c.d15,c.oi)))+'</div></td>',
   '<td class="oc-oi'+(r.k===ex.res?" oc-maxc":"")+(itmC?" oc-itm":"")+'">'+fmt(c.oi)+'</td>',
   '<td class="oc-st">'+px(r.k,0)+(r.atm?'<div class="oc-sm oc-atml">ATM</div>':"")+'</td>',
   '<td class="oc-oi'+(r.k===ex.sup?" oc-maxp":"")+(itmP?" oc-itm":"")+'">'+fmt(p.oi)+'</td>',
   '<td>'+chg(p.doi)+'<div class="oc-sm">'+pspan(pct(p.doi,p.oi))+'</div><div class="oc-sm oc-m15">15m '+(pct(p.d15,p.oi)==null?'<span class="oc-0">—</span>':pspan(pct(p.d15,p.oi)))+'</div></td>',
   '<td class="oc-x">'+chg(p.d5)+'<div class="oc-sm">'+pspan(pct(p.d5,p.oi))+'</div></td><td class="oc-x">'+chg(p.d15)+'<div class="oc-sm">'+pspan(pct(p.d15,p.oi))+'</div></td>',
   '<td class="oc-x'+(itmP?" oc-itm":"")+'">'+px(p.ltp)+'<div class="'+cls(p.lc)+' oc-sm">'+(p.lc==null?"":arrow(p.lc)+" "+px(Math.abs(p.lc)))+'</div></td>',
   '<td class="oc-x">'+bu(p.bu)+'</td></tr>');
 });
 var t=ex.tot||{};
 h.push('</tbody><tfoot><tr><td class="oc-x"></td><td class="oc-x"></td><td class="oc-x">'+chg(t.ce_d15)+'<div class="oc-sm">'+pspan(pct(t.ce_d15,t.ce_oi))+'</div></td><td class="oc-x">'+chg(t.ce_d5)+'<div class="oc-sm">'+pspan(pct(t.ce_d5,t.ce_oi))+'</div></td><td>'+chg(t.ce_doi)+'<div class="oc-sm">'+pspan(pct(t.ce_doi,t.ce_oi))+'</div><div class="oc-sm oc-m15">15m '+pspan(pct(t.ce_d15,t.ce_oi))+'</div></td><td class="oc-oi">'+fmt(t.ce_oi)+'</td><td class="oc-st">TOTAL</td><td class="oc-oi">'+fmt(t.pe_oi)+'</td><td>'+chg(t.pe_doi)+'<div class="oc-sm">'+pspan(pct(t.pe_doi,t.pe_oi))+'</div><div class="oc-sm oc-m15">15m '+pspan(pct(t.pe_d15,t.pe_oi))+'</div></td><td class="oc-x">'+chg(t.pe_d5)+'<div class="oc-sm">'+pspan(pct(t.pe_d5,t.pe_oi))+'</div></td><td class="oc-x">'+chg(t.pe_d15)+'<div class="oc-sm">'+pspan(pct(t.pe_d15,t.pe_oi))+'</div></td><td class="oc-x"></td><td class="oc-x"></td></tr></tfoot></table></div>');
 return h.join("");
}

function render(){
 var b=window.NL&&NL.bundle,oc=b&&b.oi_chain,els=document.querySelectorAll("[data-oichain]");
 els.forEach(function(el){
  if(!oc||!oc.indices){var pub=/\/public\//.test(location.pathname)?"":' Key wala data nahi khula to <a class="b" href="public/oi.html">public OI page</a> kholiye.';el.innerHTML='<div class="oc-empty">OI data abhi load ho raha hai… (market time mein har 2 min update).'+pub+'</div>';return}
  var names=Object.keys(oc.indices);if(names.indexOf(ST.idx)<0)ST.idx=names[0];
  var idx=oc.indices[ST.idx];idx._name=ST.idx;var exs=idx.expiries||[];if(ST.exp>=exs.length)ST.exp=0;var ex=exs[ST.exp]||{};ex._spot=idx.spot;
  var W=Math.max(300,Math.min(1100,(el.clientWidth||window.innerWidth||360)-2));
  var mk=oc.market?'<span class="oc-live">● LIVE · har 2 min</span>':'<span class="oc-closed">Market band · last session '+esc(dlabel(oc.session_date))+' ka closing OI</span>';
  var h=[];
  h.push('<div class="oc-bar"><div class="oc-seg">'+names.map(function(n){return '<button type="button" data-oi-idx="'+n+'" class="'+(n===ST.idx?"on":"")+'">'+n+'</button>'}).join("")+'</div>');
  h.push('<div class="oc-seg">'+exs.map(function(e,i){return '<button type="button" data-oi-exp="'+i+'" class="'+(i===ST.exp?"on":"")+'">'+esc(dlabel(e.expiry))+(i===0?" · near":"")+'</button>'}).join("")+'</div>');
  h.push('<div class="oc-meta">'+mk+' · '+ist(oc.updated)+'</div></div>');
  var addp=function(side,k){var r=(ex.rows||[]).filter(function(x){return x.k===k})[0],l=r&&r[side];if(!l)return "";var dd=pct(l.doi,l.oi);return dd==null?"":'(+'+fmt(l.doi).replace(/^[+]/,"")+' · '+pspan(dd)+')'};
  var t=ex.tot||{},tilt=(t.pe_doi!=null&&t.ce_doi!=null)?(t.pe_doi>t.ce_doi?'<span class="oc-up">PE writing zyada</span>':'<span class="oc-dn">CE writing zyada</span>'):"—";
  h.push('<div class="oc-cards">',
   card(esc(ST.idx)+" SPOT",px(idx.spot),idx.spot_chg==null?"":'<span class="'+cls(idx.spot_chg)+'">'+arrow(idx.spot_chg)+" "+px(Math.abs(idx.spot_chg))+(idx.spot_pc?" ("+(idx.spot_chg/idx.spot_pc*100).toFixed(2)+"%)":"")+'</span>'),
   card("PCR (OI)",ex.pcr==null?"—":ex.pcr.toFixed(2),"Δ OI PCR: "+(ex.pcr_chg==null?"—":ex.pcr_chg.toFixed(2)),ex.pcr>=1?"oc-up":"oc-dn"),
   card("RESISTANCE · max CE OI",px(ex.res,0),"sabse zyada CE add: "+px(ex.res_add,0)+" "+addp("ce",ex.res_add),"oc-dn"),
   card("SUPPORT · max PE OI",px(ex.sup,0),"sabse zyada PE add: "+px(ex.sup_add,0)+" "+addp("pe",ex.sup_add),"oc-up"),
   card("CE OI Δ day",chg(t.ce_doi)+" "+pspan(pct(t.ce_doi,t.ce_oi),"oc-pbig"),"15m: "+chg(t.ce_d15)+" "+pspan(pct(t.ce_d15,t.ce_oi))),
   card("PE OI Δ day",chg(t.pe_doi)+" "+pspan(pct(t.pe_doi,t.pe_oi),"oc-pbig"),"15m: "+chg(t.pe_d15)+" "+pspan(pct(t.pe_d15,t.pe_oi))),
   card("OI TILT",tilt,"ATM ±10 strikes · ATM "+px(idx.atm,0),"","oc-wide"),
  '</div>');
  h.push('<div class="oc-panel"><div class="oc-ph"><span>STRIKE-WISE OI · '+esc(ST.idx)+' '+esc(dlabel(ex.expiry))+'</span><span class="oc-seg oc-mode">',
   [["oi","OI"],["doi","Δ Day"],["d15","Δ 15m"]].map(function(m){return '<button type="button" data-oi-mode="'+m[0]+'" class="'+(ST.mode===m[0]?"on":"")+'">'+m[1]+'</button>'}).join(""),'</span></div>',
   butterfly(ex,idx,Math.min(W-18,780),ST.mode),
   '<div class="oc-leg"><span><i style="background:'+RED+'"></i>CE OI badha</span><span><i style="background:'+GRN+'"></i>PE OI badha</span><span><i class="oc-hatch"></i>OI ghata (dhaariyan)</span><span><i style="background:#2962FF;opacity:.5"></i>ATM</span><span><i style="background:'+AMB+'"></i>Spot</span><span><i class="oc-box r"></i>Resistance</span><span><i class="oc-box g"></i>Support</span></div></div>');
  h.push('<div class="oc-panel"><div class="oc-ph"><span>DIN BHAR KA OI · '+esc(ST.idx)+' '+esc(dlabel(idx.series_expiry))+' (ATM ±10, pichhle din se change)</span></div>',daychart(idx,W-18),'</div>');
  h.push('<div class="oc-panel"><div class="oc-ph"><span>OPTION CHAIN · OI ▲ badh raha / ▼ ghat raha</span><span class="oc-0">lot '+esc(ex.lot||"—")+'</span></div>',table(ex),
   '<div class="oc-note">LB = Long build-up (price ▲ OI ▲) · SB = Short build-up (price ▼ OI ▲) · SC = Short covering (price ▲ OI ▼) · LU = Long unwinding (price ▼ OI ▼). Δ Day = pichhle trading din ('+esc(dlabel(oc.prev_date))+') ke close OI se. 5m/15m = is page ke apne snapshots se. Source: Angel One. Data only, paper/demo, advice nahi.</div></div>');
  el.innerHTML=h.join("");
 });
}
document.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("[data-oi-idx],[data-oi-exp],[data-oi-mode]");if(!t)return;
 if(t.hasAttribute("data-oi-idx")){ST.idx=t.getAttribute("data-oi-idx");ST.exp=0}
 if(t.hasAttribute("data-oi-exp"))ST.exp=+t.getAttribute("data-oi-exp");
 if(t.hasAttribute("data-oi-mode"))ST.mode=t.getAttribute("data-oi-mode");
 save();render();});
var rt=null;window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(render,150)});
document.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest('.tabbtn[data-tab="oi"]');if(t)setTimeout(render,30)});
function boot(){if(!window.NL){setTimeout(boot,200);return}NL.onChange(render);render();
 if(document.body.hasAttribute("data-oi-standalone")){var tick=function(){Promise.resolve(NL.loadBundle()).catch(function(){}).then(render)};tick();setInterval(tick,30000)}}
window.OIChain={render:render};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
