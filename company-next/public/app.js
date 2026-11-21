// IPS COMPANY — entirely new standalone client application, no old IPS UI imports.
const root=document.getElementById('app');
const S={account:null,page:'home',tab:'overview',selected:'',data:[],project:null,notice:'',error:'',busy:false};
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>typeof n==='number'?(n/100).toLocaleString('en-PL',{style:'currency',currency:'PLN'}):'Awaiting quotation';
const date=x=>x?new Date(x).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not scheduled';
const summary=t=>String(t||'').length>160?String(t).slice(0,160)+'…':String(t||'');
const status=t=>'<span class="pill '+(['completed','delivered','active','accepted'].includes(t)?'good':['suspended','rejected'].includes(t)?'bad':'pending')+'">'+E(t||'unknown').replaceAll('_',' ')+'</span>';
const button=(label,action,id='',klass='')=>'<button type="button" data-action="'+E(action)+'" data-id="'+E(id)+'" class="'+klass+'">'+E(label)+'</button>';
const heading=(eyebrow,title,subtitle)=>'<header class="head"><div class="eyebrow">'+E(eyebrow)+'</div><h1>'+E(title)+'</h1><p>'+E(subtitle)+'</p></header>';
const field=(label,name,type='text',placeholder='',required=true)=>'<label class="field">'+E(label)+'<input name="'+E(name)+'" type="'+type+'" placeholder="'+E(placeholder)+'"'+(required?' required':'')+'></label>';
const area=(label,name,placeholder='',required=true)=>'<label class="field full">'+E(label)+'<textarea name="'+E(name)+'" placeholder="'+E(placeholder)+'"'+(required?' required':'')+'></textarea></label>';
const select=(label,name,choices)=>'<label class="field">'+E(label)+'<select name="'+E(name)+'">'+choices.map(x=>'<option value="'+E(x[0])+'">'+E(x[1])+'</option>').join('')+'</select></label>';
const panel=(title,subtitle,body)=>'<section class="panel"><div class="panel-head"><div><h2>'+E(title)+'</h2><p>'+E(subtitle)+'</p></div></div>'+body+'</section>';
const empty=message=>'<div class="empty">'+E(message)+'</div>';
const nav=()=>'<header class="top"><a class="logo" href="#" data-route="home"><div class="monogram">IPS</div><span><strong>INTERNATIONAL<br>PROJECT SERVICES</strong><small>PRIVATE COMPANY OPERATING SYSTEM</small></span></a><div class="top-actions">'+(S.account?'<span class="pill">'+E(S.account.role==='root'?'NYORO · ROOT ADMIN':S.account.role.toUpperCase())+'</span>'+button('Sign out securely','logout'):'<button data-route="login">Sign in</button><button class="primary" data-route="signup">Join IPS</button>')+'</div></header>';
const footer=()=>'<footer class="foot"><span>IPS · International Project Services · A confidential professional company</span><span>No telephone calls · No payments are collected until the payment system is approved</span></footer>';
const flash=()=>S.error?'<div role="alert" class="notice error">'+E(S.error)+'</div>':S.notice?'<div role="status" class="notice success">'+E(S.notice)+'</div>':'';
const layout=body=>{root.innerHTML=nav()+body+footer();document.title='IPS | '+(S.account?'Private Workspace':'International Project Services');};
const api=async(route,{method='GET',body}={})=>{
 const response=await fetch('/api'+route,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||data.message||'IPS could not complete the request.');
 return data;
};
const form=(id,fields,label,caption='')=>'<form data-form="'+id+'" class="stack"><div class="fields">'+fields+'</div><button type="submit" class="primary">'+E(label)+'</button>'+(caption?'<p class="subtitle">'+E(caption)+'</p>':'')+'</form>';
const authBox=(title,description,content,extra='')=>layout('<main class="auth">'+heading('IPS · SECURE ACCESS',title,description)+flash()+panel('Your private access','Credentials stay protected. IPS staff never see your password.',content+extra)+'</main>');
function guest(){
 S.page='home';S.tab='overview';
 layout('<main class="hero"><div class="hero-split"><div><div class="eyebrow">INTERNATIONAL PROJECT SERVICES / PRIVATE BY DESIGN</div><h1>Confidential project work. Accountable from first enquiry to final delivery.</h1><p>Private quotations, vetted specialists, one accountable company administration, documented quality reviews and secure delivery.</p><div class="hero-actions"><button class="primary" data-route="guestquote">Get a private written quote</button><button data-route="signup">Create private account</button><button data-route="login">Open my workspace</button><button data-route="specialist">Join our specialist network</button></div></div><aside class="hero-card"><div class="eyebrow">THE IPS STANDARD</div><h3>Professional service, not an ungoverned marketplace.</h3><div class="feature-row"><span class="dot"></span>Privately reviewed requirements and written quotes</div><div class="feature-row"><span class="dot"></span>Verified specialist eligibility and governed assignment</div><div class="feature-row"><span class="dot"></span>Trackable delivery, quality review and revisions</div><div class="feature-row"><span class="dot"></span>Confidential records and role-based management</div><p style="font-size:12px;margin-top:23px">No compulsory legal name for clients. No calls. No real payments currently collected.</p></aside></div></main>');
}
function login(){
 S.page='login';
 authBox('Sign in to IPS','Clients, specialists and company personnel use verified private accounts.',form('login',field('Verified email','email','email','your@email.com')+field('Password','password','password'), 'Open secure workspace')+'<div class="action-row">'+button('Create private account','nav-signup')+button('Reset my password','nav-recovery')+'</div>');
}
function signup(role='client'){
 S.page='signup';S.selected=role;
 const spec=role==='specialist',label=spec?'Apply as an IPS specialist':'Open a private client account';
 authBox(label,spec?'Your professional identity is required for specialist review.':'Choose a pseudonym. We do not need your legal name to open a private account.',
 form('signup',select('Account type','role',[['client','Client / researcher'],['specialist','Professional specialist']]).replace('<select name="role">','<select name="role" id="choose-role">')+(spec?field('Full professional name','full_name','text','Your actual full name'):field('Private username','username','text','Choose any available username'))+field('Email for verification','email','email','name@example.com')+field('Strong password','password','password','8+ characters, uppercase, number and symbol')+'<label class="field full"><span><input name="privacy_consent" type="checkbox" required style="width:18px;min-height:auto"> I agree to confidential account handling and written communication only.</span></label>',
 'Send private verification email','Only an email verified by its owner may sign in. IPS sends no telephone calls.'));
 const el=root.querySelector('select[name="role"]');if(el){el.value=role;el.addEventListener('change',e=>signup(e.target.value));}
}
function guestQuote(){
 S.page='guestquote';
 authBox('Request a private written quote','You do not need to open an account or provide your legal name.',form('guestquote',field('Private username','username','text','Choose a pseudonym')+field('Email for private written reply','email','email','you@example.com')+field('Service needed','service','text','e.g. Research methodology consultation')+area('What do you need?','summary','Describe your requirements, scope and deadline')+'<label class="field full"><span><input type="checkbox" name="privacy_consent" required style="width:18px;min-height:auto"> I consent to private written email communication. No telephone calls.</span></label>','Submit and verify my private request','IPS reviews requirements before issuing a written quote. No price is calculated automatically.'));
}
function recovery(){
 S.page='recovery';
 authBox('Recover your IPS account','A private, one-use link goes to the registered, verified email only.',
 form('recovery',field('Account email','email','email'),'Email one-use reset link','Your password is never exposed to administrators or specialists.'));
}
function secureLink(kind,token,email){
 S.page=kind;S.selected=token;
 const label=kind==='verify'?'Verify my email':kind==='guestverify'?'Verify my quote contact':kind==='invite'?'Accept company invitation':'Set a new password';
 const fields='<input type="hidden" name="token" value="'+E(token)+'"><input type="hidden" name="email" value="'+E(email)+'">'+(kind==='guestverify'?'<input type="hidden" name="quote_id" value="'+E(new URLSearchParams(location.hash.slice(1)).get('quote')||'')+'">':'')+(kind==='verify'||kind==='guestverify'?'':field('New private password','password','password','At least 8 characters, uppercase, digit and symbol')+field('Confirm new password','confirm','password'));
 authBox(label,'This link is private, time limited and usable only once.',form(kind,fields,label));
}
let tabs=(role,dept)=>role==='client'?[['overview','My workspace'],['quotes','Quotations'],['projects','My projects'],['support','Support'],['notifications','Private updates']]:role==='specialist'?[['overview','My assignments'],['projects','Assigned projects'],['support','Support'],['notifications','Private updates']]:role==='root'?[['overview','Leadership bridge'],['quotes','Enquiries & quotes'],['projects','Project command'],['people','People & authority'],['support','Support operations'],['notifications','Company alerts']]:role==='manager'?[['overview','Department overview'],['quotes','Quotation desk'],['projects','Operations'],['people','My team'],['support','Support desk'],['notifications','Private updates']]:[['overview','My responsibilities'],['quotes','Incoming enquiries'],['projects','Delivery'],['support','Assigned support'],['notifications','Private updates']];
const legacyTabs=tabs;
tabs=(role,dept)=>{
 if(['root','client','specialist'].includes(role))return legacyTabs(role,dept);
 const rows=[['overview','My responsibilities']];
 if(dept==='client_relations')rows.push(['quotes','Enquiries & quotations'],['support','Customer support']);
 if(['delivery','quality'].includes(dept))rows.push(['projects',dept==='quality'?'Quality & release':'Managed projects']);
 if(role==='manager')rows.push(['people','My staff']);
 if(role==='staff'&&['client_relations','specialists'].includes(dept))rows.push(['people','Account support']);
 rows.push(['notifications','Private updates']);
 return rows;
};
function workspace(page){
 S.page='workspace';
 const person=S.account;
 const menu=tabs(person.role,person.department);
 if(!menu.some(t=>t[0]===S.tab))S.tab='overview';
 const title=person.role==='root'?'Nyoro · Root Administration':person.role==='client'?person.username||'My private workspace':person.name||'IPS workspace';
 const side='<aside class="sidebar"><small>MANAGED RESPONSIBILITIES</small>'+menu.map(t=>'<button class="'+(S.tab===t[0]?'active':'')+'" type="button" data-tab="'+t[0]+'">'+E(t[1])+'</button>').join('')+'<small>CONFIDENTIAL COMPANY</small><div class="section-note">Every action is authenticated and recorded. Roles are restricted by actual responsibility.</div></aside>';
 layout('<div class="shell">'+side+'<main class="shell-main">'+heading('IPS / '+person.role.toUpperCase()+' / '+S.tab.replaceAll('_',' '),title,person.role==='root'?'The Root Admin has no manager and is not a deletable employee.':person.role==='client'?'Your identity and project materials are private to your account and the authorized company team.':'Your company access is limited to your assigned responsibilities.')+flash()+'<div id="workspace-body"><div class="loading">Loading current company records…</div></div></main></div>');
 void loadTab();
}
const countCard=(label,n,hint)=>'<article class="metric"><span>'+E(label)+'</span><strong>'+E(n)+'</strong><small>'+E(hint)+'</small></article>';
async function loadTab(){
 const t=S.tab,a=S.account?.role,body=root.querySelector('#workspace-body');if(!body)return;
 try{
  let html='';
  if(t==='overview'){
   const d=await api('/dashboard');
   html='<div class="metrics">'+countCard('Quotations',d.stats.quotes,'Written company intake')+countCard('Projects',d.stats.projects,'Managed project records')+countCard('Support cases',d.stats.support,'Documented resolutions')+countCard('Private alerts',d.stats.unread,'System-accountable updates')+'</div><div class="grid">'+panel('A real company workflow','No automatic price estimates or invented settlement figures. Every quotation is reviewed, delivered through supervised work and accepted by the client.','<div class="feature-row"><span class="dot"></span>Verification before access</div><div class="feature-row"><span class="dot"></span>Management approval before assignment</div><div class="feature-row"><span class="dot"></span>Quality gate before client delivery</div>')+panel('Your next work','Open the relevant management desk from the navigation.','<div class="action-row">'+(a==='client'?button('Request a written quotation','tab-quotes'):a==='specialist'?button('View assignments','tab-projects'):button('Open company projects','tab-projects'))+'</div><p>Payments remain unavailable. No live order can be falsely marked paid.</p>')+'</div>';
  }else if(t==='quotes'){
   const d=await api('/quotes');const client=a==='client';
   html=(client?panel('Claim an earlier guest quotation','If IPS sent a quote to your verified email, link the private reference here.',form('claim',field('Verified quote reference','quote_id','text','Q-…'),'Link my quotation'))+panel('Request a written quotation','Describe your requirements. We will review them before quoting.',form('quote',field('Service or subject','service','text','Research methods, editing, data analysis…')+area('What do you need?','summary','Describe your own project, objectives, scope and expected result')+field('Preferred deadline','deadline','date','',false),'Submit confidential request','No telephone calls, and no payment obligation to request a quote.')):'')+panel('Quotation register',client?'Your quotation conversations and decisions.':'Human-reviewed quotation work. No instant approval or fabricated costs.',d.quotes.length?'<div class="list">'+d.quotes.map(q=>'<div class="item"><div><h3>'+E(q.service)+' · '+E(q.id)+'</h3><p>'+E(summary(q.summary))+'</p><small class="subtitle">'+date(q.created_at)+' · '+money(q.amount_minor)+'</small></div><div class="controls">'+status(q.status)+(client&&q.status==='offered'?button('Accept quotation','accept-quote',q.id,'primary'):'')+(!client&&q.status==='new'?button('Issue quotation','offer-quote',q.id,'primary'):'')+'</div></div>').join('')+'</div>':empty('No quotation records yet.'));
  }else if(t==='projects'){
   const d=await api('/projects');
   const choices=d.projects.map(p=>'<div class="item"><div><h3>'+E(p.service)+' · '+E(p.id)+'</h3><p>'+E(summary(p.summary))+'</p><small class="subtitle">'+money(p.amount_minor)+' · '+date(p.updated_at)+'</small></div><div class="controls">'+status(p.status)+button('Open project','open-project',p.id)+'</div></div>').join('');
   html=panel('Company project register','One source of truth for assignment, quality, delivery, revision and final client acceptance.',d.projects.length?'<div class="list">'+choices+'</div>':empty('No eligible projects in this workspace.'));
   if(S.selected){const p=d.projects.find(x=>x.id===S.selected);if(p)html+=await projectPanel(p)}
  }else if(t==='people'){
   const d=await api('/people');
   const staff=['root','manager'].includes(a);
   html=(staff?panel(a==='root'?'Appoint a department manager':'Invite one of my staff','Root creates managers; each manager creates staff. No one creates another Root Admin.',form('invite-staff',field('Professional name','name')+field('Work email','email','email')+(a==='root'?select('Department','department',[['client_relations','Client Relations'],['delivery','Project Delivery'],['specialists','Specialist Network'],['communications','Communications'],['quality','Quality Assurance'],['finance','Finance'],['governance','Governance']]):''),'Send private invitation','The recipient chooses and confirms their own password.')):'')+panel('Governed people directory','Account access and recovery are controlled; no employee can delete the Root Admin.',d.people.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Identity</th><th>Role & department</th><th>State</th><th>Permitted actions</th></tr></thead><tbody>'+d.people.map(p=>'<tr><td><strong>'+E(p.username||p.name||'Private identity')+'</strong><small>'+E(p.email)+'</small></td><td>'+E(p.role)+' · '+E(p.department||'—')+'</td><td>'+status(p.status)+'</td><td>'+button('Send reset link','person-reset',p.id,'small')+(p.role==='specialist'&&!p.approved?button('Approve specialist','person-approve',p.id,'small'):'')+(a==='root'&&p.status==='active'?button('Suspend','person-suspend',p.id,'small danger'):'')+'</td></tr>').join('')+'</tbody></table></div>':empty('No new-company identities have joined yet.'));
  }else if(t==='support'){
   const d=await api('/support');
   html=(a==='client'||a==='specialist'?panel('Ask IPS for written support','Your message will be recorded and assigned, not handled by telephone.',form('support',field('Subject','subject')+area('Message','body'),'Submit support request')):'')+panel('Support cases','Accountable ownership, private written replies and controlled closure.',d.tickets.length?'<div class="list">'+d.tickets.map(q=>'<div class="item"><div><h3>'+E(q.subject)+' · '+E(q.id)+'</h3><p>'+E(q.replies?.at(-1)?.body||'')+'</p><small class="subtitle">'+date(q.updated_at)+'</small></div><div class="controls">'+status(q.status)+button('Reply','support-reply',q.id)+(q.status!=='closed'?button('Close','support-close',q.id):'')+'</div></div>').join('')+'</div>':empty('No support cases.'));
  }else if(t==='notifications'){
   const d=await api('/notifications');
   html=panel('Private updates','Each notification belongs to this account. No private customer details appear in public feeds.',d.notifications.length?'<div class="list">'+d.notifications.map(n=>'<div class="item"><div><h3>'+E(n.text)+'</h3><p>'+date(n.created_at)+'</p></div>'+status(n.kind)+'</div>').join('')+'</div>':empty('Your inbox has no events.'));
  }
  const current=root.querySelector('#workspace-body');if(current)current.innerHTML=html;
 }catch(e){const current=root.querySelector('#workspace-body');if(current)current.innerHTML='<div class="notice error">'+E(e.message)+'</div>';}
}
async function projectPanel(p){
 const d=await api('/projects/'+encodeURIComponent(p.id)+'/messages');
 const a=S.account;
 const writer=a.role==='specialist'&&p.specialist_id===a.id,client=a.role==='client'&&p.client_id===a.id;
 const admin=['root','manager','staff'].includes(a.role);
 let controls='';
 if(admin&&p.status==='awaiting_assignment')controls=form('assign',field('Approved specialist reference','specialist_id','text','ACC-…'),'Assign approved specialist')+'<input type="hidden" name="project_id" value="'+E(p.id)+'">';
 if(writer&&['assigned','revision_requested'].includes(p.status))controls=form('deliver',field('Quality-reviewed file','upload','file'),'Submit deliverable to QA')+'<input type="hidden" name="project_id" value="'+E(p.id)+'">';
 if(admin&&p.status==='qa_pending')controls='<div class="action-row">'+button('Approve quality & release','qa-approve',p.id,'primary')+button('Reject for corrections','qa-reject',p.id)+'</div>';
 if(client&&p.status==='delivered')controls='<div class="action-row">'+button('Accept final delivery','client-accept',p.id,'primary')+button('Request one revision','client-revision',p.id)+'</div>';
 const file=(p.pending_file_id&&['delivered','completed'].includes(p.status))?'<p><a class="button" href="/api/files/'+E(p.pending_file_id)+'" download>Download private deliverable</a></p>':'';
 return '<div style="margin-top:20px" class="grid">'+panel('Project '+p.id,'Status: '+p.status+' · Payment: '+p.payment_status,'<p>'+E(p.summary)+'</p><div class="divider"></div>'+status(p.status)+file+controls)+panel('Private project conversation','The client, assigned specialist and permitted IPS team can inspect this record.','<div class="stack">'+(d.messages.length?d.messages.map(m=>'<div class="message'+(m.sender_id===a.id?' self':'')+'"><small>'+E(m.sender_role)+' · '+date(m.created_at)+'</small><p>'+E(m.body)+'</p></div>').join(''):empty('No messages yet.'))+'</div>'+form('message','<input type="hidden" name="project_id" value="'+E(p.id)+'">'+area('New private message','body'),'Send written message'))+'</div>';
}
function render(){S.error='';S.notice='';if(S.account){workspace()}else{const hash=new URLSearchParams(location.hash.replace(/^#/,''));if(hash.has('verify')||hash.has('reset')||hash.has('invite')||hash.has('guestverify')){for(const name of ['verify','reset','invite','guestverify'])if(hash.has(name)){secureLink(name,hash.get(name),hash.get('email')||'');return}}if(S.page==='login')login();else if(S.page==='signup')signup(S.selected||'client');else if(S.page==='recovery')recovery();else if(S.page==='guestquote')guestQuote();else guest()}}
const submit=async(formName,values,formElement)=>{
 let d={},name=formName;values.forEach((value,key)=>d[key]=value);
 if(name==='login'){const r=await api('/auth/login',{method:'POST',body:d});S.account=r.account;S.tab='overview';S.selected='';}
 else if(name==='signup'){d.privacy_consent=!!formElement.querySelector('[name="privacy_consent"]')?.checked;await api('/auth/signup',{method:'POST',body:d});S.page='login';S.notice='Verification email sent. Verify your mailbox before signing in.';return}
 else if(name==='guestverify'){await api('/guest-quotes/verify',{method:'POST',body:d});location.hash='';S.page='login';S.notice='Your contact address is verified. IPS will review your request and send a written response.';return}
 else if(name==='verify'){const r=await api('/auth/verify',{method:'POST',body:d});location.hash='';if(r.account){S.account=r.account;S.tab='overview'}else S.page='login';S.notice=r.review_required?'Verified. Specialist approval is pending.':'Email ownership verified.';return}
 else if(name==='recovery'){await api('/auth/recovery/request',{method:'POST',body:d});S.page='login';S.notice='If a verified account exists, its one-time recovery email was requested.';return}
 else if(name==='reset'||name==='invite'){if(d.password!==d.confirm)throw Error('The two passwords do not match.');delete d.confirm;const r=await api(name==='reset'?'/auth/recovery/complete':'/people/accept',{method:'POST',body:d});location.hash='';if(r.account)S.account=r.account;else S.page='login';S.notice='Your password was saved securely.';return}
 else if(name==='guestquote'){d.privacy_consent=!!formElement.querySelector('[name="privacy_consent"]')?.checked;await api('/guest-quotes',{method:'POST',body:d});S.page='login';S.notice='A confirmation link was sent to your email. Your private request will be reviewed after verification.';return}
 else if(name==='claim'){await api('/guest-quotes/claim',{method:'POST',body:d});S.notice='Your verified guest quote is now linked to your private account.';}
 else if(name==='quote'){await api('/quotes',{method:'POST',body:d});S.notice='Your confidential request was submitted to IPS.';}
 else if(name==='offer'){const id=formElement.dataset.id;d.amount_minor=Math.round(Number(d.amount_pln)*100);delete d.amount_pln;await api('/quotes/'+encodeURIComponent(id)+'/offer',{method:'POST',body:d});S.notice='A documented quotation was issued.';}
 else if(name==='invite-staff'){await api('/people/invite',{method:'POST',body:d});S.notice='Private staff invitation was sent.';}
 else if(name==='reply'){await api('/support/'+encodeURIComponent(formElement.dataset.id)+'/reply',{method:'POST',body:{body:d.body}});S.notice='Secure support reply delivered.';}
 else if(name==='support'){await api('/support',{method:'POST',body:d});S.notice='Written support case created.';}
 else if(name==='message'){await api('/projects/'+encodeURIComponent(d.project_id)+'/messages',{method:'POST',body:{body:d.body}});S.notice='Private project message sent.';}
 else if(name==='assign'){await api('/projects/'+encodeURIComponent(d.project_id)+'/assign',{method:'POST',body:{specialist_id:d.specialist_id}});S.notice='Approved specialist assigned.';}
 else if(name==='deliver'){const file=formElement.querySelector('input[type=file]')?.files?.[0];if(!file)throw Error('Choose a file.');if(file.size>1048576)throw Error('File limit is 1 MB.');const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Cannot read file'));reader.readAsDataURL(file)});
   await api('/projects/'+encodeURIComponent(d.project_id)+'/deliver',{method:'POST',body:{filename:file.name,mime:file.type,data:base64}});S.notice='Deliverable recorded for quality review.';}
 else return;
};
document.addEventListener('submit',async e=>{
 const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();if(S.busy)return;S.busy=true;S.error='';S.notice='';
 const button=form.querySelector('button[type=submit]');if(button)button.disabled=true;
 try{await submit(form.dataset.form,new FormData(form),form)}catch(error){S.error=error.message}finally{S.busy=false;}
 if(S.account)workspace();else{const msg=S.notice,err=S.error;render();S.notice=msg;S.error=err;const place=root.querySelector('.auth .head');if(place)place.insertAdjacentHTML('afterend',flash());}
});
document.addEventListener('click',async e=>{
 const route=e.target.closest('[data-route]'),tab=e.target.closest('[data-tab]'),act=e.target.closest('[data-action]');
 if(route){e.preventDefault();S.error='';S.notice='';S.page=route.dataset.route;S.account?workspace():render();return}
 if(tab){S.selected='';S.tab=tab.dataset.tab;workspace();return}
 if(!act||S.busy)return;const action=act.dataset.action,id=act.dataset.id;
 if(action==='nav-signup'){S.page='signup';render();return}
 if(action==='nav-recovery'){S.page='recovery';render();return}
 if(action==='tab-quotes'||action==='tab-projects'){S.tab=action.slice(4);workspace();return}
 S.busy=true;S.error='';S.notice='';
 try{
  if(action==='logout'){await api('/auth/logout',{method:'POST'});S.account=null;S.page='home';S.selected='';}
  else if(action==='accept-quote'){await api('/quotes/'+encodeURIComponent(id)+'/accept',{method:'POST'});S.notice='Quotation accepted. Your project now awaits verified payment; payment collection is disabled.'}
  else if(action==='open-project'){S.selected=id}
  else if(action==='offer-quote'){const card=act.closest('.item');card.insertAdjacentHTML('afterend',panel('Written quotation','IPS must give a real amount and notes.',form('offer',field('Quoted amount (PLN)','amount_pln','number','E.g. 250')+area('Scope and decision notes','notes','Describe reviewed scope.',false),'Issue reviewed quotation').replace('data-form="offer"','data-form="offer" data-id="'+E(id)+'"')));return}
  else if(action==='person-approve'){await api('/people/'+encodeURIComponent(id)+'/review',{method:'POST',body:{action:'approve'}});S.notice='Specialist approved.'}
  else if(action==='person-suspend'){await api('/people/'+encodeURIComponent(id)+'/review',{method:'POST',body:{action:'suspend'}});S.notice='Account restricted and previous sessions revoked.'}
  else if(action==='qa-approve'||action==='qa-reject'){await api('/projects/'+encodeURIComponent(id)+'/quality',{method:'POST',body:{decision:action==='qa-approve'?'approve':'reject'}});S.notice='Quality decision recorded.'}
  else if(action==='client-accept'||action==='client-revision'){await api('/projects/'+encodeURIComponent(id)+'/client-action',{method:'POST',body:{action:action==='client-accept'?'accept':'revision'}});S.notice='Client decision recorded.'}
  else if(action==='support-close'){await api('/support/'+encodeURIComponent(id)+'/close',{method:'POST'});S.notice='Case closed.'}
  else if(action==='support-reply'){const card=act.closest('.item');card.insertAdjacentHTML('afterend',panel('Private support response','Only the account holder and authorized team can see this.',form('reply',area('Written reply','body'),'Send private reply').replace('data-form="reply"','data-form="reply" data-id="'+E(id)+'"')));return}
  else if(action==='person-reset'){await api('/people/'+encodeURIComponent(id)+'/send-reset',{method:'POST'});S.notice='Private recovery message requested for the verified account.'}
 }catch(error){S.error=error.message}finally{S.busy=false}
 S.account?workspace():render();
});
(async()=>{try{const d=await api('/me');S.account=d.account}catch{}render()})();
