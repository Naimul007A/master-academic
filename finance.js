        <div class="li-sub">💰 ${d.month}${d.note?' — '+d.note:''}</div>
      </div>
      <button class="bdel" onclick="delDoc('dueNotifications','${d.id}')">✕</button>
    </div>`).join('');
}

function renderAdminFinance(){
  const el=$('admin-finance-list'); if(!el)return;
  const monthF=$('adm-fin-month')?.value||'';
  const clsF=$('adm-fin-cls')?.value||'';
  let fees=[...(window.appData.fees||[])];
  let expenses=[...(window.appData.expenses||[])];
  if(monthF) fees=fees.filter(f=>f.month===monthF);
  if(clsF) fees=fees.filter(f=>f.studentClass===clsF);
  fees.sort((a,b)=>b.createdAt-a.createdAt);
  expenses.sort((a,b)=>b.createdAt-a.createdAt);
  const totalFees=fees.reduce((s,f)=>s+(f.amount||0),0);
  const totalExp=expenses.reduce((s,e)=>s+(e.amount||0),0);

  const btnStyle=(bg,txt)=>`style="padding:4px 10px;border:none;border-radius:7px;background:${bg};color:${txt};font-size:11px;font-weight:700;cursor:pointer;font-family:'Baloo 2',sans-serif;"`;

  const addFeeSection=`
    <details style="margin-bottom:12px;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
      <summary style="padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer;background:var(--bg);list-style:none;display:flex;align-items:center;gap:6px;">
        <span style="font-size:16px;">➕</span> Add New Fee Entry (Admin)
      </summary>
      <div style="padding:14px;background:var(--card);">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <input id="af-name" type="text" placeholder="Student name" style="flex:2;min-width:130px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;"/>
          <select id="af-cls" style="flex:1;min-width:100px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;">
            <option value="">Class</option>
            <option>Class 2</option><option>Class 3</option><option>Class 4</option><option>Class 5</option>
            <option>Class 6</option><option>Class 7</option><option>Class 8</option><option>Class 9</option><option>Class 10</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <select id="af-type" style="flex:1;min-width:130px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;">
            <option>Monthly Fee</option><option>Course Fee</option><option>Exam Fee</option><option>Registration Fee</option><option>Other</option>
          </select>
          <input id="af-amount" type="number" min="0" placeholder="Amount (৳)" style="flex:1;min-width:100px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;"/>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <select id="af-month" style="flex:1;min-width:120px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;">
            <option>January</option><option>February</option><option>March</option><option>April</option>
            <option>May</option><option>June</option><option>July</option><option>August</option>
            <option>September</option><option>October</option><option>November</option><option>December</option>
          </select>
          <input id="af-year" type="number" placeholder="Year" style="flex:1;min-width:80px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;" value="${new Date().getFullYear()}"/>
          <input id="af-date" type="date" style="flex:1;min-width:120px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;" value="${new Date().toISOString().split('T')[0]}"/>
        </div>
        <button onclick="adminAddFee()" style="width:100%;padding:10px;border:none;border-radius:9px;background:linear-gradient(135deg,#1b5e20,#2e7d32);color:#fff;font-family:'Baloo 2',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">💰 Add Fee Entry</button>
      </div>
    </details>
    <details style="margin-bottom:14px;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
      <summary style="padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer;background:var(--bg);list-style:none;display:flex;align-items:center;gap:6px;">
        <span style="font-size:16px;">➕</span> Add New Expense Entry (Admin)
      </summary>
      <div style="padding:14px;background:var(--card);">
        <input id="ae-purpose" type="text" placeholder="Purpose (e.g. Electricity, Stationery...)" style="width:100%;margin-bottom:8px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;"/>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <input id="ae-amount" type="number" min="0" placeholder="Amount (৳)" style="flex:1;min-width:100px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;"/>
          <input id="ae-date" type="date" style="flex:1;min-width:130px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;" value="${new Date().toISOString().split('T')[0]}"/>
        </div>
        <button onclick="adminAddExpense()" style="width:100%;padding:10px;border:none;border-radius:9px;background:linear-gradient(135deg,#b71c1c,#c62828);color:#fff;font-family:'Baloo 2',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">💸 Add Expense Entry</button>
      </div>
    </details>`;

  if(!fees.length&&!expenses.length){
    el.innerHTML=addFeeSection+'<div class="empty"><div class="ei">🏦</div><p>No records yet.</p></div>';return;
  }
  el.innerHTML=`
    ${addFeeSection}
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
      <div style="flex:1;background:#e8f5e9;border-radius:10px;padding:12px;min-width:100px;">
        <div style="font-size:11px;font-weight:700;color:#2e7d32;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Total Collections</div>
        <div style="font-family:'Baloo 2',sans-serif;font-size:22px;font-weight:800;color:#1b5e20;">৳${totalFees.toFixed(0)}</div>
      </div>
      <div style="flex:1;background:#ffebee;border-radius:10px;padding:12px;min-width:100px;">
        <div style="font-size:11px;font-weight:700;color:#c62828;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Total Expenses</div>
        <div style="font-family:'Baloo 2',sans-serif;font-size:22px;font-weight:800;color:#b71c1c;">৳${totalExp.toFixed(0)}</div>
      </div>
      <div style="flex:1;background:${(totalFees-totalExp)>=0?'#e8f5e9':'#ffebee'};border-radius:10px;padding:12px;min-width:100px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Net Balance</div>
        <div style="font-family:'Baloo 2',sans-serif;font-size:22px;font-weight:800;color:${(totalFees-totalExp)>=0?'#1b5e20':'#b71c1c'};">৳${(totalFees-totalExp).toFixed(0)}</div>
      </div>
    </div>
    ${fees.length?`
    <h4 style="margin:0 0 8px;font-size:13px;color:var(--text);">💰 Fee Collections (${fees.length})</h4>
    <div style="overflow-x:auto;margin-bottom:14px;">
      <table style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead>
          <tr style="background:var(--card);text-align:left;">
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Student</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Class</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Type</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Month/Yr</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Amount</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Date</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">By</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${fees.map((f,i)=>`<tr style="background:${i%2===0?'transparent':'var(--card)'};">
            <td style="padding:7px 10px;font-weight:600;">${f.studentName||'—'}</td>
            <td style="padding:7px 10px;color:var(--muted);">${f.studentClass||'—'}</td>
            <td style="padding:7px 10px;">${f.feeType||'—'}</td>
            <td style="padding:7px 10px;color:var(--muted);">${f.month||''} ${f.year||''}</td>
            <td style="padding:7px 10px;font-weight:700;color:#2e7d32;">৳${f.amount||0}</td>
            <td style="padding:7px 10px;color:var(--muted);">${f.date||''}</td>
            <td style="padding:7px 10px;color:var(--muted);">${f.recordedBy||'—'}</td>
            <td style="padding:7px 10px;white-space:nowrap;">
              <button onclick="adminOpenEditFee('${f.id}')" ${btnStyle('#1a73e8','#fff')}>✏️ Edit</button>
              <button onclick="adminDeleteFee('${f.id}')" ${btnStyle('#e84040','#fff')} style="margin-left:4px;">🗑️</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`:''}
    ${expenses.length&&!monthF&&!clsF?`
    <h4 style="margin:0 0 8px;font-size:13px;color:var(--text);">💸 Expenses (${expenses.length})</h4>
    <div style="overflow-x:auto;">
      <table style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead>
          <tr style="background:var(--card);text-align:left;">
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Purpose</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Amount</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Date</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">By</th>
            <th style="padding:8px 10px;font-weight:700;border-bottom:2px solid var(--border);">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map((e,i)=>`<tr style="background:${i%2===0?'transparent':'var(--card)'};">
            <td style="padding:7px 10px;font-weight:600;">${e.purpose||'—'}</td>
            <td style="padding:7px 10px;font-weight:700;color:#c62828;">৳${e.amount||0}</td>
            <td style="padding:7px 10px;color:var(--muted);">${e.date||''}</td>
            <td style="padding:7px 10px;color:var(--muted);">${e.recordedBy||'—'}</td>
            <td style="padding:7px 10px;white-space:nowrap;">
              <button onclick="adminOpenEditExpense('${e.id}')" ${btnStyle('#1a73e8','#fff')}>✏️ Edit</button>
              <button onclick="adminDeleteExpense('${e.id}')" ${btnStyle('#e84040','#fff')} style="margin-left:4px;">🗑️</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`:''}`;
}

function exportAdminFinanceExcel(){
  const monthF=$('adm-fin-month')?.value||'';
  const clsF=$('adm-fin-cls')?.value||'';
  let fees=[...(window.appData.fees||[])];
  let expenses=[...(window.appData.expenses||[])];
  if(monthF) fees=fees.filter(f=>f.month===monthF);
  if(clsF) fees=fees.filter(f=>f.studentClass===clsF);
  fees.sort((a,b)=>b.createdAt-a.createdAt);
  expenses.sort((a,b)=>b.createdAt-a.createdAt);

  // Only show expenses when no month/class filter (matching renderAdminFinance behaviour)
  const showExpenses=!monthF&&!clsF;

  const totalFees=fees.reduce((s,f)=>s+(f.amount||0),0);
  const totalExp=showExpenses?expenses.reduce((s,e)=>s+(e.amount||0),0):0;
  const net=totalFees-totalExp;

  const title=`Master Academic — Finance Report${monthF?' ('+monthF+')':''}${clsF?' / '+clsF:''}`;

  // Build HTML table (Excel-compatible XLS via data URI)
  let html=`<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8"/>
  <style>
    body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}
    h2{font-size:14pt;color:#1b5e20;margin:0 0 6px;}
    .summary{font-size:12pt;font-weight:bold;margin-bottom:14px;}
    table{border-collapse:collapse;width:100%;margin-bottom:18px;}
    th{background:#1a2340;color:#fff;padding:7px 10px;text-align:left;font-size:10pt;}
    td{padding:6px 10px;border:1px solid #dde3ed;font-size:10pt;}
    tr:nth-child(even) td{background:#f5f8fa;}
    .sec-head{font-size:12pt;font-weight:bold;color:#1b5e20;margin:14px 0 6px;}
    .sec-exp{color:#c62828;}
    .total-row td{font-weight:bold;background:#e8f5e9!important;color:#1b5e20;}
    .total-row-exp td{font-weight:bold;background:#ffebee!important;color:#c62828;}
    .net-pos td{font-weight:bold;background:#e8f5e9!important;color:#1b5e20;font-size:12pt;}
    .net-neg td{font-weight:bold;background:#ffebee!important;color:#c62828;font-size:12pt;}
  </style></head><body>
  <h2>📊 ${title}</h2>
  <div class="summary">
    💰 Total Collections: ৳${totalFees.toFixed(0)} &nbsp;|&nbsp;
    💸 Total Expenses: ৳${totalExp.toFixed(0)} &nbsp;|&nbsp;
    📈 Net Balance: ৳${net.toFixed(0)}
  </div>`;

  // Fee Collections Table
  if(fees.length){
    html+=`<p class="sec-head">💰 Fee Collections (${fees.length} records)</p>
    <table>
      <tr><th>#</th><th>Student</th><th>Class</th><th>Fee Type</th><th>Month/Year</th><th>Amount (৳)</th><th>Date</th><th>Recorded By</th></tr>
      ${fees.map((f,i)=>`<tr>
        <td>${i+1}</td>
        <td>${f.studentName||'—'}</td>
        <td>${f.studentClass||'—'}</td>
        <td>${f.feeType||'—'}</td>
        <td>${f.month||''} ${f.year||''}</td>
        <td>${f.amount||0}</td>
        <td>${f.date||''}</td>
        <td>${f.recordedBy||'—'}</td>
      </tr>`).join('')}
      <tr class="total-row"><td colspan="5">TOTAL COLLECTIONS</td><td>৳${totalFees.toFixed(0)}</td><td colspan="2"></td></tr>
    </table>`;
  }

  // Expenses Table
  if(showExpenses&&expenses.length){
    html+=`<p class="sec-head sec-exp">💸 Expenses (${expenses.length} records)</p>
    <table>
      <tr><th>#</th><th>Purpose</th><th>Amount (৳)</th><th>Date</th><th>Recorded By</th></tr>
      ${expenses.map((e,i)=>`<tr>
        <td>${i+1}</td>
        <td>${e.purpose||'—'}</td>
        <td>${e.amount||0}</td>
        <td>${e.date||''}</td>
        <td>${e.recordedBy||'—'}</td>
      </tr>`).join('')}
      <tr class="total-row-exp"><td colspan="2">TOTAL EXPENSES</td><td>৳${totalExp.toFixed(0)}</td><td colspan="2"></td></tr>
    </table>`;
  }

  // Net balance summary row
  html+=`<table>
    <tr class="${net>=0?'net-pos':'net-neg'}">
      <td>📈 NET BALANCE (Collections − Expenses)</td>
      <td>৳${net.toFixed(0)}</td>
    </tr>
  </table>
  </body></html>`;

  const blob=new Blob(['\uFEFF'+html],{type:'application/vnd.ms-excel;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  const fname=`Finance_${monthF||'All'}_${clsF?clsF.replace(/\s/g,'')+'_':''}${new Date().toISOString().split('T')[0]}.xls`;
  a.download=fname;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📊 Excel exported!');
}

// ── ADMIN: FINANCE CRUD ─────────────────────────────────────────────────────

function closeFinEditModal(e){
  if(e&&e.target!==document.getElementById('fin-edit-modal')) return;
  const m=document.getElementById('fin-edit-modal');
  if(m) m.style.display='none';
}

function adminOpenEditFee(id){
  const fee=(window.appData.fees||[]).find(f=>f.id===id); if(!fee)return;
  document.getElementById('fin-edit-title').textContent='✏️ Edit Fee Entry';
  document.getElementById('fin-edit-fee-fields').style.display='';
  document.getElementById('fin-edit-exp-fields').style.display='none';
  document.getElementById('fin-edit-id').value=id;
  document.getElementById('fin-edit-type').value='fee';
  document.getElementById('fedit-name').value=fee.studentName||'';
  document.getElementById('fedit-cls').value=fee.studentClass||'Class 2';
  document.getElementById('fedit-type').value=fee.feeType||'Monthly Fee';
  document.getElementById('fedit-amount').value=fee.amount||'';
  document.getElementById('fedit-month').value=fee.month||'January';
  document.getElementById('fedit-year').value=fee.year||new Date().getFullYear();
  document.getElementById('fedit-date').value=fee.date||new Date().toISOString().split('T')[0];
  const m=document.getElementById('fin-edit-modal');
  m.style.display='flex';
}

function adminOpenEditExpense(id){
  const exp=(window.appData.expenses||[]).find(e=>e.id===id); if(!exp)return;
  document.getElementById('fin-edit-title').textContent='✏️ Edit Expense Entry';
  document.getElementById('fin-edit-fee-fields').style.display='none';
  document.getElementById('fin-edit-exp-fields').style.display='';
  document.getElementById('fin-edit-id').value=id;
  document.getElementById('fin-edit-type').value='expense';
  document.getElementById('eedit-purpose').value=exp.purpose||'';
  document.getElementById('eedit-amount').value=exp.amount||'';
  document.getElementById('eedit-date').value=exp.date||new Date().toISOString().split('T')[0];
  const m=document.getElementById('fin-edit-modal');
  m.style.display='flex';
}

async function adminSaveFinEdit(){
  const id=document.getElementById('fin-edit-id').value;
  const type=document.getElementById('fin-edit-type').value;
  if(!id||!type){showToast('Error: missing ID');return;}
  const {doc,updateDoc}=window._fb;
  try{
    if(type==='fee'){
      const name=(document.getElementById('fedit-name').value||'').trim();
      const cls=document.getElementById('fedit-cls').value;
      const ftype=document.getElementById('fedit-type').value;
      const amount=parseFloat(document.getElementById('fedit-amount').value||'0');
      const month=document.getElementById('fedit-month').value;
      const year=parseInt(document.getElementById('fedit-year').value||new Date().getFullYear());
      const date=document.getElementById('fedit-date').value;
      if(!name){showToast('Student নাম দিন!');return;}
      if(!amount||amount<=0){showToast('Amount দিন!');return;}
      await updateDoc(doc(window._db,'fees',id),{
        studentName:name,studentClass:cls,feeType:ftype,amount,month,year,date,
        editedByAdmin:true,editedAt:Date.now()
      });
      showToast('✅ Fee entry updated!');
    } else {
      const purpose=(document.getElementById('eedit-purpose').value||'').trim();
      const amount=parseFloat(document.getElementById('eedit-amount').value||'0');
      const date=document.getElementById('eedit-date').value;
      if(!purpose){showToast('Purpose লিখুন!');return;}
      if(!amount||amount<=0){showToast('Amount দিন!');return;}
      await updateDoc(doc(window._db,'expenses',id),{
        purpose,amount,date,editedByAdmin:true,editedAt:Date.now()
      });
      showToast('✅ Expense entry updated!');
    }
    closeFinEditModal(null);
    renderAdminFinance();
  }catch(e){showToast('❌ Error: '+e.message);}
}

async function adminDeleteFee(id){
  const {doc,deleteDoc}=window._fb;
  try{
    await deleteDoc(doc(window._db,'fees',id));
    showToast('🗑️ Fee entry deleted.');
    renderAdminFinance();
  }catch(e){showToast('❌ Error: '+e.message);}
}

async function adminDeleteExpense(id){
  const {doc,deleteDoc}=window._fb;
  try{
    await deleteDoc(doc(window._db,'expenses',id));
    showToast('🗑️ Expense entry deleted.');
    renderAdminFinance();
  }catch(e){showToast('❌ Error: '+e.message);}
}

async function adminAddFee(){
  const name=($('af-name')?.value||'').trim();
  const cls=$('af-cls')?.value||'';
  const ftype=$('af-type')?.value||'Monthly Fee';
  const amount=parseFloat($('af-amount')?.value||'0');
  const month=$('af-month')?.value||'January';
  const year=parseInt($('af-year')?.value||new Date().getFullYear());
  const date=$('af-date')?.value||new Date().toISOString().split('T')[0];
  if(!name){showToast('Student নাম দিন!');return;}
  if(!cls){showToast('Class বেছে নিন!');return;}
  if(!amount||amount<=0){showToast('Amount দিন!');return;}
  try{
    const {collection,addDoc}=window._fb;
    await addDoc(collection(window._db,'fees'),{
      studentName:name,studentClass:cls,feeType:ftype,amount,month,year,
      date,recordedBy:'Admin',addedByAdmin:true,createdAt:Date.now()
    });
    if($('af-name'))$('af-name').value='';
    if($('af-amount'))$('af-amount').value='';
    showToast(`✅ Fee added: ${name} — ${ftype} (${month})`);
    renderAdminFinance();
  }catch(e){showToast('❌ Error: '+e.message);}
}

async function adminAddExpense(){
  const purpose=($('ae-purpose')?.value||'').trim();
  const amount=parseFloat($('ae-amount')?.value||'0');
  const date=$('ae-date')?.value||new Date().toISOString().split('T')[0];
  if(!purpose){showToast('Purpose লিখুন!');return;}
  if(!amount||amount<=0){showToast('Amount দিন!');return;}
  try{
    const {collection,addDoc}=window._fb;
    await addDoc(collection(window._db,'expenses'),{
      purpose,amount,date,recordedBy:'Admin',addedByAdmin:true,createdAt:Date.now()
    });
    if($('ae-purpose'))$('ae-purpose').value='';
    if($('ae-amount'))$('ae-amount').value='';
    showToast(`✅ Expense added: ${purpose} — ৳${amount}`);
    renderAdminFinance();
  }catch(e){showToast('❌ Error: '+e.message);}
}

function renderStuDue(){
  const el=$('stu-due-banner'); if(!el||!curStudent)return;
  const dues=window.appData.dueNotifications.filter(d=>d.studentId===curStudent.id);
  if(!dues.length){el.innerHTML='';return;}
  el.innerHTML=dues.map(d=>`
    <div class="due-banner">
      <div class="due-banner-title">⚠️ Payment Due — ${d.month}</div>
      <div class="due-banner-body">${d.note||'আপনার এই মাসের ফি বাকি আছে।'}<br>
        <small style="opacity:.75">যোগাযোগ করুন: অফিসে গিয়ে পেমেন্ট করুন।</small>
      </div>
    </div>`).join('');
}

// ── Expose ALL inline-onclick functions explicitly on window ──
// Required so onclick="fnName()" works in all browsers/PWA contexts.
