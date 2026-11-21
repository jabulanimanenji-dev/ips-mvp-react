/* IPS Academic Services — independent public site and authenticated company workspaces. */
const root=document.getElementById('app');
const state={account:null,catalogue:null,page:'home',category:'all',service:'',tab:'overview',opened:'',
 message:'',error:'',busy:false,isEvaluation:false,firstLogin:false,rootEntry:location.pathname.startsWith('/root'),rootLens:null,rootDirectory:[]};
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const e=escapeText;
const stat=value=>'<span class="pill '+(['active','approved','accepted','completed','client_delivery','scoped'].includes(value)?'good':['suspended','declined','correction_requested'].includes(value)?'bad':'wait')+'">'+e(String(value||'pending').replaceAll('_',' '))+'</span>';
const date=d=>d?new Date(d).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Not scheduled';
const price=c=>Number.isInteger(c)?(c/100).toLocaleString('en-PL',{style:'currency',currency:'PLN'}):'Reviewed quote pending';
const short=t=>String(t||'').length>150?String(t).slice(0,150)+'…':String(t||'');
const b=(label,action,id='',klass='')=>'<button type="button" data-action="'+e(action)+'" data-id="'+e(id)+'" class="'+e(klass)+'">'+e(label)+'</button>';
const buttonRoute=(label,route,klass='')=>'<button type="button" data-nav="'+e(route)+'" class="'+e(klass)+'">'+e(label)+'</button>';
const field=(label,name,type='text',placeholder='',required=true,help='')=>'<label class="field">'+e(label)+(help?'<small>'+e(help)+'</small>':'')+'<input name="'+e(name)+'" type="'+e(type)+'" placeholder="'+e(placeholder)+'"'+(required?' required':'')+'></label>';
const textarea=(label,name,placeholder='',required=true)=>'<label class="field full">'+e(label)+'<textarea name="'+e(name)+'" placeholder="'+e(placeholder)+'"'+(required?' required':'')+'></textarea></label>';
const options=(label,name,items)=>'<label class="field">'+e(label)+'<select name="'+e(name)+'">'+items.map(x=>'<option value="'+e(x[0])+'">'+e(x[1])+'</option>').join('')+'</select></label>';
const form=(id,content,label,extra='')=>'<form data-form="'+e(id)+'" class="form"'+extra+'><div class="fields">'+content+'</div><div class="form-actions"><button type="submit" class="primary">'+e(label)+'</button></div></form>';
const panel=(heading,description,inner)=>'<section class="panel"><h2>'+e(heading)+'</h2>'+(description?'<p>'+e(description)+'</p>':'')+inner+'</section>';
const empty=t=>'<div class="empty">'+e(t)+'</div>';
const brand=()=>'<a href="#" class="mark" data-nav="home"><span class="crest">IPS</span><span><strong>IPS ACADEMIC SERVICES</strong><small>ACADEMIC & RESEARCH SUPPORT</small></span></a>';
const header=()=>'<div class="masthead"><header class="top">'+brand()+'<nav aria-label="Primary navigation" class="topnav">'+
 (state.account?'<span class="pill">'+e(state.account.role==='root'?'NYORO · ROOT ADMIN':state.account.role==='student'?'STUDENT / RESEARCHER':state.account.role.toUpperCase())+'</span>'+(state.rootLens?b('Return to Root','root-lens-exit'):'')+b('Sign out','logout'):
 [buttonRoute('Academic services','services'),buttonRoute('How IPS works','how'),buttonRoute('Privacy','privacy'),buttonRoute('Student / Researcher','register'),buttonRoute('Join our specialist network','specialist'),buttonRoute('Login','login','primary')].join(''))+
 '</nav></header></div>';
const footer=()=>'<footer class="foot"><span>© IPS Academic Services · Professional academic and research support</span><span>Written communication only · Private enquiries · Ethical academic assistance · No telephone calls</span></footer>';
const banner=()=>state.isEvaluation?'<div class="notice warn banner" role="status">IPS ACADEMIC SERVICES — ISOLATED EVALUATION. All review accounts and commissioned examples are fictional. No live email, Telegram messages or payments. Do not enter real student data.</div>':'';
const flash=()=>state.error?'<div class="notice error" role="alert">'+e(state.error)+'</div>':state.message?'<div class="notice success" role="status">'+e(state.message)+'</div>':'';
const shell=content=>{root.innerHTML=header()+banner()+content+footer();document.title='IPS Academic Services | '+(state.account?'Private workspace':state.page==='services'?'Academic services':'Academic & Research Support')};
const intro=(tag,title,desc)=>'<div class="page-intro"><span class="kicker">'+e(tag)+'</span><h1>'+e(title)+'</h1><p>'+e(desc)+'</p></div>';
const navData=(route,name,active)=>'<button type="button" data-tab="'+e(route)+'" class="'+(active===route?'active':'')+'">'+e(name)+'</button>';
const selectService=()=>state.catalogue.services.map(s=>[s.id,s.title]);
const chooseLevel=()=>state.catalogue.levels.map(x=>[x,x]);
const privacyCheck='<label class="field full"><span><input type="checkbox" name="privacyConsent" required> I agree to secure processing of my private enquiry and written communication from IPS.</span></label>';
const integrityCheck='<label class="field full"><span><input type="checkbox" name="integrityAcknowledged" required> I request legitimate academic guidance or editing and will respect my institution’s authorship and integrity requirements.</span></label>';
async function api(endpoint,{method='GET',body}={}){
 const res=await fetch('/api'+endpoint,{method,credentials:'same-origin',cache:'no-store',
  headers:{...(body?{'Content-Type':'application/json'}:{}),...(state.rootLens&&/^\/(academic|support|notifications)(\/|$)/.test(endpoint)?{'X-IPS-Root-Workspace-Target':state.rootLens.account.id}:{})},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'IPS could not complete the requested action.');
 return data;
}
function academicCard(s,i){return '<article class="service-card"><div class="service-code">IPS / '+e(s.category.toUpperCase())+' · '+String(i+1).padStart(2,'0')+'</div><h3>'+e(s.title)+'</h3><p>'+e(s.subtitle)+'</p>'+b('Explore academic support','service',s.id,'small')+'</article>'}
function home(){
 const featured=state.catalogue.services.filter(s=>['thesis-dissertation','statistics','academic-editing','research-methods','references-formatting','literature-reviews'].includes(s.id));
 shell('<main>'+
 '<section class="hero"><div class="hero-grid"><div><span class="kicker">IPS ACADEMIC SERVICES · CONFIDENTIAL ACADEMIC SUPPORT</span>'+
 '<h1>Expert guidance for <em>your academic journey.</em></h1>'+
 '<p>Research methodology, thesis guidance, statistical interpretation, academic editing, referencing and more — coordinated by IPS and delivered through qualified academic Specialists.</p>'+
 '<div class="cta-row">'+buttonRoute('Get a private academic quote','quote','primary')+buttonRoute('Explore academic services','services')+buttonRoute('Specialist opportunities','specialist','quiet')+'</div>'+
 '<div class="trust"><span>Students & Researchers</span><span>Verified Specialist network</span><span>Private, written correspondence</span></div></div>'+
 '<aside class="hero-side"><span class="kicker">HOW IPS SUPPORTS YOU</span><h2>Academic standards. Personal discretion.</h2>'+
 [['01','Tell us what academic guidance you need','Choose a service and describe your discipline, requirements and deadline.'],['02','Receive a professionally reviewed quotation','IPS checks scope and academic integrity, then replies in writing.'],['03','Work through one accountable company','Qualified Specialists work under IPS coordination and independent quality assurance.']].map(x=>'<div class="step"><b>'+x[0]+'</b><div><strong>'+x[1]+'</strong><p>'+x[2]+'</p></div></div>').join('')+
 '</aside></div></section>'+
 '<div class="strip"><section class="section"><div class="section-head"><div><span class="kicker">ACADEMIC EXPERTISE</span><h2>Support for genuine academic work</h2></div><p>From an undergraduate draft to doctoral research methods, IPS helps clients understand, improve and present their own work.</p></div>'+
 '<div class="service-grid">'+featured.map(academicCard).join('')+'</div><div class="cta-row">'+buttonRoute('View all 16 academic services','services')+'</div></section></div>'+
 '<section class="section"><div class="section-head"><div><span class="kicker">WORK WITH CONFIDENCE</span><h2>Privacy is built into your experience</h2></div></div><div class="cols">'+
 panel('For Students / Researchers','Choose a private username. Full legal names are not required to register or request a quote.','<div class="bullet">Automatic email verification and secure account access</div><div class="bullet">Written responses through approved contact channels</div><div class="bullet">Private submissions, progress updates and delivery history</div><div class="action-row">'+buttonRoute('Open your private workspace','register','primary')+'</div>')+
 panel('For Academic Specialists','Join our verified professional network for scoped academic assignments.','<div class="bullet">Academic experience and qualifications reviewed by IPS</div><div class="bullet">Clearly assigned briefs and manageable workloads</div><div class="bullet">Secure submissions, revisions and independent QA</div><div class="action-row">'+buttonRoute('Join our specialist network','specialist')+'</div>')+'</div></section>'+
 '<div class="strip"><section class="section">'+panel('Responsible academic support',state.catalogue.academicIntegrityNotice,
 '<div class="cta-row">'+buttonRoute('Request academic guidance','quote','primary')+buttonRoute('How our service works','how')+'</div>')+'</section></div></main>');
}
function services(){
 const cats=[['all','All academic services'],...state.catalogue.categories.map(x=>[x.id,x.name])];
 const rows=state.catalogue.services.filter(s=>state.category==='all'||s.category===state.category);
 shell('<main class="page">'+intro('IPS ACADEMIC SERVICES / CATALOGUE','Academic services designed around your discipline.',
 'Explore our academic guidance, research support, editing and data services. Each service has a defined scope and a confidential written quotation process.')+
 '<div class="category-tabs" role="group" aria-label="Academic service categories">'+cats.map(c=>'<button data-category="'+e(c[0])+'" class="'+(state.category===c[0]?'selected':'')+'">'+e(c[1])+'</button>').join('')+'</div>'+
 '<div class="service-grid">'+rows.map(academicCard).join('')+'</div><div class="notice mt">'+e(state.catalogue.academicIntegrityNotice)+'</div></main>');
}
function serviceDetail(){
 const s=state.catalogue.services.find(x=>x.id===state.service);
 if(!s)return services();
 shell('<main><header class="detail-hero"><span class="kicker">IPS / '+e(s.category.toUpperCase())+' / ACADEMIC SUPPORT</span><h1>'+e(s.title)+'</h1><p>'+e(s.description)+'</p><div class="cta-row">'+b('Request a quotation for this service','request-service',s.id,'primary')+buttonRoute('All academic services','services')+'</div></header>'+
 '<div class="detail-layout"><div>'+panel('What IPS can help you with','Scope is agreed in writing before any commission.',
 '<div class="small-list">'+s.deliverables.map(x=>'<div class="bullet">'+e(x)+'</div>').join('')+'</div>')+'</div>'+
 '<div>'+panel('What to include in your enquiry','Your privacy matters. Only share information necessary for a scoped academic quote.',
 '<div class="small-list">'+s.questions.map(x=>'<div class="bullet">'+e(x)+'</div>').join('')+'</div><div class="separator"></div>'+b('Get a private academic quote','request-service',s.id,'primary'))+'</div></div></main>');
}
function how(){
 shell('<main class="page">'+intro('HOW IPS ACADEMIC SERVICES WORKS','An accountable academic service, from enquiry to delivery.',
 'You deal with IPS as a company. We assess the request, coordinate approved Specialists, review deliverables and keep you informed in writing.')+
 '<div class="service-grid">'+[
 ['01','Private academic enquiry','Choose academic service, discipline, academic level and deadline. Request assistance under a username without providing your legal name.'],
 ['02','Scope and integrity review','IPS checks academic suitability and asks any necessary questions. No unsupported price or misleading academic promise.'],
 ['03','Written quotation','Authorized staff provide a real quotation with scope, deliverables, timing, revisions and terms.'],
 ['04','Governed Specialist assignment','After the formal commission/payment checkpoint, IPS selects a qualified approved Specialist.'],
 ['05','Independent academic QA','Submissions are reviewed by IPS before any final client release; corrections are documented.'],
 ['06','Secure delivery and aftercare','You receive the approved academic deliverable securely, can request revisions within the agreed scope and track closure.']
 ].map((x,i)=>'<div class="service-card"><span class="service-code">STEP '+x[0]+'</span><h3>'+e(x[1])+'</h3><p>'+e(x[2])+'</p></div>').join('')+'</div><div class="cta-row">'+buttonRoute('Request academic support','quote','primary')+'</div></main>');
}
function privacy(){
 shell('<main class="page">'+intro('IPS / CONFIDENTIALITY','Privacy and academic discretion are part of our service.',
 'IPS clients can use a private username, verified email and written contact preferences. Confidential academic materials must stay within authorized company workflows.')+
 '<div class="cols">'+
 panel('What we collect','We request only information appropriate for the academic support being considered.',
 '<div class="bullet">Private username and verified email for account access</div><div class="bullet">Your chosen service, subject, academic level and required instructions</div><div class="bullet">Relevant drafts and documents only when necessary</div><div class="bullet">Specialists provide genuine professional identities and qualifications</div>')+
 panel('What IPS protects','Academic files, quotations and correspondence are not public records.',
 '<div class="bullet">Role-based company access and documented activities</div><div class="bullet">Verified email links and self-service password recovery</div><div class="bullet">Written communication — no telephone calls</div><div class="bullet">Private project files and independent review</div>')+'</div><div class="notice mt">The standalone evaluation is for inspection only and must not be used to upload genuine client materials. The production privacy policy and applicable regulatory notices require separate legal approval.</div></main>');
}
function quoteFields(guest){
 const info=options('Academic service needed','serviceId',selectService())+
 options('Your academic level','academicLevel',chooseLevel())+
 field('Academic subject / discipline','subject','text','e.g. Nursing, Economics, Psychology')+
 field('Preferred deadline','deadline','date','',false)+
 textarea('Describe the academic help you need','requirements','Share the topic, current progress, challenges and expected result')+
 textarea('University guidance or special instructions (optional)','institutionGuidance','Brief, style guide, supervisor comments or permitted support',false)+
 options('Preferred written reply','contactChannel',guest?[['email','Email'],['telegram','Telegram (email verification still required)']]:
 [['workspace','Private IPS workspace'],['email','Email'],['telegram','Telegram (if available)']])+
 field('Telegram username, if selected','telegramUsername','text','@yourusername',false)+integrityCheck;
 return info;
}
function quote(){
 state.page='quote';const guest=!state.account;
 shell('<main class="page">'+intro('REQUEST AN IPS QUOTATION','Tell us what academic support you need.',
 'IPS first reviews your academic scope, then supplies a confidential written quotation. There are no phone calls and no automatic prices.')+
 '<div class="cols"><div>'+panel('Academic enquiry','Select a real service and describe your requirements.',
 form(guest?'guest-quote':'student-quote',
 (guest?field('Your private username','username','text','A pseudonym is welcome')+field('Email for confirmation','email','email','you@example.com'):'')+
 quoteFields(guest)+(guest?privacyCheck:''),'Send confidential academic enquiry'))+'</div><aside>'+
 panel('Your confidentiality comes first','You are not required to provide your legal name for a quotation.',
 '<div class="bullet">We verify email ownership automatically</div><div class="bullet">A qualified person reviews the scope and quote</div><div class="bullet">You choose how IPS replies in writing</div><div class="bullet">Academic integrity remains mandatory</div>'+
 '<div class="separator"></div><p>'+e(state.catalogue.academicIntegrityNotice)+'</p>')+'</aside></div></main>');
 const el=root.querySelector('select[name=serviceId]');if(el&&state.service)el.value=state.service;
}
function auth(title,subtitle,formContent,extras=''){
 shell('<main class="auth">'+intro('SECURE IPS ACADEMIC ACCESS',title,subtitle)+flash()+
 panel('Private account','IPS never asks you to share a password with its staff.',formContent+extras)+'</main>');
}
function login(){state.page='login';auth('Welcome back','Sign in to your Student / Researcher, Specialist or authorized IPS staff workspace.',
 form('login',field('Verified email address','email','email','you@example.com')+field('Password','password','password'),'Open my IPS workspace'),
 '<div class="action-row">'+buttonRoute('Get started','register')+buttonRoute('Forgot password?','recover')+'</div>')}
function rootLogin(){
 state.page='root-login';
 auth('Nyoro · Root Administration','Direct secure entry to IPS Academic Services company administration. Root authentication is required. Other accounts cannot use this address.',
 form('login',field('Root email address','email','email','Root account email')+field('Password','password','password','Root Admin password'),'Sign in as Nyoro Root Admin'),
 '<div class="notice mt">This URL provides a direct Root entry, not a login bypass. Root can open actual Student and Specialist workspaces after signing in.</div>');
}
function rootForbidden(){
 shell('<main class="auth">'+intro('ACCESS RESTRICTED','Nyoro Root Administration only',
 'Your current account is not the Root Admin. No Root permissions were granted.')+
 panel('Protected company workspace','Sign out of this account and authenticate as Nyoro to access the Root command centre.',
 '<div class="action-row">'+b('Sign out','logout','','primary')+'</div>')+'</main>');
}
function register(role='student'){
 state.page='register';state.service='';state.account=null;state.category=role;
 const specialist=role==='specialist';
 const content=options('Account type','role',[['student','Student / Researcher'],['specialist','Academic Specialist']])+
 (specialist?field('Full professional name','fullName','text','Your actual name'):field('Your private username','username','text','Choose a username'))+
 field('Email address','email','email','you@example.com')+
 field('Secure password','password','password','8+ characters, uppercase, number and symbol')+
 field('Confirm password','confirmPassword','password','Re-enter the same secure password')+
 (specialist?field('Academic qualification','qualification','text','Degree, field or training')+
 field('Professional experience','experience','text','Relevant research or editing experience',false)+
 '<label class="field full">Academic services you can professionally provide'+
 '<select name="expertise" multiple size="8">'+selectService().map(x=>'<option value="'+e(x[0])+'">'+e(x[1])+'</option>').join('')+'</select><small>Hold Ctrl to select multiple academic specialisms.</small></label>':'')+
 privacyCheck;
 auth(specialist?'Join our academic specialist network':'Get started with IPS',
 specialist?'Qualified Specialists use their real names and must pass review before assignment.':
 'Choose a private username. Legal full names are not required simply to register.',
 form('register',content,specialist?'Submit Specialist application':'Create private IPS account'),
 '<div class="action-row">'+buttonRoute('Already registered? Sign in','login')+'</div>');
 const select=root.querySelector('select[name=role]');if(select){select.value=role;select.addEventListener('change',ev=>register(ev.target.value))}
}
function recovery(){state.page='recover';auth('Recover your private account','A one-time link is automatically emailed to the verified account holder.',
 form('recovery',field('Registered email','email','email','you@example.com'),'Email recovery link'))}
function tokenForm(kind){
 const params=new URLSearchParams(location.hash.slice(1)),token=params.get(kind)||'',mail=params.get('email')||'';
 const headline=kind==='verify'?'Verify your IPS email':kind==='invite'?'Accept your IPS staff invitation':kind==='guestconfirm'?'Verify your academic enquiry':'Set a new password';
 const contents='<input type="hidden" name="token" value="'+e(token)+'"><input type="hidden" name="email" value="'+e(mail)+'">'+
 (kind==='guestconfirm'?'<input type="hidden" name="reference" value="'+e(params.get('ref')||'')+'">':'')+
 (['recover','invite'].includes(kind)?field('New strong password','password','password','8+ characters, uppercase, number and symbol')+field('Confirm password','confirmPassword','password'):'');
 state.page=kind;auth(headline,'This private link expires and can only be used once.',form(kind,contents,
 kind==='guestconfirm'?'Confirm my academic enquiry':kind==='verify'?'Verify my email':'Secure my account'));
}
function departmentsForRole(a){
 if(a.role==='student')return [['overview','My academic overview'],['quotes','My quotations'],['commissions','My academic work'],['support','Written support'],['notifications','Private updates'],['profile','Account & privacy']];
 if(a.role==='specialist')return [['overview','Academic assignments'],['commissions','Assigned academic work'],['support','IPS support'],['notifications','Private updates'],['profile','Professional profile']];
 if(a.role==='root')return [['overview','Nyoro · Command Centre'],['root-students','Student workspace'],['root-specialists','Specialist workspace'],['queues','Today & queues'],['quotes','Academic enquiries'],['people','Students & Specialists'],['commissions','Academic delivery'],['quality','Quality Assurance'],['support','Client Relations'],['workforce','Managers & Staff'],['finance','Finance & Billing'],['audit','Governance & Audit'],['notifications','Company alerts']];
 const t=[['overview','Department overview'],['queues','My department queue']];
 if(a.department==='client_relations')t.push(['quotes','Academic enquiries'],['people','Student accounts'],['support','Written support']);
 if(a.department==='academic_delivery')t.push(['quotes','Academic scope'],['commissions','Academic delivery']);
 if(a.department==='specialist_network')t.push(['people','Specialist network']);
 if(a.department==='quality_assurance')t.push(['quality','Academic QA']);
 if(a.department==='finance')t.push(['finance','Finance readiness']);
 if(a.department==='governance')t.push(['audit','Governance & Audit']);
 if(a.role==='manager')t.push(['workforce','My department staff']);
 t.push(['notifications','My notifications']);return t;
}
async function openRootLens(accountId){
 if(state.account?.role!=='root')throw Error('Only Nyoro Root Admin can open another academic workspace.');
 let directory=state.rootDirectory;
 if(!directory.some(p=>p.id===accountId)){
  directory=(await api('/administration/people')).people;
 }
 const selected=directory.find(p=>p.id===accountId);
 if(!selected||!['student','specialist'].includes(selected.role)||!selected.verified||selected.status!=='active'||
   (selected.role==='specialist'&&!selected.approved))throw Error('Choose an active verified academic workspace from the IPS directory.');
 state.rootLens={account:selected,directory:directory.filter(p=>p.role===selected.role&&p.verified&&p.status==='active'&&(p.role!=='specialist'||p.approved))};
 state.tab='overview';state.page='workspace';state.opened='';state.error='';state.message='';
 history.replaceState(null,'','/root');
 render();
}
function work(){
 const a=state.rootLens?.account||state.account;
 const tabs=departmentsForRole(a);
 if(!tabs.some(x=>x[0]===state.tab))state.tab='overview';
 const title=a.role==='root'?'Nyoro · Root Administration':a.role==='student'?
 (state.firstLogin?'Welcome to IPS':'Welcome back')+', '+(a.username||'Student / Researcher'):
 a.role==='specialist'?a.name+' · Academic Specialist':a.name+' · '+(state.catalogue.departments.find(x=>x.id===a.department)?.name||'IPS Team');
 const oversight=state.rootLens?'<div class="root-assist"><div><span class="kicker">NYORO ROOT ADMINISTRATION / ASSISTED WORKSPACE</span><strong>Currently viewing '+e(a.role==='student'?'Student / Researcher':'Academic Specialist')+' · '+e(a.username||a.name)+'</strong><p>Root remains signed in. Every assisted action is attributed to Nyoro. Review-only simulation is allowed for fictional accounts; live client agreements and specialist authorship cannot be forged.</p></div><div class="root-assist-controls"><label class="field">Switch '+e(a.role==='student'?'Student':'Specialist')+' without another login<select data-root-target>'+state.rootLens.directory.map(p=>'<option value="'+e(p.id)+'"'+(p.id===a.id?' selected':'')+'>'+e(p.username||p.name)+' · '+e(p.id)+'</option>').join('')+'</select></label>'+b('Return to Nyoro Root','root-lens-exit','','primary')+'</div></div>':'';
 shell('<div class="workspace"><aside class="sidebar"><div class="nav-label">IPS ACADEMIC COMPANY</div>'+tabs.map(t=>navData(t[0],t[1],state.tab)).join('')+
 '<div class="nav-label">YOUR RESPONSIBILITY</div><div class="notice" style="font-size:11px">'+e(a.role==='root'?'The Root Admin has no manager and cannot be deleted by staff.':a.role==='student'?'Your academic enquiries, projects and documents remain private to you and authorized IPS personnel.':a.role==='specialist'?'Only assigned academic work and approved communication are visible to Specialists.':'Your company authority is limited to your assigned department.')+'</div></aside>'+
 '<main class="workmain">'+oversight+'<div class="work-title"><span class="kicker">IPS ACADEMIC SERVICES / '+e(state.tab.toUpperCase())+'</span><h1>'+e(title)+'</h1><p>'+e(a.role==='root'?'Lead academic service operations, qualified Specialists, communications, quality assurance and responsible departments.':
 a.role==='student'?'Your confidential academic support, reviewed quotations and secure work history.':
 a.role==='specialist'?'Your professional academic assignments, approvals, submissions and IPS coordination.':
 'Manage real academic-service responsibilities and clients within your approved authority.')+'</p></div>'+flash()+
 '<div id="workbody" aria-live="polite"><div class="boot">Loading real academic company records…</div></div></main></div>');
 void loadTab();
}
const kpi=(name,count,sub)=>'<div class="metric"><span>'+e(name)+'</span><strong>'+e(count)+'</strong><small>'+e(sub)+'</small></div>';
const record=(heading,desc,id,stage,buttons='')=>'<article class="record"><div><h3>'+e(heading)+'</h3><p>'+e(short(desc))+'</p><small class="subtle">'+e(id)+'</small></div><aside>'+stat(stage)+buttons+'</aside></article>';
async function loadTab(){
 const a=state.rootLens?.account||state.account,tab=state.tab;
 const target=root.querySelector('#workbody');if(!target)return;
 try{
 let html='';
 if(tab==='root-students'||tab==='root-specialists'){
  const people=(await api('/administration/people')).people.filter(p=>p.role===(tab==='root-students'?'student':'specialist'));
  state.rootDirectory=people;
  html=panel(tab==='root-students'?'Student / Researcher workspaces':'Academic Specialist workspaces',
   'Nyoro can enter a real workspace without signing out, see its genuine records and perform permitted assisted actions. Root remains the accountable operator.',
   people.length?'<div class="small-list">'+people.map(p=>record(p.username||p.name,
     p.email+' · '+(p.role==='specialist'?'Verified professional academic specialist':'Private academic account'),
     p.id,p.status,b('Open workspace as Root','root-lens-open',p.id,'primary'))).join('')+'</div>':
   empty('No verified active '+(tab==='root-students'?'Students / Researchers':'Specialists')+' are currently available.'));
 }else if(tab==='overview'){
  const d=await api('/academic/dashboard'),m=d.metrics;
  html='<div class="metrics">'+kpi('Academic enquiries',m.enquiries,'Actual scoped cases')+
   kpi('Academic commissions',m.academicCommissions,'Visible to this role')+
   kpi('Support cases',m.support,'Written cases')+
   kpi('Unread updates',m.alerts,'Account-specific')+'</div><div class="cols">'+
   panel(a.role==='student'?'Your next academic step':a.role==='specialist'?'Your academic work':'Today at IPS Academic Services',
   a.role==='student'?'Submit a private academic quotation or inspect your existing projects.':
   a.role==='specialist'?'Review only the assignments formally allocated by IPS.':
   'The company is organized around academic intake, Specialist eligibility, work coordination and independent QA.',
   '<div class="action-row">'+(a.role==='student'?buttonRoute('Request academic assistance','quote','primary'):
   a.role==='specialist'?b('View assignments','tab-commissions','','primary'):b('Open company queues','tab-queues','','primary'))+'</div>')+
   panel('Academic standards and confidentiality','IPS coordinates legitimate academic support through authorized personnel.',
   '<div class="bullet">Verified email and controlled accounts</div><div class="bullet">Professionally scoped academic services</div>'+
   '<div class="bullet">Independent academic quality review</div><div class="bullet">Written contact only; no phone calls</div>'+
   '<p class="fine mt">Payment processing is pending and not represented as live in this evaluation.</p>')+'</div>';
 }else if(tab==='queues'){
  const d=await api('/administration/queues');
  html=panel('Department responsibilities','Queues contain actual academic cases and pending actions, not decorative counters.',
   d.queues.length?'<div class="small-list">'+d.queues.map(q=>
    '<div class="panel"><span class="kicker">'+e(q.department.replaceAll('_',' '))+'</span><h3>'+e(q.name)+' · '+e(q.count)+'</h3>'+
    (q.items.length?q.items.map(i=>record(i.service+' · '+i.subject,'Academic case needing attention',i.id,i.stage)).join(''):empty('No cases waiting in this queue.'))+'</div>').join('')+'</div>':empty('No queues are assigned to your current department.'));
 }else if(tab==='quotes'){
  const d=await api('/academic/quotes');
  html=(a.role==='student'?panel('Request academic assistance','Every enquiry is reviewed for scope and integrity before a price is issued.',
   '<div class="action-row">'+buttonRoute('Get a new academic quote','quote','primary')+'</div>'+
   form('claim-quote',field('Existing verified guest quote reference','reference','text','IPS-Q-…'),'Link my earlier quote')):'')+
   panel(a.role==='student'?'My academic quotations':'Academic enquiry register','Real subject, academic level, service, decisions and next steps.',
   d.quotes.length?'<div class="small-list">'+d.quotes.map(q=>
    record(q.serviceName+' · '+q.subject,q.requirements,q.id,q.status,
     (a.role==='student'&&q.status==='offered'?b('Accept quote','quote-accept',q.id,'primary')+b('Decline','quote-decline',q.id):
      a.role==='root'||a.role==='manager'?q.status==='received'?b('Review scope','scope-form',q.id):
       q.status==='scoped'?b('Issue written quotation','offer-form',q.id):'':'')+
     b('Details','quote-detail',q.id))).join('')+'</div>':empty('No academic quotations yet.'))+
   (state.opened?quoteDetail(d.quotes.find(q=>q.id===state.opened),a):'');
 }else if(tab==='commissions'||tab==='quality'){
  const d=await api('/academic/commissions');
  const items=tab==='quality'?d.commissions.filter(p=>['qa_pending','correction_requested','client_delivery'].includes(p.status)):d.commissions;
  html=panel(tab==='quality'?'Academic quality assurance':'Academic commissions and delivery',
    'Every commission is subject-specific, accountable, confidential and governed by real QA.',
    items.length?'<div class="small-list">'+items.map(p=>record(p.serviceName+' · '+p.subject,
     p.requirements,p.id,p.status,b('Open academic commission','commission-open',p.id))).join('')+'</div>':
     empty('No assigned academic cases in this view.'))+
     (state.opened?await commissionDetail(items.find(p=>p.id===state.opened),a):'');
 }else if(tab==='people'||tab==='workforce'){
  const d=await api('/administration/people');
  const people=tab==='workforce'?d.people.filter(p=>['manager','staff'].includes(p.role)):d.people;
  const invite=['root','manager'].includes(a.role)&&tab==='workforce';
  html=(invite?panel(a.role==='root'?'Appoint an IPS department manager':'Invite staff into my department',
    'Root has no manager. Department managers can invite only their own staff.',
    form('staff-invite',field('Professional full name','name')+field('Work email address','email','email')+
     (a.role==='root'?options('Accountable department','department',state.catalogue.departments.map(x=>[x.id,x.name])):''),'Send private invitation')):'')+
   panel(tab==='workforce'?'Workforce governance':'Students / Researchers and qualified Specialists',
   'View actual verified identities and perform only authorized company actions.',
   people.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Private identity</th><th>Position</th><th>Verification</th><th>Permitted management</th></tr></thead><tbody>'+
   people.map(p=>'<tr><td><b>'+e(p.username||p.name||'Private account')+'</b><small>'+e(p.email)+'</small></td><td>'+e(p.role)+' · '+e(p.department||'—')+'</td><td>'+stat(p.verified?'verified':p.status)+'</td><td><div class="actions">'+
     (canRecover(a,p)?b('Send recovery link','person-recover',p.id,'small'):'')+
     (canApprove(a,p)?b('Approve Specialist','person-approve',p.id,'small'):'')+
     (canSuspend(a,p)?b('Suspend','person-suspend',p.id,'small danger'):'')+
     '</div></td></tr>').join('')+'</tbody></table></div>':empty('No academic company identities yet.'));
 }else if(tab==='support'){
  const d=await api('/support');
  html=(['student','specialist'].includes(a.role)?panel('Ask IPS for written assistance','Your confidential request is placed in the company support queue.',
   form('support',field('Subject','subject')+textarea('How can IPS help?','message'),'Send written support request')):'')+
   panel('Confidential support cases','Company-managed written assistance with ownership and history.',
   d.tickets.length?'<div class="small-list">'+d.tickets.map(t=>record(t.subject,t.replies?.at(-1)?.message,t.id,t.status,
    b('Open support history','support-open',t.id))).join('')+'</div>':empty('No written support cases.'))+
   (state.opened?supportDetail(d.tickets.find(t=>t.id===state.opened)):'');
 }else if(tab==='notifications'){
  const d=await api('/notifications');
  html=panel('Private academic updates','Every notice belongs to your authorized IPS identity.',
   d.notifications.length?'<div class="small-list">'+d.notifications.map(n=>
    record(n.message,date(n.createdAt),n.id,n.kind,n.read?'':b('Mark read','notification-read',n.id,'small'))).join('')+'</div>':empty('No updates awaiting you.'));
 }else if(tab==='profile'){
  html=panel('Account and written contact preferences',
   a.role==='student'?'Your legal full name is not required simply to use IPS.':'Your professional identity is verified and protected.',
   '<p><strong>'+e(a.username||a.name)+'</strong><br><span class="muted">'+e(a.email)+'</span></p>'+
   '<div class="separator"></div>'+form('contact-preference',
   options('Preferred written contact','contactPreference',[['workspace','Private IPS workspace'],['email','Email'],['telegram','Telegram']])+
   field('Telegram username, if selected','telegram','text','@username',false),'Save private contact preference')+
   '<div class="action-row">'+buttonRoute('Recover account password','recover')+'</div>');
 }else if(tab==='finance'){
  const d=await api('/administration/queues');
  const q=d.queues.find(x=>x.department==='finance');
  html=panel('Academic Finance & Billing','Real invoicing and payment settlement integration is pending — no fake paid production projects.',
   '<div class="notice warn">Payment processing is intentionally disabled until all nonpayment academic service journeys pass.</div>'+
   (q?'<p>'+e(q.count)+' accepted academic cases are awaiting genuine payment integration.</p>':empty('No finance queue under your authority.')));
 }else if(tab==='audit'){
  const d=await api('/administration/audit');
  html=panel('Academic company security and audit','Identity, managerial and academic workflow events are recorded and permission-scoped.',
   d.events.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Recorded</th><th>Role</th><th>Action</th><th>Reference</th></tr></thead><tbody>'+
   d.events.map(x=>'<tr><td>'+e(date(x.at))+'</td><td>'+e(x.actorRole)+'</td><td>'+e(x.action)+'</td><td>'+e(x.ref)+'</td></tr>').join('')+
   '</tbody></table></div>':empty('No governance events recorded.'));
 }
 const current=root.querySelector('#workbody');if(current)current.innerHTML=html;
 }catch(err){const current=root.querySelector('#workbody');if(current)current.innerHTML='<div class="notice error">'+e(err.message)+'</div>';}
}
function canRecover(a,p){return p.verified&&p.status==='active'&&
 (a.role==='root'||(a.role==='manager'&&p.role==='staff'&&p.managerId===a.id)||
 (['manager','staff'].includes(a.role)&&
 ((a.department==='client_relations'&&p.role==='student')||(a.department==='specialist_network'&&p.role==='specialist'))))}
function canApprove(a,p){return p.role==='specialist'&&p.status==='pending_review'&&p.verified&&
 (a.role==='root'||(a.role==='manager'&&a.department==='specialist_network'))}
function canSuspend(a,p){return p.status==='active'&&(a.role==='root'||(a.role==='manager'&&p.role==='staff'&&p.managerId===a.id))}
function quoteDetail(q,a){
 if(!q)return '';
 const content='<p><strong>Academic service:</strong> '+e(q.serviceName)+'</p><p><strong>Level:</strong> '+e(q.academicLevel)+' · '+e(q.subject)+'</p>'+
 '<p>'+e(q.requirements)+'</p><p><strong>Institution instructions:</strong> '+e(q.institutionGuidance||'Not supplied')+'</p>'+
 '<p><strong>Deadline:</strong> '+e(q.deadline||'Discuss with IPS')+'</p>'+
 '<p><strong>Reviewed price:</strong> '+e(price(q.priceMinor))+'</p>'+
 (q.scopeNote?'<p><strong>Academic scope review:</strong> '+e(q.scopeNote)+'</p>':'')+
 (q.deliverables?'<p><strong>Agreed academic deliverables:</strong> '+e(q.deliverables)+'</p>':'')+
 (q.terms?'<p><strong>Quotation terms:</strong> '+e(q.terms)+'</p>':'');
 return '<div class="mt">'+panel('Academic quotation '+q.id,'Request and professional review history.',content)+'</div>';
}
async function commissionDetail(p,a){
 if(!p)return '';
 const msgs=await api('/academic/commissions/'+encodeURIComponent(p.id)+'/messages');
 const files=await api('/academic/commissions/'+encodeURIComponent(p.id)+'/files');
 const manager=a.role==='root'||a.role==='manager';
 const specialist=a.role==='specialist'&&p.specialistId===a.id,student=a.role==='student'&&p.studentId===a.id;
 let acts='';
 if(manager&&p.status==='ready_for_assignment')acts=form('assign',
  '<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+field('Approved Specialist reference','specialistId','text','SPC-…'),
  'Assign qualified academic Specialist');
 if(specialist&&['specialist_assigned','correction_requested','student_revision_requested'].includes(p.status))
  acts=form('submit-academic','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
   field('Academic deliverable for independent QA','upload','file','','true'),'Submit for IPS academic QA');
 if(manager&&p.status==='qa_pending')
  acts=form('quality','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
   options('Quality decision','decision',[['approve','Approve for secure client delivery'],['return_for_correction','Return to Specialist for corrections']])+
   textarea('Specific academic quality assessment','note','Describe the evidence, strengths or corrections needed'),
   'Record independent quality review');
 if(student&&p.status==='client_delivery')acts=form('student-decision',
  '<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
   options('Your decision','decision',[['accept','Accept completed academic support'],['request_revision','Request a revision within agreed scope']])+
   textarea('Revision request (required only if requesting revision)','note','Describe the correction needed',false),
   'Record my decision');
 const mil=Array.isArray(p.milestones)?p.milestones.map(m=>'<div class="record"><strong>'+e(m.name)+'</strong>'+stat(m.status)+'</div>').join(''):'';
 const thread='<div class="messages">'+(msgs.messages.length?msgs.messages.map(m=>
  '<div class="message'+(m.actorId===a.id?' mine':'')+'"><small>'+e(m.actorRole)+' · '+e(m.audience)+' · '+date(m.createdAt)+'</small><p>'+e(m.body)+'</p></div>').join(''):empty('No written messages yet.'))+'</div>'+
 form('commission-message','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
 (['root','manager','staff'].includes(a.role)?options('Directed IPS recipient','audience',
 [['student','Student / Researcher'],['specialist','Assigned Specialist'],['shared','Both participants']]):'')+
 textarea('Private academic message','body','Send your message through the IPS company coordination desk'),
 'Send written message');
 return '<div class="mt cols">'+
 panel('Academic commission '+p.id,'Academic subject: '+p.subject+' · '+p.academicLevel,
 '<p>'+e(p.serviceName)+'</p><p>'+e(p.requirements)+'</p><p><strong>Company status:</strong> '+stat(p.status)+'</p>'+
 '<div class="separator"></div><h3>Managed milestones</h3><div class="small-list">'+mil+'</div><div class="separator"></div>'+
 '<h3>Confidential academic files</h3>'+
 (files.files.length?files.files.map(f=>'<p><a href="/api/academic/files/'+e(f.id)+'" download>'+e(f.filename)+' · SHA-256 verified</a></p>').join(''):empty('No released documents are available in your role.'))+
 '<div class="separator"></div>'+acts)+
 panel('Written IPS academic coordination','Messages are routed and retained by IPS; no direct uncontrolled Specialist–client contact.',
 thread)+'</div>';
}
function supportDetail(t){
 if(!t)return '';
 return '<div class="mt">'+panel('Support case '+t.id,'Written assistance, ownership and resolution history.',
 '<div class="messages">'+(t.replies||[]).map(r=>'<div class="message"><small>'+e(r.role)+' · '+date(r.at)+'</small><p>'+e(r.message)+'</p></div>').join('')+'</div>'+
 (t.status==='open'?form('support-reply',
 '<input type="hidden" name="ticketId" value="'+e(t.id)+'">'+textarea('Private reply','message','Write the next helpful response'), 'Send secure reply')+
 '<div class="action-row">'+b('Resolve support case','support-close',t.id)+'</div>':''))+'</div>';
}
function render(){
 if(!state.catalogue){root.textContent='IPS Academic Services is loading…';return}
 if(state.rootEntry&&state.account&&state.account.role!=='root')return rootForbidden();
 if(state.rootEntry&&!state.account)return rootLogin();
 if(state.account&&!['quote','services','service','how','privacy'].includes(state.page))return work();
 const params=new URLSearchParams(location.hash.slice(1));
 for(const k of ['verify','recover','invite','guestconfirm'])if(params.has(k)){tokenForm(k);return}
 switch(state.page){case 'services':services();break;case 'service':serviceDetail();break;
 case 'how':how();break;case 'privacy':privacy();break;case 'quote':quote();break;
 case 'login':login();break;case 'register':register(state.category==='specialist'?'specialist':'student');break;
 case 'specialist':register('specialist');break;case 'recovery':recovery();break;
 default:home();}
}
async function submit(name,formNode){
 const data={};new FormData(formNode).forEach((v,k)=>{if(k==='expertise'){if(!data.expertise)data.expertise=[];data.expertise.push(v)}else if(v instanceof File)data[k]=v;else data[k]=v});
 for(const c of ['privacyConsent','integrityAcknowledged'])if(formNode.querySelector('[name="'+c+'"]'))data[c]=!!formNode.querySelector('[name="'+c+'"]').checked;
 const id=formNode.dataset.id||data.commissionId||'';
 if(name==='login'){const r=await api('/auth/login',{method:'POST',body:data});if(state.rootEntry&&r.account.role!=='root'){await api('/auth/logout',{method:'POST'});throw Error('This address is restricted to Nyoro Root Administration. Use the standard IPS login for other accounts.')}state.account=r.account;state.rootLens=null;state.firstLogin=!!r.account.firstLogin;state.page='workspace';state.tab='overview';state.opened='';return 'Signed in securely.'}
 if(name==='register'){
  if(data.password!==data.confirmPassword)throw Error('Confirm password must match the password exactly.');
  const r=await api('/auth/register',{method:'POST',body:data});state.page='login';return 'IPS sent your verification link. Confirm your mailbox before signing in.';
 }
 if(name==='guest-quote'){const r=await api('/academic/guest-quote',{method:'POST',body:data});state.page='login';return 'Your private academic enquiry '+r.reference+' needs email confirmation. IPS has sent a one-use link.'}
 if(name==='student-quote'){const r=await api('/academic/quotes',{method:'POST',body:data});state.page='workspace';state.tab='quotes';return 'IPS received your academic enquiry '+r.quote.id+'. A qualified team member will review its scope.'}
 if(name==='guestconfirm'){await api('/academic/guest-confirm',{method:'POST',body:data});location.hash='';state.page='login';return 'Your academic quotation enquiry is verified and awaiting written IPS review.'}
 if(name==='verify'){const r=await api('/auth/verify',{method:'POST',body:data});location.hash='';if(r.account){state.account=r.account;state.page='workspace';state.firstLogin=true;state.tab='overview'}else state.page='login';return r.reviewRequired?'Your specialist email is verified. IPS must approve your professional application.':'Your email is verified. Welcome to IPS.'}
 if(name==='recovery'){await api('/auth/recovery/request',{method:'POST',body:data});state.page='login';return 'If the verified account exists, IPS sent a secure one-use recovery email.'}
 if(name==='recover'||name==='invite'){if(data.password!==data.confirmPassword)throw Error('Passwords do not match.');
  const r=await api(name==='recover'?'/auth/recovery/complete':'/auth/invitation/accept',{method:'POST',body:data});location.hash='';if(r.account){state.account=r.account;state.page='workspace';state.tab='overview'}else state.page='login';return 'Your private IPS account credentials were updated successfully.'}
 if(name==='claim-quote'){await api('/academic/quotes/claim',{method:'POST',body:data});return 'Your previously verified guest academic enquiry is now attached to your account.'}
 if(name==='staff-invite'){await api('/administration/invite',{method:'POST',body:data});return 'IPS sent a secure department invitation.'}
 if(name==='scope'){await api('/academic/quotes/'+encodeURIComponent(id)+'/scope',{method:'POST',body:data});return 'Academic scope decision has been recorded.'}
 if(name==='offer'){data.priceMinor=Math.round(Number(data.pricePLN)*100);delete data.pricePLN;
  await api('/academic/quotes/'+encodeURIComponent(id)+'/offer',{method:'POST',body:data});return 'Reviewed academic quotation issued in writing.'}
 if(name==='assign'){await api('/academic/commissions/'+encodeURIComponent(id)+'/assign',{method:'POST',body:{specialistId:data.specialistId}});return 'Approved academic Specialist assignment recorded.'}
 if(name==='submit-academic'){
  const file=formNode.querySelector('input[name=upload]')?.files?.[0];
  if(!file)throw Error('Select a real academic deliverable.');
  if(file.size>1048576)throw Error('Academic file is over the current 1 MB evaluation limit.');
  const encoded=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result).split(',')[1]);rd.onerror=()=>reject(Error('Cannot read academic file.'));rd.readAsDataURL(file)});
  await api('/academic/commissions/'+encodeURIComponent(id)+'/submission',{method:'POST',body:{filename:file.name,mime:file.type,data:encoded}});
  return 'Academic deliverable submitted to independent IPS QA.';
 }
 if(name==='quality'){await api('/academic/commissions/'+encodeURIComponent(id)+'/quality',{method:'POST',body:data});return 'Academic QA decision recorded and responsible parties notified.'}
 if(name==='student-decision'){await api('/academic/commissions/'+encodeURIComponent(id)+'/student-decision',{method:'POST',body:data});return 'Your academic delivery decision is saved.'}
 if(name==='commission-message'){await api('/academic/commissions/'+encodeURIComponent(id)+'/messages',{method:'POST',body:data});return 'Your private written academic message is recorded in the IPS coordination desk.'}
 if(name==='support'){await api('/support',{method:'POST',body:data});return 'Your written academic support case is in the IPS Client Relations queue.'}
 if(name==='support-reply'){await api('/support/'+encodeURIComponent(data.ticketId)+'/reply',{method:'POST',body:{message:data.message}});return 'Private support response recorded.'}
 if(name==='contact-preference'){await api('/profile',{method:'PATCH',body:data});return 'Your preferred written contact channel was saved.'}
 throw Error('This academic operation has not been connected.');
}
document.addEventListener('submit',async ev=>{
 const formNode=ev.target.closest('form[data-form]');if(!formNode)return;ev.preventDefault();
 if(state.busy)return;state.busy=true;state.error='';state.message='';
 const btn=formNode.querySelector('button[type=submit]');if(btn)btn.disabled=true;
 try{state.message=await submit(formNode.dataset.form,formNode)}
 catch(ex){state.error=ex.message}
 finally{state.busy=false}
 if(state.account){render()}else{const msg=state.message,err=state.error;render();const container=root.querySelector('.page-intro')||root.querySelector('.hero')||root.querySelector('.auth .page-intro');if(container)container.insertAdjacentHTML('afterend',err?'<div class="notice error">'+e(err)+'</div>':'<div class="notice success">'+e(msg)+'</div>')}
});
document.addEventListener('change',async ev=>{
 const select=ev.target.closest('select[data-root-target]');
 if(!select||!state.rootLens||state.account?.role!=='root')return;
 try{await openRootLens(select.value)}catch(err){state.error=err.message;render()}
});
document.addEventListener('click',async ev=>{
 const route=ev.target.closest('[data-nav]'),tab=ev.target.closest('[data-tab]'),action=ev.target.closest('[data-action]'),category=ev.target.closest('[data-category]');
 if(category){state.category=category.dataset.category;services();return}
 if(route){ev.preventDefault();const dest=route.dataset.nav;state.error='';state.message='';state.opened='';
  if(state.account&&['home','services','quote','how','privacy'].includes(dest)){state.page=dest==='home'?'services':dest;render();return}
  state.page=dest;state.category=dest==='specialist'?'specialist':dest==='register'?'student':state.category;render();return}
 if(tab){state.tab=tab.dataset.tab;state.opened='';state.message='';state.error='';render();return}
 if(!action||state.busy)return;const act=action.dataset.action,id=action.dataset.id;state.error='';state.message='';
 if(act==='root-lens-exit'){state.rootLens=null;state.rootDirectory=[];state.page='workspace';state.tab='overview';state.opened='';history.replaceState(null,'','/root');render();return}
 if(act==='root-lens-open'){try{await openRootLens(id)}catch(err){state.error=err.message;render()}return}
 if(act==='service'){state.service=id;state.page='service';serviceDetail();return}
 if(act==='request-service'){state.service=id;state.page='quote';quote();return}
 if(act==='tab-commissions'||act==='tab-queues'){state.tab=act.slice(4);state.opened='';state.message='';state.error='';render();return}
 if(act==='quote-detail'||act==='commission-open'||act==='support-open'){state.opened=state.opened===id?'':id;render();return}
 if(act==='scope-form'||act==='offer-form'){
  const anchor=action.closest('.record');const markup=act==='scope-form'?
   form('scope',options('Academic scope decision','decision',[['approved','Appropriate academic support'],['clarify','Request clarification'],['declined','Decline inappropriate request']])+
    textarea('Document academic scope and integrity reasoning','note','Explain why this request is appropriate or needs clarification'),
    'Save academic scope review',' data-id="'+e(id)+'"'):
   form('offer',field('Real reviewed amount (PLN)','pricePLN','number','250.00')+
    textarea('Academic deliverables','deliverables','Describe the professional academic support that IPS will provide')+
    textarea('Quotation terms, limits and revisions','terms','Explain scope, revision terms and conditions')+
    field('Offer valid until','expires','date','',false),'Issue written academic quotation',' data-id="'+e(id)+'"');
  anchor.insertAdjacentHTML('afterend','<div class="panel mt">'+markup+'</div>');return}
 state.busy=true;
 try{
  if(act==='logout'){await api('/auth/logout',{method:'POST'});state.account=null;state.rootLens=null;state.page=state.rootEntry?'root-login':'home';state.opened='';state.tab='overview';}
  else if(['quote-accept','quote-decline'].includes(act)){
   const decision=act==='quote-accept'?'accept':'decline';
   const r=await api('/academic/quotes/'+encodeURIComponent(id)+'/decision',{method:'POST',body:{decision}});
   state.message=decision==='accept'?'Your quotation is accepted. IPS will tell you when verified payment commissioning becomes available.':'Your quotation has been declined.';}
  else if(['person-recover','person-approve','person-suspend'].includes(act)){
   if(act==='person-recover'){await api('/administration/people/'+encodeURIComponent(id)+'/send-recovery',{method:'POST'});state.message='IPS emailed a secure recovery link to the account owner.'}
   else{const decision=act==='person-approve'?'approve_specialist':'suspend';await api('/administration/people/'+encodeURIComponent(id)+'/decision',{method:'POST',body:{decision}});state.message='Governed account decision recorded.'}
  }
  else if(act==='support-close'){await api('/support/'+encodeURIComponent(id)+'/resolve',{method:'POST'});state.message='Written support case resolved.'}
  else if(act==='notification-read'){await api('/notifications/'+encodeURIComponent(id)+'/read',{method:'POST'});state.message='Notification marked read.'}
  else throw Error('This academic action needs an assigned workflow.');
 }catch(ex){state.error=ex.message}
 finally{state.busy=false}
 render();
});
(async()=>{
 try{
  state.catalogue=await api('/catalogue');
  const h=await api('/health');state.isEvaluation=h.environment==='ISOLATED_ACADEMIC_REVIEW';
  try{const s=await api('/session');state.account=s.account;state.page='workspace'}catch{state.page=state.rootEntry?'root-login':'home'}
  render();
 }catch(ex){root.innerHTML='<main class="page"><h1>IPS Academic Services</h1><div class="notice error">'+e(ex.message)+'</div></main>'}
})();
