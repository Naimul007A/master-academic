// ══════════════════════════════════════════════════════════════════════════════
// ══  MASTER ACADEMIC — ANALYTICS DASHBOARD  ══════════════════════════════════
// ══  Works for Admin, Manager, Chairman panels.                              ══
// ══  Reads from window.appData — zero extra Firestore reads.                 ══
// ══  Zero-cost: pure JS canvas charts, no external chart library.            ══
// ══════════════════════════════════════════════════════════════════════════════

/* ── Inject dashboard CSS once ─────────────────────────────────────────────── */
(function injectDashStyles(){
  if(document.getElementById('dash-styles')) return;
  const s = document.createElement('style');
  s.id = 'dash-styles';
  s.textContent = `
  /* ── Dashboard shell ── */
  #dash-panel{
    font-family:'Hind Siliguri',sans-serif;
    animation: dashFadeIn .45s cubic-bezier(.22,1,.36,1);
  }
  @keyframes dashFadeIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}

  /* ── KPI grid ── */
  .dash-kpi-grid{
    display:grid;
    grid-template-columns:repeat(2,1fr);
    gap:11px;
    margin-bottom:16px;
  }
  .dash-kpi{
    border-radius:16px;
    padding:14px 16px 12px;
    position:relative;
    overflow:hidden;
    cursor:default;
    transition:transform .18s,box-shadow .18s;
  }
  .dash-kpi:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.22);}
  .dash-kpi-icon{font-size:22px;margin-bottom:6px;display:block;}
  .dash-kpi-val{
    font-family:'Baloo 2',sans-serif;
    font-size:26px;
    font-weight:900;
    line-height:1;
    letter-spacing:-1px;
  }
  .dash-kpi-label{
    font-size:10px;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:.6px;
    margin-top:4px;
    opacity:.7;
  }
  .dash-kpi-sub{
    font-size:10px;
    font-weight:600;
    margin-top:3px;
    opacity:.55;
  }
  .dash-kpi-glow{
    position:absolute;right:-18px;top:-18px;
    width:70px;height:70px;border-radius:50%;
    opacity:.18;
  }

  /* ── Section headers ── */
  .dash-sec{
    font-family:'Baloo 2',sans-serif;
    font-size:13px;
    font-weight:800;
    letter-spacing:.3px;
    margin:18px 0 10px;
    display:flex;align-items:center;gap:7px;
  }
  .dash-sec::after{content:'';flex:1;height:1.5px;background:currentColor;opacity:.12;border-radius:2px;}

  /* ── Charts ── */
  .dash-chart-wrap{
    background:var(--card,rgba(255,255,255,.06));
    border:1px solid var(--border,rgba(255,255,255,.11));
    border-radius:16px;
    padding:14px 14px 10px;
    margin-bottom:12px;
    position:relative;
  }
  .dash-chart-title{
    font-family:'Baloo 2',sans-serif;
    font-size:12px;font-weight:800;
    margin-bottom:10px;opacity:.85;
  }
  .dash-canvas{width:100%!important;border-radius:8px;}

  /* ── Horizontal bar rows ── */
  .dash-hbar-row{
    display:flex;align-items:center;gap:9px;
    margin-bottom:8px;font-size:12px;
  }
  .dash-hbar-label{min-width:68px;font-weight:600;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .dash-hbar-track{flex:1;height:10px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;}
  .dash-hbar-fill{height:100%;border-radius:6px;transition:width .6s cubic-bezier(.22,1,.36,1);}
  .dash-hbar-val{min-width:42px;text-align:right;font-family:'Baloo 2',sans-serif;font-weight:800;font-size:12px;}

  /* ── Two-column layout for charts ── */
  .dash-row2{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:12px;}
  @media(max-width:520px){.dash-row2{grid-template-columns:1fr;}}

  /* ── List items ── */
  .dash-list-item{
    display:flex;align-items:center;justify-content:space-between;
    padding:9px 12px;border-radius:10px;margin-bottom:6px;
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.07);
    font-size:12px;
  }
  .dash-list-item:last-child{margin-bottom:0;}
  .dash-badge{
    font-family:'Baloo 2',sans-serif;font-weight:800;font-size:12px;
    padding:2px 9px;border-radius:10px;white-space:nowrap;
  }

  /* ── Progress ring ── */
  .dash-ring-wrap{
    display:flex;flex-direction:column;align-items:center;gap:8px;
    padding:14px 0 10px;
  }
  .dash-ring-label{font-size:11px;font-weight:700;opacity:.6;text-align:center;}
  .dash-ring-val{font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:900;}

  /* ── Trend pills ── */
  .dash-trend-up{color:#00dc8c;}
  .dash-trend-dn{color:#ff8080;}
  .dash-trend-eq{opacity:.5;}

  /* ── Empty state ── */
  .dash-empty{
    text-align:center;padding:28px 14px;opacity:.35;
    font-size:13px;
  }

  /* Dark-mode aware overrides for admin light panel */
  .apanel .dash-kpi{border:1px solid rgba(0,0,0,.07);}
  .apanel .dash-chart-wrap{background:#f9fafb;border:1px solid #e8eaed;}
  .apanel .dash-hbar-track{background:rgba(0,0,0,.07);}
  .apanel .dash-list-item{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.06);}
  .apanel .dash-sec::after{opacity:.1;}
  `;
  document.head.appendChild(s);
})();

/* ── Tiny Canvas chart helpers (no external deps) ────────────────────────── */
const _DC = {
  /* draw a smooth-line / area chart */
  line(canvas, labels, datasets, opts={}){
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth * devicePixelRatio;
    const H = canvas.height = (opts.height||160) * devicePixelRatio;
    canvas.style.height = (opts.height||160)+'px';
    ctx.clearRect(0,0,W,H);
    const pad={t:10,r:14,b:32,l:44};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    const allVals = datasets.flatMap(d=>d.data);
    const maxV = Math.max(...allVals, 1);
    const minV = opts.minZero ? 0 : Math.min(...allVals, 0);
    const range = maxV - minV || 1;
    const xStep = cW / Math.max(labels.length-1, 1);
    const yScale = v => pad.t + cH - ((v - minV)/range)*cH;
    const xScale = i => pad.l + i*xStep;

    /* grid lines */
    ctx.strokeStyle = 'rgba(120,120,120,.13)';
    ctx.lineWidth = 1;
    for(let g=0;g<=4;g++){
      const y = pad.t + (cH/4)*g;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
      const val = maxV - (range/4)*g;
      ctx.fillStyle='rgba(120,120,120,.55)';
      ctx.font=`${11*devicePixelRatio}px Baloo 2,sans-serif`;
      ctx.textAlign='right';
      ctx.fillText(_DC.fmt(val), pad.l-5, y+4*devicePixelRatio);
    }

    /* x labels */
    ctx.font=`${10*devicePixelRatio}px Hind Siliguri,sans-serif`;
    ctx.fillStyle='rgba(120,120,120,.65)';
    ctx.textAlign='center';
    const skip = Math.ceil(labels.length/8);
    labels.forEach((lbl,i)=>{
      if(i%skip===0) ctx.fillText(lbl, xScale(i), H-pad.b+14*devicePixelRatio);
    });

    datasets.forEach(ds=>{
      const pts = ds.data.map((v,i)=>({x:xScale(i),y:yScale(v)}));
      /* area fill */
      if(ds.fill!==false){
        const grad = ctx.createLinearGradient(0,pad.t,0,pad.t+cH);
        grad.addColorStop(0, (ds.color||'#00c896')+'55');
        grad.addColorStop(1, (ds.color||'#00c896')+'00');
        ctx.beginPath();
        ctx.moveTo(pts[0].x, yScale(minV));
        pts.forEach(p=>ctx.lineTo(p.x,p.y));
        ctx.lineTo(pts.at(-1).x, yScale(minV));
        ctx.closePath();
        ctx.fillStyle=grad;
        ctx.fill();
      }
      /* line */
      ctx.beginPath();
      ctx.strokeStyle=ds.color||'#00c896';
      ctx.lineWidth = 2*devicePixelRatio;
      ctx.lineJoin='round';
      pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.stroke();
      /* dots */
      pts.forEach(p=>{
        ctx.beginPath();
        ctx.arc(p.x,p.y,3*devicePixelRatio,0,Math.PI*2);
        ctx.fillStyle=ds.color||'#00c896';
        ctx.fill();
      });
    });
  },

  /* vertical bar chart */
  bar(canvas, labels, datasets, opts={}){
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth * devicePixelRatio;
    const H = canvas.height = (opts.height||160) * devicePixelRatio;
    canvas.style.height = (opts.height||160)+'px';
    ctx.clearRect(0,0,W,H);
    const pad={t:10,r:14,b:34,l:44};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    const nSets=datasets.length;
    const nBars=labels.length;
    const groupW=cW/nBars;
    const barW=Math.max((groupW/nSets)*.65, 4*devicePixelRatio);
    const maxV=Math.max(...datasets.flatMap(d=>d.data), 1);
    const yScale=v=>pad.t+cH-(v/maxV)*cH;

    /* grid */
    ctx.strokeStyle='rgba(120,120,120,.13)'; ctx.lineWidth=1;
    for(let g=0;g<=4;g++){
      const y=pad.t+(cH/4)*g;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
      ctx.fillStyle='rgba(120,120,120,.55)';
      ctx.font=`${10*devicePixelRatio}px Baloo 2,sans-serif`;
      ctx.textAlign='right';
      ctx.fillText(_DC.fmt(maxV-(maxV/4)*g),pad.l-5,y+4*devicePixelRatio);
    }

    datasets.forEach((ds,di)=>{
      ds.data.forEach((v,bi)=>{
        const x=pad.l+bi*groupW+(di*(groupW/nSets))+(groupW-(nSets*barW))/2;
        const barH=(v/maxV)*cH;
        const grad=ctx.createLinearGradient(0,yScale(v),0,pad.t+cH);
        grad.addColorStop(0,ds.color||'#1a73e8');
        grad.addColorStop(1,(ds.color||'#1a73e8')+'55');
        ctx.fillStyle=grad;
        ctx.beginPath();
        ctx.roundRect?ctx.roundRect(x,yScale(v),barW,barH,3*devicePixelRatio):
          ctx.rect(x,yScale(v),barW,barH);
        ctx.fill();
      });
    });

    /* x labels */
    ctx.font=`${10*devicePixelRatio}px Hind Siliguri,sans-serif`;
    ctx.fillStyle='rgba(120,120,120,.65)'; ctx.textAlign='center';
    labels.forEach((lbl,i)=>ctx.fillText(lbl.slice(0,3), pad.l+i*groupW+groupW/2, H-pad.b+14*devicePixelRatio));
  },

  /* donut chart */
  donut(canvas, data, colors, opts={}){
    const ctx = canvas.getContext('2d');
    const size = opts.size||120;
    canvas.width = canvas.height = size * devicePixelRatio;
    canvas.style.width = canvas.style.height = size+'px';
    const cx=size*devicePixelRatio/2, cy=cx;
    const R=cx*.78, r=cx*.48;
    const total=data.reduce((s,v)=>s+v,0)||1;
    let angle=-Math.PI/2;
    data.forEach((v,i)=>{
      const sweep=(v/total)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,R,angle,angle+sweep);
      ctx.closePath();
      ctx.fillStyle=colors[i%colors.length];
      ctx.fill();
      angle+=sweep;
    });
    /* hole */
    ctx.beginPath();
    ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle=opts.bg||'transparent';
    ctx.fill();
  },

  fmt(n){
    if(n>=1000000) return (n/1000000).toFixed(1)+'M';
    if(n>=1000) return (n/1000).toFixed(1)+'k';
    return Math.round(n).toString();
  }
};

/* ── Analytics computation ────────────────────────────────────────────────── */
function _dashCompute(){
  const fees     = window.appData.fees     || [];
  const expenses = window.appData.expenses || [];
  const students = window.appData.students || [];
  const teachers = window.appData.teachers || [];
  const attendance = window.appData.attendance || [];
  const teacherAtt = window.appData.teacherAttendance || [];
  const homework   = window.appData.homework || [];
  const dues       = window.appData.dueNotifications || [];

  /* ── Finance ── */
  const totalFees = fees.reduce((s,f)=>s+(f.amount||0),0);
  const totalExp  = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const netBal    = totalFees - totalExp;

  /* Monthly fee collection (last 6 months) */
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const last6 = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    return {label:MONTHS[d.getMonth()], month:MONTHS[d.getMonth()], year:d.getFullYear()};
  });
  const feeByMonth = {};
  fees.forEach(f=>{
    const key = (f.month||'').slice(0,3)+' '+(f.year||'');
    feeByMonth[key]=(feeByMonth[key]||0)+(f.amount||0);
  });
  const expByMonth = {};
  expenses.forEach(e=>{
    const d = e.date ? new Date(e.date) : null;
    if(!d) return;
    const key = MONTHS[d.getMonth()]+' '+d.getFullYear();
    expByMonth[key]=(expByMonth[key]||0)+(e.amount||0);
  });

  const monthLabels = last6.map(m=>m.label);
  const monthFeeVals = last6.map(m=>feeByMonth[m.label+' '+m.year]||0);
  const monthExpVals = last6.map(m=>expByMonth[m.label+' '+m.year]||0);

  /* Fee type breakdown */
  const feeTypes={};
  fees.forEach(f=>{const k=f.feeType||'Other';feeTypes[k]=(feeTypes[k]||0)+(f.amount||0);});
  const feeTypesSorted=Object.entries(feeTypes).sort((a,b)=>b[1]-a[1]);

  /* Fee by class */
  const feeCls={};
  fees.forEach(f=>{const k=f.studentClass||'—';feeCls[k]=(feeCls[k]||0)+(f.amount||0);});
  const feeClsSorted=Object.entries(feeCls).sort((a,b)=>b[1]-a[1]);

  /* Expense by purpose (top 5) */
  const expPurpose={};
  expenses.forEach(e=>{const k=(e.purpose||'Other').substring(0,18);expPurpose[k]=(expPurpose[k]||0)+(e.amount||0);});
  const expPurposeSorted=Object.entries(expPurpose).sort((a,b)=>b[1]-a[1]).slice(0,5);

  /* Recent transactions (combined, last 8) */
  const txns=[
    ...fees.map(f=>({type:'in',label:f.studentName||'—',sub:f.feeType+' · '+(f.month||''),amount:f.amount||0,date:f.date||''})),
    ...expenses.map(e=>({type:'out',label:e.purpose||'—',sub:'by '+(e.recordedBy||'—'),amount:e.amount||0,date:e.date||''})),
  ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);

  /* This month stats */
  const thisMon = MONTHS[now.getMonth()];
  const thisYr  = now.getFullYear();
  const thisMonFees = fees.filter(f=>(f.month||'').slice(0,3)===thisMon.slice(0,3)&&String(f.year||'')===String(thisYr));
  const thisMonFeeTotal = thisMonFees.reduce((s,f)=>s+(f.amount||0),0);
  const thisMonDays = new Date(thisYr,now.getMonth()+1,0).getDate();
  const todayStr = now.toISOString().split('T')[0];
  const todayFees = fees.filter(f=>f.date===todayStr).reduce((s,f)=>s+(f.amount||0),0);
  const todayExp  = expenses.filter(e=>e.date===todayStr).reduce((s,e)=>s+(e.amount||0),0);

  /* ── Attendance ── */
  const attToday = attendance.filter(a=>a.date===todayStr);
  const attPresentToday = attToday.filter(a=>a.status==='P').length;
  const attTotalToday   = attToday.length;
  const attRate = attTotalToday ? Math.round((attPresentToday/attTotalToday)*100) : null;

  /* Last 6 days attendance rate */
  const last6days = Array.from({length:6},(_,i)=>{
    const d=new Date(now); d.setDate(now.getDate()-5+i);
    return d.toISOString().split('T')[0];
  });
  const attByDay = last6days.map(dt=>{
    const rows=attendance.filter(a=>a.date===dt);
    if(!rows.length) return 0;
    return Math.round((rows.filter(r=>r.status==='P').length/rows.length)*100);
  });

  /* Homework defaulters count */
  const hwDefaultersCount = homework.reduce((s,h)=>{
    const d=JSON.parse(h.defaulters||'[]');
    return s+d.length;
  },0);

  /* Due count */
  const dueCount = dues.length;

  /* Pending students */
  const pendingCount = (window.appData.pending||[]).length;

  /* Teacher attendance this month */
  const tAttThisMon = teacherAtt.filter(a=>a.month===MONTHS[now.getMonth()]);
  const tAttPresent = tAttThisMon.filter(a=>a.status==='P').length;
  const tAttTotal   = tAttThisMon.length;
  const tAttRate    = tAttTotal ? Math.round((tAttPresent/tAttTotal)*100) : null;

  return {
    totalFees,totalExp,netBal,monthLabels,monthFeeVals,monthExpVals,
    feeTypesSorted,feeClsSorted,expPurposeSorted,txns,
    thisMonFeeTotal,todayFees,todayExp,thisMonDays,thisMon,thisYr,
    students,teachers,attendance,attRate,attPresentToday,attTotalToday,
    attByDay,last6days,hwDefaultersCount,dueCount,pendingCount,
    tAttRate,tAttPresent,tAttTotal,fees,expenses
  };
}

/* ── KPI card HTML helper ─────────────────────────────────────────────────── */
function _kpi(icon,val,label,sub,bg,textColor,glowColor){
  return `<div class="dash-kpi" style="background:${bg};color:${textColor};">
    <div class="dash-kpi-glow" style="background:${glowColor};"></div>
    <span class="dash-kpi-icon">${icon}</span>
    <div class="dash-kpi-val">${val}</div>
    <div class="dash-kpi-label">${label}</div>
    ${sub?`<div class="dash-kpi-sub">${sub}</div>`:''}
  </div>`;
}

/* ── Horizontal bar helper ────────────────────────────────────────────────── */
function _hbars(rows, maxVal, barColor, currency=false){
  if(!rows.length) return `<div class="dash-empty">No data yet.</div>`;
  return rows.map(([lbl,val])=>{
    const pct = maxVal ? Math.max((val/maxVal)*100,1) : 0;
    const display = currency ? '৳'+_DC.fmt(val) : val;
    return `<div class="dash-hbar-row">
      <div class="dash-hbar-label" title="${lbl}">${lbl}</div>
      <div class="dash-hbar-track"><div class="dash-hbar-fill" style="width:${pct}%;background:${barColor};"></div></div>
      <div class="dash-hbar-val" style="color:${barColor};">${display}</div>
    </div>`;
  }).join('');
}

/* ── Main render ──────────────────────────────────────────────────────────── */
window.renderDashboard = function(containerId, roleHint){
  const el = document.getElementById(containerId);
  if(!el) return;
  const d = _dashCompute();

  /* colour scheme adapts to dark (manager/chairman) vs light (admin) */
  const isDark = roleHint === 'manager';
  const textPri  = isDark ? '#ffffff' : '#1a1a2e';
  const textMut  = isDark ? 'rgba(255,255,255,.5)' : '#5f6368';
  const cardBg   = isDark ? 'rgba(255,255,255,.06)' : '#f8f9fa';
  const borderC  = isDark ? 'rgba(255,255,255,.1)' : '#e8eaed';

  /* KPI colours */
  const kpiRevBg  = isDark ? 'linear-gradient(135deg,#00513a,#00875a)' : 'linear-gradient(135deg,#e8f5e9,#c8e6c9)';
  const kpiExpBg  = isDark ? 'linear-gradient(135deg,#5a1212,#8b1c1c)' : 'linear-gradient(135deg,#ffebee,#ffcdd2)';
  const kpiNetBg  = isDark ? 'linear-gradient(135deg,#0a2a5e,#1a4a9e)' : 'linear-gradient(135deg,#e3f2fd,#bbdefb)';
  const kpiAttBg  = isDark ? 'linear-gradient(135deg,#3a1a6e,#5e2a9e)' : 'linear-gradient(135deg,#f3e5f5,#e1bee7)';
  const kpiRevTxt = isDark ? '#90ffd6' : '#1b5e20';
  const kpiExpTxt = isDark ? '#ff9999' : '#b71c1c';
  const kpiNetTxt = isDark ? '#90caff' : '#0d47a1';
  const kpiAttTxt = isDark ? '#ce93d8' : '#6a1b9a';

  const netSign   = d.netBal >= 0 ? '' : '-';
  const netAmt    = '৳'+_DC.fmt(Math.abs(d.netBal));
  const attLabel  = d.attRate !== null ? d.attRate+'%' : 'N/A';
  const tAttLabel = d.tAttRate !== null ? d.tAttRate+'%' : 'N/A';

  el.innerHTML = `<div id="dash-panel">

    <!-- ── Today Strip ── -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="font-family:'Baloo 2',sans-serif;font-size:14px;font-weight:900;color:${textPri};">
        📊 Analytics Dashboard
      </div>
      <div style="font-size:11px;color:${textMut};font-weight:600;">
        ${new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
      </div>
    </div>

    <!-- ── TODAY'S PULSE ── -->
    <div style="background:${isDark?'rgba(255,200,0,.07)':'#fffde7'};border:1px solid ${isDark?'rgba(255,200,0,.18)':'#fff176'};
      border-radius:14px;padding:12px 15px;margin-bottom:16px;display:flex;gap:18px;flex-wrap:wrap;">
      <div style="flex:1;min-width:80px;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${isDark?'#ffd54f':'#f57f17'};margin-bottom:3px;">Today In</div>
        <div style="font-family:'Baloo 2',sans-serif;font-size:20px;font-weight:900;color:${isDark?'#ffe082':'#e65100'};">৳${_DC.fmt(d.todayFees)}</div>
      </div>
      <div style="flex:1;min-width:80px;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${isDark?'#ff8a80':'#b71c1c'};margin-bottom:3px;">Today Out</div>
        <div style="font-family:'Baloo 2',sans-serif;font-size:20px;font-weight:900;color:${isDark?'#ff8a80':'#c62828'};">৳${_DC.fmt(d.todayExp)}</div>
      </div>
      <div style="flex:1;min-width:80px;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${isDark?'rgba(0,220,140,.8)':'#1b5e20'};margin-bottom:3px;">Net Today</div>
        <div style="font-family:'Baloo 2',sans-serif;font-size:20px;font-weight:900;color:${(d.todayFees-d.todayExp)>=0?(isDark?'#69ffbb':'#2e7d32'):(isDark?'#ff8a80':'#c62828')};">
          ${(d.todayFees-d.todayExp)>=0?'':'-'}৳${_DC.fmt(Math.abs(d.todayFees-d.todayExp))}
        </div>
      </div>
      <div style="flex:1;min-width:80px;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${isDark?'rgba(180,140,255,.8)':'#4a148c'};margin-bottom:3px;">Att. Today</div>
        <div style="font-family:'Baloo 2',sans-serif;font-size:20px;font-weight:900;color:${isDark?'#ce93d8':'#6a1b9a'};">${d.attRate!==null?d.attRate+'%':'—'}</div>
      </div>
    </div>

    <!-- ── KPI Grid ── -->
    <div class="dash-kpi-grid">
      ${_kpi('💰', '৳'+_DC.fmt(d.totalFees), 'Total Revenue', d.thisMon+' this month: ৳'+_DC.fmt(d.thisMonFeeTotal), kpiRevBg, kpiRevTxt, '#00ff99')}
      ${_kpi('💸', '৳'+_DC.fmt(d.totalExp), 'Total Expenses', d.expPurposeSorted[0]?'Top: '+d.expPurposeSorted[0][0]:'', kpiExpBg, kpiExpTxt, '#ff4444')}
      ${_kpi(d.netBal>=0?'📈':'📉', netSign+netAmt, 'Net Balance', d.netBal>=0?'Profitable':'Deficit', kpiNetBg, kpiNetTxt, '#4499ff')}
      ${_kpi('📆', attLabel, 'Student Att.', d.attPresentToday+'/'+d.attTotalToday+' present today', kpiAttBg, kpiAttTxt, '#bb44ff')}
    </div>

    <div class="dash-kpi-grid">
      ${_kpi('🎓', d.students.length, 'Students', (window.appData.pending||[]).length+' pending approval', 'linear-gradient(135deg,#1a3a5e,#1a5e9e)', isDark?'#90caff':'#0d47a1', '#4499ff')}
      ${_kpi('👨‍🏫', d.teachers.length, 'Teachers', tAttLabel+' teacher att. this month', 'linear-gradient(135deg,#3a2a0a,#7a5a0a)', isDark?'#ffe082':'#e65100', '#ffbb00')}
      ${_kpi('⚠️', d.dueCount, 'Due Notices', 'Outstanding fee alerts', 'linear-gradient(135deg,#4a1a00,#8a3a00)', isDark?'#ffcc80':'#e65100', '#ff8800')}
      ${_kpi('📝', d.hwDefaultersCount, 'HW Defaulters', 'Across all submissions', 'linear-gradient(135deg,#1a003a,#4a0080)', isDark?'#ea80fc':'#7b1fa2', '#cc44ff')}
    </div>

    <!-- ── Finance Charts ── -->
    <div class="dash-sec" style="color:${textPri};">💰 Finance Overview</div>

    <!-- Monthly trend line -->
    <div class="dash-chart-wrap">
      <div class="dash-chart-title" style="color:${textPri};">Monthly Collection vs Expenses (৳)</div>
      <canvas id="dash-chart-monthly" class="dash-canvas"></canvas>
      <div style="display:flex;gap:14px;margin-top:8px;font-size:11px;font-weight:700;">
        <span style="color:#00c896;">▬ Collections</span>
        <span style="color:#e84040;">▬ Expenses</span>
      </div>
    </div>

    <!-- Fee by class + expense breakdown -->
    <div class="dash-row2">
      <div class="dash-chart-wrap">
        <div class="dash-chart-title" style="color:${textPri};">Revenue by Class</div>
        ${_hbars(d.feeClsSorted.slice(0,6), d.feeClsSorted[0]?.[1]||1, '#00c896', true)}
      </div>
      <div class="dash-chart-wrap">
        <div class="dash-chart-title" style="color:${textPri};">Expense Breakdown</div>
        ${_hbars(d.expPurposeSorted, d.expPurposeSorted[0]?.[1]||1, '#e84040', true)}
      </div>
    </div>

    <!-- Fee type bar -->
    <div class="dash-chart-wrap">
      <div class="dash-chart-title" style="color:${textPri};">Fee Types — Collection Breakdown (৳)</div>
      <canvas id="dash-chart-feetype" class="dash-canvas"></canvas>
    </div>

    <!-- P&L mini donut row -->
    <div style="display:flex;gap:11px;flex-wrap:wrap;margin-bottom:12px;">
      <div class="dash-chart-wrap" style="flex:1;min-width:140px;">
        <div class="dash-chart-title" style="color:${textPri};">Revenue Split</div>
        <div class="dash-ring-wrap">
          <canvas id="dash-donut-rev" style="border-radius:50%;"></canvas>
          <div id="dash-donut-rev-legend" style="font-size:10px;font-weight:700;text-align:center;line-height:1.8;color:${textMut};"></div>
        </div>
      </div>
      <div class="dash-chart-wrap" style="flex:1;min-width:140px;">
        <div class="dash-chart-title" style="color:${textPri};">P & L Ratio</div>
        <div class="dash-ring-wrap">
          <div style="position:relative;display:inline-block;">
            <canvas id="dash-donut-pl"></canvas>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;">
              <div style="font-family:'Baloo 2',sans-serif;font-size:15px;font-weight:900;color:${d.netBal>=0?'#00c896':'#e84040'};">${d.totalFees?Math.round((d.netBal/d.totalFees)*100)+'%':'—'}</div>
              <div style="font-size:9px;font-weight:700;color:${textMut};">margin</div>
            </div>
          </div>
          <div style="font-size:10px;font-weight:700;text-align:center;color:${textMut};">
            <span style="color:#00c896;">▪ Revenue</span> &nbsp; <span style="color:#e84040;">▪ Expense</span>
          </div>
        </div>
      </div>
      <div class="dash-chart-wrap" style="flex:1;min-width:140px;">
        <div class="dash-chart-title" style="color:${textPri};">Attendance Rate</div>
        <div class="dash-ring-wrap">
          <div style="position:relative;display:inline-block;">
            <canvas id="dash-donut-att"></canvas>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;">
              <div style="font-family:'Baloo 2',sans-serif;font-size:15px;font-weight:900;color:#a78bfa;">${attLabel}</div>
              <div style="font-size:9px;font-weight:700;color:${textMut};">today</div>
            </div>
          </div>
          <div style="font-size:10px;font-weight:700;text-align:center;color:${textMut};">
            <span style="color:#a78bfa;">▪ Present</span> &nbsp; <span style="color:rgba(120,120,120,.4);">▪ Absent</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Attendance trend ── -->
    <div class="dash-sec" style="color:${textPri};">📆 Attendance Trend (Last 6 Days)</div>
    <div class="dash-chart-wrap">
      <div class="dash-chart-title" style="color:${textPri};">Student Attendance % Daily</div>
      <canvas id="dash-chart-att" class="dash-canvas"></canvas>
    </div>

    <!-- ── Recent Transactions ── -->
    <div class="dash-sec" style="color:${textPri};">🧾 Recent Transactions</div>
    <div>
      ${d.txns.length ? d.txns.map(t=>`
        <div class="dash-list-item">
          <div>
            <div style="font-weight:700;font-size:13px;color:${textPri};">${t.type==='in'?'💰':'💸'} ${t.label}</div>
            <div style="font-size:11px;color:${textMut};margin-top:2px;">${t.sub} &nbsp;·&nbsp; ${t.date}</div>
          </div>
          <div class="dash-badge" style="background:${t.type==='in'?(isDark?'rgba(0,200,120,.15)':'#e8f5e9'):(isDark?'rgba(232,64,64,.12)':'#ffebee')};
            color:${t.type==='in'?(isDark?'#69ffbb':'#1b5e20'):(isDark?'#ff8080':'#b71c1c')};">
            ${t.type==='in'?'+':'-'}৳${_DC.fmt(t.amount)}
          </div>
        </div>`).join('') : `<div class="dash-empty">No transactions yet.</div>`}
    </div>

    <!-- ── Academy Health Score ── -->
    <div class="dash-sec" style="color:${textPri};">🏫 Academy Health Scorecard</div>
    <div class="dash-chart-wrap" style="padding-bottom:16px;">
      <div id="dash-health-bars"></div>
    </div>

    <div style="height:20px;"></div>
  </div>`;

  /* ── Draw charts (deferred so DOM is ready) ── */
  requestAnimationFrame(()=>{
    /* Monthly line chart */
    const cm = document.getElementById('dash-chart-monthly');
    if(cm) _DC.line(cm, d.monthLabels,
      [{data:d.monthFeeVals, color:'#00c896'},{data:d.monthExpVals, color:'#e84040', fill:false}],
      {height:155, minZero:true});

    /* Fee type bar chart */
    const cf = document.getElementById('dash-chart-feetype');
    if(cf && d.feeTypesSorted.length){
      _DC.bar(cf,
        d.feeTypesSorted.map(([k])=>k),
        [{data:d.feeTypesSorted.map(([,v])=>v), color:'#1a73e8'}],
        {height:140});
    }

    /* Revenue split donut */
    const dr = document.getElementById('dash-donut-rev');
    if(dr && d.feeTypesSorted.length){
      const COLS=['#00c896','#1a73e8','#e84040','#ffb300','#ab47bc','#26c6da'];
      _DC.donut(dr, d.feeTypesSorted.map(([,v])=>v), COLS, {size:110, bg: isDark?'transparent':'transparent'});
      const leg = document.getElementById('dash-donut-rev-legend');
      if(leg) leg.innerHTML = d.feeTypesSorted.slice(0,4).map(([k,v],i)=>
        `<span style="color:${COLS[i]};">▪</span> ${k}<br>`).join('');
    }

    /* P&L donut */
    const dp = document.getElementById('dash-donut-pl');
    if(dp){
      _DC.donut(dp,
        [Math.max(d.netBal,0), d.totalExp],
        ['#00c896','#e84040'],
        {size:110});
    }

    /* Attendance donut */
    const da = document.getElementById('dash-donut-att');
    if(da){
      const p=d.attPresentToday, ab=Math.max(d.attTotalToday-p,0);
      _DC.donut(da,
        [p||0, ab||1],
        ['#a78bfa','rgba(120,120,120,.2)'],
        {size:110});
    }

    /* Attendance trend */
    const ca = document.getElementById('dash-chart-att');
    if(ca){
      _DC.line(ca,
        d.last6days.map(dt=>dt.slice(5)),
        [{data:d.attByDay, color:'#a78bfa'}],
        {height:130, minZero:true});
    }

    /* Health scorecard */
    const hb = document.getElementById('dash-health-bars');
    if(hb){
      const netPct = d.totalFees ? Math.min(Math.max(Math.round((d.netBal/d.totalFees)*100),0),100) : 0;
      const attPct = d.attRate || 0;
      const tAttPct = d.tAttRate || 0;
      const hwPct = d.students.length ?
        Math.max(0, 100 - Math.round((d.hwDefaultersCount/Math.max(d.students.length,1))*100)) : 100;
      const feeCovPct = d.students.length ?
        Math.min(Math.round((d.fees.length/Math.max(d.students.length,1))*20),100) : 0;

      const scoreMetrics=[
        ['Net Profit Margin', netPct,  '#00c896'],
        ['Student Attendance', attPct, '#a78bfa'],
        ['Teacher Attendance', tAttPct,'#1a73e8'],
        ['HW Compliance',     hwPct,   '#ffb300'],
        ['Fee Coverage',      feeCovPct,'#e84040'],
      ];
      const overall=Math.round(scoreMetrics.reduce((s,[,v])=>s+v,0)/scoreMetrics.length);
      hb.innerHTML=`
        <div style="text-align:center;margin-bottom:14px;">
          <div style="font-family:'Baloo 2',sans-serif;font-size:36px;font-weight:900;
            color:${overall>=75?'#00c896':overall>=50?'#ffb300':'#e84040'};">${overall}<span style="font-size:16px;opacity:.6;">/100</span></div>
          <div style="font-size:11px;font-weight:700;color:${textMut};">Overall Health Score</div>
        </div>
        ${_hbars(scoreMetrics.map(([l,v,c])=>[l,v]), 100, '#00c896', false)
          /* override colour per metric */
          .replace(/background:#00c896/g,'REPLACE')
          /* re-inject per-metric colours */
          .split('REPLACE')
          .map((chunk, idx)=> idx < scoreMetrics.length
            ? chunk + `background:${scoreMetrics[idx][2]}`
            : chunk
          ).join('')
        }`;
    }
  });
};

/* ── Attach to window for refreshAll integration ─────────────────────────── */
window._refreshDashboard = function(){
  // Admin dashboard
  if(document.getElementById('dash-admin') &&
     document.querySelector('#ap-dashboard')?.classList.contains('active')){
    window.renderDashboard('dash-admin', 'admin');
  }
  // Manager/Chairman dashboard
  if(document.getElementById('dash-mgr') &&
     document.getElementById('mgr-tab-dashboard')?.style.display !== 'none'){
    window.renderDashboard('dash-mgr', 'manager');
  }
};
