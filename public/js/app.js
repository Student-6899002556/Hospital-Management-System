const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n||0));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateFmt = v => v ? String(v).slice(0,10) : '—';
const timeFmt = v => v ? String(v).slice(0,5) : '—';
const state = { patients:[], doctors:[], appointments:[], prescriptions:[], bills:[], payments:[], availability:[], view:'dashboard', edit:null };
const api = async (url, options={}) => {
  const res = await fetch('/api'+url,{headers:{'Content-Type':'application/json'},...options});
  let data={}; try { data=await res.json(); } catch {}
  if(!res.ok || data.success===false) throw new Error(data.message || 'Request failed');
  return data;
};
function notify(message,type='success'){
  const el=$('#toast'); el.textContent=message; el.className=`toast show ${type}`;
  clearTimeout(notify.timer); notify.timer=setTimeout(()=>el.className='toast',4500);
}
function setView(view){
  state.view=view;
  $$('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
  $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  const names={dashboard:'Dashboard overview',patients:'Patient management',doctors:'Doctor directory',appointments:'Appointments',prescriptions:'Prescriptions',billing:'Billing management',payments:'Payment management',reports:'Reports & analytics',audit:'Audit log'};
  $('#page-title').textContent=names[view]||'Hospital Management';
  loadView(view);
}
function badge(status){const cls=String(status||'').toLowerCase().replace(/\s+/g,'-');return `<span class="badge ${esc(cls)}">${esc(status||'—')}</span>`}
function table(headers, rows, empty='No records found.'){
 if(!rows.length)return `<div class="empty-state">${esc(empty)}</div>`;
 return `<table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function field(name,label,type='text',opts={}){
 const required=opts.required?'required':'';
 const full=opts.full?' full':'';
 const placeholder=opts.placeholder?`placeholder="${esc(opts.placeholder)}"`:'';
 const min=opts.min!==undefined?`min="${opts.min}"`:'';
 const max=opts.max!==undefined?`max="${opts.max}"`:'';
 const maxLength=opts.maxLength!==undefined?`maxlength="${opts.maxLength}"`:'';
 const step=opts.step?`step="${opts.step}"`:'';
 const value=opts.value!==undefined?`value="${esc(opts.value)}"`:'';
 let input='';
 if(type==='select') input=`<select name="${name}" ${required}>${(opts.options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(opts.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
 else if(type==='textarea') input=`<textarea name="${name}" ${required} ${placeholder}>${esc(opts.value||'')}</textarea>`;
 else input=`<input name="${name}" type="${type}" ${required} ${placeholder} ${min} ${max} ${maxLength} ${step} ${value}>`;
 return `<div class="field${full}"><label>${label}${opts.required?' *':''}</label>${input}</div>`;
}
function openModal(title, fields, onSave, submit='Save record'){
  $('#modal-title').textContent=title; $('#modal-fields').innerHTML=fields.join(''); $('#modal-submit').textContent=submit;
  const dialog=$('#modal'); dialog.returnValue=''; dialog.showModal();
  $('#modal-form').onsubmit=async e=>{e.preventDefault(); const data=Object.fromEntries(new FormData(e.currentTarget).entries()); try{await onSave(data);dialog.close();notify('Changes saved successfully.');await refreshAll();}catch(err){notify(err.message,'error');}};
}
function closeModal(){ $('#modal').close(); }
async function loadView(view){
 try{
  if(view==='dashboard') return await loadDashboard();
  if(view==='patients'){state.patients=(await api('/patients')).data;renderPatients();}
  if(view==='doctors'){state.doctors=(await api('/doctors')).data;state.availability=(await api('/availability')).data;renderDoctors();renderAvailability();}
  if(view==='appointments'){state.patients=(await api('/patients')).data;state.doctors=(await api('/doctors')).data;await loadAppointments();}
  if(view==='prescriptions'){state.prescriptions=(await api('/prescriptions')).data;renderPrescriptions();}
  if(view==='billing'){state.bills=(await api('/bills')).data;renderBills();}
  if(view==='payments'){state.payments=(await api('/payments')).data;state.bills=(await api('/bills')).data;renderPayments();}
  if(view==='reports') await loadReports();
  if(view==='audit'){const data=(await api('/audit')).data;$('#audit-table').innerHTML=table(['Type','Record ID','Action','Time','Description'],data.map(x=>`<tr><td>${esc(x.entity_type)}</td><td>${x.entity_id}</td><td>${esc(x.action_type)}</td><td>${esc(x.action_time)}</td><td>${esc(x.description)}</td></tr>`));}
 }catch(err){notify(err.message,'error');}
}
async function loadDashboard(){
 const d=await api('/dashboard'), s=d.stats;
 const cards=[
  ['Registered patients',s.patients,'♙','All patient records'],
  ['Active doctors',s.doctors,'⚕','Available clinicians'],
  ["Today's appointments",s.todayAppointments,'▣','Across all departments'],
  ['Outstanding balance',money(s.outstanding),'＄','Unpaid and partial bills'],
  ['Completed visits',s.completed,'✓','All-time completed'],
  ['Scheduled visits',s.scheduled,'◷','Upcoming and pending'],
  ['Payments received',money(s.payments),'↗','All recorded payments']
 ];
 $('#stats-grid').innerHTML=cards.map(c=>`<article class="stat-card"><div class="stat-top">${c[0]}<span class="stat-icon">${c[2]}</span></div><div class="stat-value">${c[1]}</div><div class="stat-note">${c[3]}</div></article>`).join('');
 $('#recent-appointments').innerHTML=table(['Patient','Doctor','Date & time','Status'],d.recent.map(a=>`<tr><td><strong>${esc(a.patient_name)}</strong></td><td>${esc(a.doctor_name)}</td><td>${dateFmt(a.appointment_date)} · ${timeFmt(a.appointment_time)}</td><td>${badge(a.status)}</td></tr>`),'No appointments recorded yet.');
 const monthly=d.monthly||[], max=Math.max(1,...monthly.map(x=>Number(x.revenue)));
 $('#revenue-chart').innerHTML=monthly.length?monthly.map(m=>`<div class="bar-group"><span class="bar-value">${Math.round(Number(m.revenue)/1000*10)/10}k</span><div class="bar" style="height:${Math.max(3,Number(m.revenue)/max*68)}%"></div><span class="bar-label">${esc(m.month)}</span></div>`).join(''):'<div class="empty-state">No payment history yet.</div>';
}
function renderPatients(){
 const q=($('#patient-search')?.value||'').toLowerCase();
 const rows=state.patients.filter(p=>`${p.patient_name} ${p.phone} ${p.patient_id}`.toLowerCase().includes(q));
 $('#patient-count').textContent=`${rows.length} record${rows.length===1?'':'s'}`;
 $('#patients-table').innerHTML=table(['Patient','Gender','Date of birth','Phone','Address','Actions'],rows.map(p=>`<tr><td><strong>#${p.patient_id} ${esc(p.patient_name)}</strong></td><td>${esc(p.gender||'—')}</td><td>${dateFmt(p.date_of_birth)}</td><td>${esc(p.phone||'—')}</td><td>${esc(p.address||'—')}</td><td><button class="action-btn" data-action="edit-patient" data-id="${p.patient_id}">Edit</button><button class="action-btn" data-action="patient-history" data-id="${p.patient_id}">History</button></td></tr>`));
}
function renderDoctors(){
 const q=($('#doctor-search')?.value||'').toLowerCase();
 const rows=state.doctors.filter(d=>`${d.doctor_name} ${d.specialization}`.toLowerCase().includes(q));
 $('#doctors-table').innerHTML=table(['Doctor','Specialization','Phone','Consultation fee','Status','Actions'],rows.map(d=>`<tr><td><strong>#${d.doctor_id} ${esc(d.doctor_name)}</strong></td><td>${esc(d.specialization||'—')}</td><td>${esc(d.phone||'—')}</td><td>${money(d.consultation_fee)}</td><td>${d.is_active?badge('Active'):badge('Inactive')}</td><td><button class="action-btn" data-action="edit-doctor" data-id="${d.doctor_id}">Edit</button></td></tr>`));
}
function renderAvailability(){
 $('#availability-table').innerHTML=table(['Doctor','Day','Start time','End time'],state.availability.map(a=>`<tr><td>${esc(a.doctor_name)}</td><td>${esc(a.available_day)}</td><td>${timeFmt(a.start_time)}</td><td>${timeFmt(a.end_time)}</td></tr>`),'No availability schedules. Add working hours before booking appointments.');
}
async function loadAppointments(){
 const params=new URLSearchParams();
 if($('#appointment-date-filter')?.value)params.set('date',$('#appointment-date-filter').value);
 if($('#appointment-status-filter')?.value)params.set('status',$('#appointment-status-filter').value);
 state.appointments=(await api('/appointments?'+params.toString())).data; renderAppointments();
}
function renderAppointments(){
 $('#appointments-table').innerHTML=table(['ID','Patient','Doctor','Date','Time','Duration','Status','Reason','Actions'],state.appointments.map(a=>`<tr><td>#${a.appointment_id}</td><td><strong>${esc(a.patient_name)}</strong></td><td>${esc(a.doctor_name)}</td><td>${dateFmt(a.appointment_date)}</td><td>${timeFmt(a.appointment_time)}</td><td>${a.duration_minutes} min</td><td>${badge(a.status)}</td><td>${esc(a.reason||'—')}</td><td>${a.status==='Scheduled'?`<button class="action-btn" data-action="complete-appointment" data-id="${a.appointment_id}">Complete</button><button class="action-btn danger" data-action="cancel-appointment" data-id="${a.appointment_id}">Cancel</button>`:'—'}</td></tr>`));
}
function renderPrescriptions(){
 const q=($('#prescription-search')?.value||'').toLowerCase();
 const rows=state.prescriptions.filter(p=>`${p.patient_name} ${p.doctor_name} ${p.medicine_name}`.toLowerCase().includes(q));
 $('#prescriptions-table').innerHTML=table(['ID','Patient','Doctor','Visit date','Medicine','Dosage','Frequency','Duration','Notes'],rows.map(p=>`<tr><td>#${p.prescription_id}</td><td>${esc(p.patient_name)}</td><td>${esc(p.doctor_name)}</td><td>${dateFmt(p.appointment_date)}</td><td><strong>${esc(p.medicine_name)}</strong></td><td>${esc(p.dosage||'—')}</td><td>${esc(p.frequency||'—')}</td><td>${esc(p.duration||'—')}</td><td>${esc(p.notes||'—')}</td></tr>`));
}
function renderBills(){
 $('#bills-table').innerHTML=table(['Bill','Patient','Doctor','Visit date','Consultation','Additional','Total','Paid','Outstanding','Status','Actions'],state.bills.map(b=>`<tr><td><strong>#${b.bill_id}</strong></td><td>${esc(b.patient_name)}</td><td>${esc(b.doctor_name)}</td><td>${dateFmt(b.appointment_date)}</td><td>${money(b.consultation_charge)}</td><td>${money(b.additional_charges)}</td><td><strong>${money(b.total_amount)}</strong></td><td>${money(b.amount_paid)}</td><td>${money(b.outstanding)}</td><td>${badge(b.payment_status)}</td><td><button class="action-btn" data-action="bill-details" data-id="${b.bill_id}">Details</button></td></tr>`));
}
function renderPayments(){
 $('#payments-table').innerHTML=table(['Payment ID','Bill ID','Patient','Amount','Method','Date'],state.payments.map(p=>`<tr><td>#${p.payment_id}</td><td>#${p.bill_id}</td><td>${esc(p.patient_name)}</td><td><strong>${money(p.amount_paid)}</strong></td><td>${badge(p.payment_method)}</td><td>${esc(p.payment_date)}</td></tr>`));
}
async function loadReports(){
 const [appts,revenue,outstanding]=await Promise.all([api('/reports/appointments'),api('/reports/revenue'),api('/reports/outstanding-bills')]);
 $('#appointment-report').innerHTML=table(['Date','Status','Count'],appts.data.map(r=>`<tr><td>${dateFmt(r.appointment_date)}</td><td>${badge(r.status)}</td><td>${r.total}</td></tr>`));
 $('#revenue-report').innerHTML=table(['Month','Revenue'],revenue.data.map(r=>`<tr><td>${esc(r.month)}</td><td>${money(r.revenue)}</td></tr>`));
 $('#outstanding-report').innerHTML=table(['Bill','Patient','Total','Paid','Outstanding'],outstanding.data.map(r=>`<tr><td>#${r.bill_id}</td><td>${esc(r.patient_name)}</td><td>${money(r.total_amount)}</td><td>${money(r.paid)}</td><td><strong>${money(r.outstanding)}</strong></td></tr>`));
}
async function refreshAll(){await loadView(state.view);}
function patientFields(p={}){return [
 field('patient_name','Patient name','text',{required:true,maxLength:100,value:p.patient_name||'',full:true}),
 field('gender','Gender','select',{options:[{value:'',label:'Select gender'},{value:'Female',label:'Female'},{value:'Male',label:'Male'},{value:'Other',label:'Other'}],value:p.gender||''}),
 field('date_of_birth','Date of birth','date',{max:new Date().toISOString().slice(0,10),value:dateFmt(p.date_of_birth)==='—'?'':dateFmt(p.date_of_birth)}),
 field('phone','Phone number','tel',{maxLength:15,value:p.phone||'',placeholder:'e.g. 9876500000'}),
 field('address','Address','text',{maxLength:255,value:p.address||'',full:true})
]}
function doctorFields(d={}){return [
 field('doctor_name','Doctor name','text',{required:true,value:d.doctor_name||'',full:true}),
 field('specialization','Specialization','text',{value:d.specialization||'',required:true}),
 field('phone','Phone number','tel',{value:d.phone||''}),
 field('consultation_fee','Consultation fee (₹)','number',{required:true,min:0,step:'0.01',value:d.consultation_fee??0}),
 field('is_active','Status','select',{options:[{value:'1',label:'Active'},{value:'0',label:'Inactive'}],value:String(d.is_active??1)})
]}
function appointmentFields(){
 return [
 field('patient_id','Patient','select',{required:true,options:[{value:'',label:'Select patient'},...state.patients.map(p=>({value:p.patient_id,label:`#${p.patient_id} — ${p.patient_name}`}))]}),
 field('doctor_id','Doctor','select',{required:true,options:[{value:'',label:'Select doctor'},...state.doctors.filter(d=>d.is_active).map(d=>({value:d.doctor_id,label:`${d.doctor_name} — ${d.specialization}`}))]}),
 field('appointment_date','Date','date',{required:true,min:new Date().toISOString().slice(0,10)}),
 field('appointment_time','Time','time',{required:true}),
 field('duration_minutes','Duration (minutes)','number',{required:true,min:5,max:240,value:30}),
 field('reason','Reason','text',{full:true,placeholder:'Reason for visit'})
]
}
async function handleAction(action,id){
 if(action==='new-patient'||action==='edit-patient'){
  const p=id?state.patients.find(x=>x.patient_id==id):null;
  openModal(p?'Edit patient':'Register patient',patientFields(p||{}),data=>api(p?`/patients/${id}`:'/patients',{method:p?'PUT':'POST',body:JSON.stringify(data)}));
 }
 if(action==='new-doctor'||action==='edit-doctor'){
  const d=id?state.doctors.find(x=>x.doctor_id==id):null;
  openModal(d?'Edit doctor':'Add doctor',doctorFields(d||{}),data=>api(d?`/doctors/${id}`:'/doctors',{method:d?'PUT':'POST',body:JSON.stringify({...data,is_active:data.is_active==='1'})}));
 }
 if(action==='new-appointment'||action==='quick-appointment'){
  state.patients=(await api('/patients')).data;state.doctors=(await api('/doctors')).data;
  openModal('Book appointment',appointmentFields(),data=>api('/appointments',{method:'POST',body:JSON.stringify(data)}),'Book appointment');
 }
 if(action==='new-availability'){
  state.doctors=(await api('/doctors')).data;
  openModal('Add doctor availability',[
   field('doctor_id','Doctor','select',{required:true,options:[{value:'',label:'Select doctor'},...state.doctors.filter(d=>d.is_active).map(d=>({value:d.doctor_id,label:d.doctor_name}))]}),
   field('available_day','Day','select',{required:true,options:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(x=>({value:x,label:x}))}),
   field('start_time','Start time','time',{required:true}),
   field('end_time','End time','time',{required:true})
  ],data=>api('/availability',{method:'POST',body:JSON.stringify(data)}));
 }
 if(action==='cancel-appointment'||action==='complete-appointment'){
  if(!confirm(action==='cancel-appointment'?'Cancel this appointment?':'Mark this appointment as completed?'))return;
  await api(`/appointments/${id}/${action==='cancel-appointment'?'cancel':'complete'}`,{method:'PATCH'});notify(action==='cancel-appointment'?'Appointment cancelled.':'Appointment completed.');await refreshAll();
 }
 if(action==='new-prescription'){
  const completed=(await api('/appointments?status=Completed')).data;
  openModal('Add prescription',[
   field('appointment_id','Completed appointment','select',{required:true,options:[{value:'',label:'Select appointment'},...completed.map(a=>({value:a.appointment_id,label:`#${a.appointment_id} — ${a.patient_name} / ${a.doctor_name} (${dateFmt(a.appointment_date)})`}))]}),
   field('medicine_name','Medicine name','text',{required:true}),
   field('dosage','Dosage','text',{placeholder:'e.g. 500 mg'}),
   field('frequency','Frequency','text',{placeholder:'e.g. Twice daily'}),
   field('duration','Duration','text',{placeholder:'e.g. 5 days'}),
   field('notes','Notes','textarea',{full:true})
  ],data=>api('/prescriptions',{method:'POST',body:JSON.stringify(data)}));
 }
 if(action==='new-bill'){
  const completed=(await api('/appointments?status=Completed')).data;
  const bills=(await api('/bills')).data;const billed=new Set(bills.map(b=>Number(b.appointment_id)));
  openModal('Generate bill',[
   field('appointment_id','Completed appointment','select',{required:true,options:[{value:'',label:'Select unbilled appointment'},...completed.filter(a=>!billed.has(Number(a.appointment_id))).map(a=>({value:a.appointment_id,label:`#${a.appointment_id} — ${a.patient_name} / ${a.doctor_name}`}))]}),
   field('additional_charges','Additional charges (₹)','number',{required:true,min:0,step:'0.01',value:0})
  ],data=>api('/bills',{method:'POST',body:JSON.stringify(data)}));
 }
 if(action==='new-payment'){
  state.bills=(await api('/bills')).data;
  const due=state.bills.filter(b=>Number(b.outstanding)>0);
  openModal('Record payment',[
   field('bill_id','Bill','select',{required:true,options:[{value:'',label:'Select outstanding bill'},...due.map(b=>({value:b.bill_id,label:`Bill #${b.bill_id} — ${b.patient_name} — Due ${money(b.outstanding)}`}))]}),
   field('amount_paid','Payment amount (₹)','number',{required:true,min:.01,step:'0.01'}),
   field('payment_method','Payment method','select',{required:true,options:['Cash','Card','UPI'].map(x=>({value:x,label:x}))})
  ],data=>api('/payments',{method:'POST',body:JSON.stringify(data)}));
 }
 if(action==='patient-history'){
  const p=(await api(`/patients/${id}`)).data;
  openModal(`Patient history · ${p.patient_name}`,[
   `<div class="field full"><label>Patient</label><input disabled value="${esc(p.patient_name)}"></div>`,
   `<div class="field full"><label>Appointment history</label><div class="table-wrap">${table(['Date','Doctor','Status'],p.appointments.map(a=>`<tr><td>${dateFmt(a.appointment_date)}</td><td>${esc(a.doctor_name)}</td><td>${badge(a.status)}</td></tr>`),'No appointment history.')}</div></div>`
  ],async()=>{},'Close');
  $('#modal-submit').onclick=e=>{e.preventDefault();closeModal()};
 }
 if(action==='bill-details'){
  const b=(await api(`/bills/${id}`)).data;
  openModal(`Bill #${b.bill_id} details`,[
   `<div class="field"><label>Patient</label><input disabled value="${esc(b.patient_name)}"></div>`,
   `<div class="field"><label>Doctor</label><input disabled value="${esc(b.doctor_name)}"></div>`,
   `<div class="field"><label>Total amount</label><input disabled value="${money(b.total_amount)}"></div>`,
   `<div class="field"><label>Outstanding</label><input disabled value="${money(b.outstanding)}"></div>`,
   `<div class="field full"><label>Payment history</label><div class="table-wrap">${table(['Date','Amount','Method'],b.payments.map(p=>`<tr><td>${esc(p.payment_date)}</td><td>${money(p.amount_paid)}</td><td>${esc(p.payment_method)}</td></tr>`),'No payments recorded.')}</div></div>`
  ],async()=>{},'Close');
  $('#modal-submit').onclick=e=>{e.preventDefault();closeModal()};
 }
}
document.addEventListener('click',async e=>{
 const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return;}
 const action=e.target.closest('[data-action]');if(action){try{await handleAction(action.dataset.action,action.dataset.id)}catch(err){notify(err.message,'error')}}
});
$('#modal-close').addEventListener('click',closeModal);$('#modal-cancel').addEventListener('click',closeModal);
$('#refresh-btn').addEventListener('click',()=>refreshAll().catch(e=>notify(e.message,'error')));
$('#patient-search').addEventListener('input',renderPatients);
$('#doctor-search').addEventListener('input',renderDoctors);
$('#prescription-search').addEventListener('input',renderPrescriptions);
$('#appointment-date-filter').addEventListener('change',()=>loadAppointments().catch(e=>notify(e.message,'error')));
$('#appointment-status-filter').addEventListener('change',()=>loadAppointments().catch(e=>notify(e.message,'error')));
$('#clear-appointment-filters').addEventListener('click',()=>{$('#appointment-date-filter').value='';$('#appointment-status-filter').value='';loadAppointments().catch(e=>notify(e.message,'error'))});
$('#today-label').textContent=new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date());
setView('dashboard');
