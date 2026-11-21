/* IPS Academic Services — independent public site and authenticated company workspaces. */
const root=document.getElementById('app');
const state={account:null,catalogue:null,page:'home',category:'all',registerRole:'student',service:'',tab:'overview',opened:'',
 message:'',error:'',busy:false,backStack:[],isEvaluation:false,firstLogin:false,rootEntry:location.pathname.startsWith('/root'),rootLens:null,rootDirectory:[]};
// Every screen has a Back control. Native browser Back restores the same in-app context.
const snap=()=>({page:state.page,tab:state.tab,opened:state.opened,
 service:state.service,category:state.category,rootLens:state.rootLens});
const remember=()=>{
 state.backStack.push(snap());
 if(state.backStack.length>35)state.backStack.shift();
 history.pushState({ipsNavigation:true},'',location.href);
};
const goBack=()=>{
 const last=state.backStack.pop();
 if(last){Object.assign(state,last);state.error='';state.message='';render();return}
 if(state.rootLens){state.rootLens=null;state.tab='overview';state.page='workspace'}
 else if(state.account){state.tab='overview';state.page='workspace';state.opened=''}
 else{state.page='home';state.opened=''}
 render();
};
window.addEventListener('popstate',()=>goBack());
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
const footer=()=>'<footer class="foot"><span>© IPS Academic Services · Academic & research support</span><span>'+buttonRoute('Privacy policy','privacy','quiet')+' · Written correspondence only</span></footer>';
const banner=()=>state.isEvaluation?'<div class="banner" role="status">REVIEW ENVIRONMENT · Fictional accounts and academic records · No payments or external messages</div>':'';
const flash=()=>state.error?'<div class="notice error" role="alert">'+e(state.error)+'</div>':state.message?'<div class="notice success" role="status">'+e(state.message)+'</div>':'';
const shell=content=>{root.innerHTML=header()+banner()+((state.page!=='home'&&state.page!=='workspace'&&state.page!=='root-login')?'<div class="toolbar global-toolbar">'+b('← Back','back','','back-btn')+'</div>':'')+content+footer();document.title='IPS Academic Services | '+(state.account?'Private workspace':state.page==='services'?'Academic services':'Academic & Research Support')};
const intro=(tag,title,desc)=>'<div class="page-intro"><span class="kicker">'+e(tag)+'</span><h1>'+e(title)+'</h1><p>'+e(desc)+'</p></div>';
const navData=(route,name,active)=>'<button type="button" data-tab="'+e(route)+'" class="'+(active===route?'active':'')+'">'+e(name)+'</button>';
const selectService=()=>state.catalogue.services.map(s=>[s.id,s.title]);
const chooseLevel=()=>state.catalogue.levels.map(x=>[x,x]);
const privacyCheck='<label class="field full"><span><input type="checkbox" name="privacyConsent" required> I agree to secure processing of my private enquiry and written communication from IPS.</span></label>';
const integrityCheck='<label class="field full"><span><input type="checkbox" name="integrityAcknowledged" required> I agree to the academic integrity requirements.</span></label>';
async function api(endpoint,{method='GET',body,operator=false}={}){
 const res=await fetch('/api'+endpoint,{method,credentials:'same-origin',cache:'no-store',
  headers:{...(body?{'Content-Type':'application/json'}:{}),...(state.rootLens&&!operator&&(/^\/(academic|support|notifications)(\/|$)/.test(endpoint)||
   /^\/operations\/inbox$/.test(endpoint)||/^\/operations\/[^/]+\/(?:files|upload)$/.test(endpoint)||
   (method==='GET'&&(/^\/operations\/direct-message$/.test(endpoint)||
   /^\/operations\/direct-message\/[^/]+\/thread$/.test(endpoint))))?{'X-IPS-Root-Workspace-Target':state.rootLens.account.id}:{})},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'IPS could not complete the requested action.');
 return data;
}
const PHOTO_LIBRARY='https://images.unsplash.com/photo-1629050290461-283e7bd7805f?auto=format&fit=crop&w=1400&q=82';
const PHOTO_DESK='https://images.unsplash.com/photo-1769794370964-78412732f1cd?auto=format&fit=crop&w=1100&q=80';
function academicCard(s,i){
 return '<article class="service-card"><span class="service-code">ACADEMIC SERVICE / '+String(i+1).padStart(2,'0')+'</span>'+
 '<h3>'+e(s.title)+'</h3><p>'+e(s.subtitle)+'</p><div class="card-footer">'+b('View service','service',s.id,'small quiet')+'</div></article>';
}
function home(){
 const featured=state.catalogue.services.filter(s=>['thesis-dissertation','statistics','academic-editing','research-methods','references-formatting','literature-reviews'].includes(s.id));
 shell('<main class="public-site">'+
 '<section class="hero"><div class="hero-grid"><div class="hero-copy"><span class="kicker">IPS / ACADEMIC SERVICES</span>'+
 '<h1>Expert guidance for <em>your academic journey.</em></h1>'+
 '<p>Research support, thesis guidance, statistical analysis, academic editing and more. One professional team, one clear process.</p>'+
 '<div class="cta-row">'+buttonRoute('Request a quotation','quote','primary')+buttonRoute('Explore services','services')+'</div>'+
 '<div class="hero-signature"><span>Students & Researchers</span><span>Qualified Specialists</span><span>Written support</span></div></div>'+
 '<figure class="hero-photography"><img class="hero-photo" src="'+PHOTO_LIBRARY+'" alt="Photograph of an authentic historic library reading room and its bookshelves" referrerpolicy="no-referrer" fetchpriority="high">'+
 '<figcaption><span class="kicker">ACADEMIC RESEARCH & GUIDANCE</span><strong>Focused support for meaningful scholarly work.</strong></figcaption></figure></div></section>'+
 '<section class="section experience"><div class="section-head"><div><span class="kicker">THE IPS EXPERIENCE</span><h2>Professional help, without the complexity.</h2></div>'+
 '<p>Tell us what you need. Receive a written scope and quotation. Follow your academic work in one secure workspace.</p></div>'+
 '<div class="simple-flow"><div><b>01</b><strong>Send your requirements</strong><span>Service, subject and deadline</span></div><div><b>02</b><strong>Review your quotation</strong><span>Clear scope and terms</span></div><div><b>03</b><strong>Follow your work</strong><span>Updates, files and delivery</span></div></div></section>'+
 '<div class="strip"><section class="section"><div class="section-head"><div><span class="kicker">WHAT WE DO</span><h2>Academic services</h2></div>'+buttonRoute('All services','services')+'</div>'+
 '<div class="service-grid">'+featured.map(academicCard).join('')+'</div></section></div>'+
 '<section class="section photo-story"><div><span class="kicker">RESEARCH, WRITING & ANALYSIS</span><h2>Work with a team that understands academic standards.</h2><p>Support shaped around your subject and your institution’s requirements, coordinated by IPS.</p><div class="cta-row">'+buttonRoute('Get started','register','primary')+buttonRoute('Join as a Specialist','specialist')+'</div></div>'+
 '<img src="'+PHOTO_DESK+'" alt="Real photograph of a research desk with handwritten notes and study materials" loading="eager" decoding="async" referrerpolicy="no-referrer"></section>'+
 '</main>');
}
function services(){
 const cats=[['all','All services'],...state.catalogue.categories.map(x=>[x.id,x.name])];
 const rows=state.catalogue.services.filter(s=>state.category==='all'||s.category===state.category);
 shell('<main class="page wide-page">'+intro('ACADEMIC EXPERTISE','Services for every stage of academic work.',
 'Choose a service to see its scope or request a quotation.')+
 '<div class="category-tabs" role="group" aria-label="Academic service categories">'+cats.map(c=>'<button data-category="'+e(c[0])+'" class="'+(state.category===c[0]?'selected':'')+'">'+e(c[1])+'</button>').join('')+'</div>'+
 '<div class="service-grid">'+rows.map(academicCard).join('')+'</div></main>');
}
function serviceDetail(){
 const s=state.catalogue.services.find(x=>x.id===state.service);
 if(!s)return services();
 shell('<main><header class="detail-hero"><span class="kicker">ACADEMIC SERVICES / '+e(s.category.toUpperCase())+'</span><h1>'+e(s.title)+'</h1><p>'+e(s.description)+'</p>'+
 '<div class="cta-row">'+b('Request a quote for this service','request-service',s.id,'primary')+buttonRoute('Browse services','services')+'</div></header>'+
 '<div class="detail-layout"><div>'+panel('How we can help','Academic guidance tailored to your brief.',
 '<div class="small-list">'+s.deliverables.map(x=>'<div class="bullet">'+e(x)+'</div>').join('')+'</div>')+'</div>'+
 '<div>'+panel('Your brief','Include enough information for an accurate quote.',
 '<div class="small-list">'+s.questions.map(x=>'<div class="bullet">'+e(x)+'</div>').join('')+'</div><div class="action-row">'+b('Get a quotation','request-service',s.id,'primary')+'</div>')+'</div></div></main>');
}
function how(){
 shell('<main class="page wide-page">'+intro('HOW IT WORKS','A straightforward academic service.',
 'Your requirements and all subsequent messages, documents and work updates stay in one IPS case.')+
 '<div class="simple-flow long-flow">'+[
 ['1','Request','Choose your service and send your brief'],
 ['2','Review','IPS agrees scope and sends a quotation'],
 ['3','Commission','You accept and complete the agreed payment when available'],
 ['4','Delivery','We coordinate Specialists, quality assurance and secure release']
 ].map(x=>'<div><b>'+x[0]+'</b><strong>'+e(x[1])+'</strong><span>'+e(x[2])+'</span></div>').join('')+'</div>'+
 '<div class="cta-row">'+buttonRoute('Request a quotation','quote','primary')+buttonRoute('View services','services')+'</div></main>');
}
function privacy(){
 shell('<main class="page policy-page">'+intro('PRIVACY & DATA PROTECTION','Discreet by design.',
 'IPS uses verified accounts, role-limited access and secure company records to protect academic work and correspondence.')+
 panel('How IPS handles information','Only the information needed to provide academic services is requested.',
 '<p>Students and Researchers can use a private username. Specialists provide their real professional identities. Only authorized IPS personnel can access relevant case records.</p>'+
 '<p>Account recovery uses time-limited email links. IPS does not ask you to disclose passwords to staff. Academic documents and messages are visible only to their authorized participants.</p>'+
 '<p>For privacy or data access concerns, use your IPS workspace and its written support channel.</p>')+'</main>');
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
 shell('<main class="page quote-page">'+intro('REQUEST A QUOTATION','Tell us what you need.',
 'Choose an academic service and describe your requirements. IPS will reply in writing.')+
 panel('Your academic request','',
 form(guest?'guest-quote':'student-quote',
 (guest?field('Private username','username','text','Choose a username')+
 field('Email address','email','email','you@example.com'):'')+
 quoteFields(guest)+(guest?privacyCheck:''),'Send request'))+'</main>');
 const el=root.querySelector('select[name=serviceId]');if(el&&state.service)el.value=state.service;
}
function auth(title,subtitle,formContent,extras=''){
 shell('<main class="auth">'+intro('SECURE IPS ACADEMIC ACCESS',title,subtitle)+flash()+
 panel('Secure sign-in','',formContent+extras)+'</main>');
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
 state.page='register';state.service='';state.account=null;state.registerRole=role;
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
 if(a.role==='student')return [['overview','Overview'],['inbox','Inbox & messages'],
  ['quotes','My quotations'],['commissions','My academic work'],['support','Support'],['profile','Account']];
 if(a.role==='specialist')return [['overview','My work'],['inbox','Inbox & messages'],
  ['commissions','Assignments & files'],['support','Support'],['profile','Profile']];
 if(a.role==='root')return [['overview','Command centre'],['inbox','Inbox & messages'],
  ['quotes','Enquiries'],['students','Students'],['specialists','Specialists'],
  ['commissions','Academic jobs'],['root-students','Student workspace'],
  ['root-specialists','Specialist workspace'],['workforce','Team & managers'],
  ['finance','Finance'],['audit','Audit']];
 const t=[['overview','Overview'],['inbox','Inbox & messages'],['queues','My queue']];
 if(a.department==='client_relations')t.push(['quotes','Enquiries'],['students','Students'],['support','Support']);
 if(a.department==='academic_delivery')t.push(['commissions','Academic jobs']);
 if(a.department==='specialist_network')t.push(['specialists','Specialists']);
 if(a.department==='quality_assurance')t.push(['quality','Quality review']);
 if(a.department==='finance')t.push(['finance','Finance']);
 if(a.department==='governance')t.push(['audit','Audit']);
 if(a.role==='manager')t.push(['workforce','My team']);
 return t;
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
 const oversight=state.rootLens?'<div class="root-assist"><div><span class="kicker">NYORO ROOT ADMINISTRATION / ASSISTED WORKSPACE</span><strong>Currently viewing '+e(a.role==='student'?'Student / Researcher':'Academic Specialist')+' · '+e(a.username||a.name)+'</strong><p>Operating under Nyoro Root authority. Every assisted action is audited.</p></div><div class="root-assist-controls"><label class="field">Switch '+e(a.role==='student'?'Student':'Specialist')+' without another login<select data-root-target>'+state.rootLens.directory.map(p=>'<option value="'+e(p.id)+'"'+(p.id===a.id?' selected':'')+'>'+e(p.username||p.name)+' · '+e(p.id)+'</option>').join('')+'</select></label>'+b('Return to Nyoro Root','root-lens-exit','','primary')+'</div></div>':'';
 shell('<div class="workspace"><aside class="sidebar"><div class="nav-label">IPS ACADEMIC COMPANY</div>'+tabs.map(t=>navData(t[0],t[1],state.tab)).join('')+
 '</aside>'+
 '<main class="workmain">'+oversight+'<div class="toolbar">'+b('← Back','back','','back-btn')+'<span class="subtle">'+e(a.role==='root'?'ROOT ADMIN':a.role==='student'?'STUDENT WORKSPACE':a.role==='specialist'?'SPECIALIST WORKSPACE':'IPS TEAM')+' / '+e(state.tab.replaceAll('-',' '))+'</span></div><div class="work-title"><span class="kicker">IPS ACADEMIC SERVICES / '+e(state.tab.toUpperCase())+'</span><h1>'+e(title)+'</h1><p>'+e(a.role==='root'?'Lead academic service operations, qualified Specialists, communications, quality assurance and responsible departments.':
 a.role==='student'?'Your confidential academic support, reviewed quotations and secure work history.':
 a.role==='specialist'?'Your professional academic assignments, approvals, submissions and IPS coordination.':
 'Manage real academic-service responsibilities and clients within your approved authority.')+'</p></div>'+flash()+
 '<div id="workbody" aria-live="polite"><div class="boot">Loading real academic company records…</div></div></main></div>');
 void loadTab();
}
const realActivityChart=metrics=>{
 const bars=[['Enquiries',metrics.enquiries],['Commissions',metrics.academicCommissions],['Support',metrics.support],['Alerts',metrics.alerts]].map(([label,count])=>[label,Math.max(0,Number(count)||0)]);
 const max=Math.max(1,...bars.map(x=>x[1]));
 return '<section class="panel activity-visual" aria-label="Real academic operations visualization"><span class="kicker">LIVE COMPANY ACTIVITY</span><h2>Academic operations at a glance</h2><p>Recorded counts from the actual authenticated IPS database; no fabricated performance statistics.</p>'+
 '<svg viewBox="0 0 680 224" role="img" aria-label="Bar chart of academic enquiries, commissions, support cases and private alerts">'+
 '<g stroke="#496477" stroke-width="1"><path d="M35 40H650 M35 85H650 M35 130H650 M35 175H650"/></g>'+
 bars.map(([label,count],i)=>{const x=80+i*158,h=Math.max(2,Math.round(130*count/max)),y=175-h;
 return '<rect x="'+x+'" y="'+y+'" width="61" height="'+h+'" rx="6" fill="'+(i%2?'#9fc9c1':'#d6b47b')+'"/>'+
 '<text x="'+(x+30)+'" y="'+(y-9)+'" text-anchor="middle" fill="#eeddbb" font-size="16" font-weight="700">'+count+'</text>'+
 '<text x="'+(x+30)+'" y="202" text-anchor="middle" fill="#d7e4e7" font-size="12">'+label+'</text>'}).join('')+'</svg></section>';
};
const kpi=(name,count,sub)=>'<div class="metric"><span>'+e(name)+'</span><strong>'+e(count)+'</strong><small>'+e(sub)+'</small></div>';
const record=(heading,desc,id,stage,buttons='')=>'<article class="record"><div><h3>'+e(heading)+'</h3><p>'+e(short(desc))+'</p><small class="subtle">'+e(id)+'</small></div><aside>'+stat(stage)+buttons+'</aside></article>';
async function loadTab(){
 const a=state.rootLens?.account||state.account,tab=state.tab;
 const target=root.querySelector('#workbody');if(!target)return;
 const rootAssisted=!!state.rootLens,canSimulate=!rootAssisted||state.isEvaluation;
 try{
 let html='';
 if(tab==='overview'){
  const d=await api('/academic/dashboard'),m=d.metrics;
  html='<div class="metrics">'+kpi('Enquiries',m.enquiries,'Academic requests')+
   kpi('Academic jobs',m.academicCommissions,'Jobs you can access')+
   kpi('Support',m.support,'Written support')+
   kpi('Updates',m.alerts,'Unread alerts')+'</div>'+
   (a.role==='root'?realActivityChart(m):'')+
   '<div class="ops-grid">'+
   panel(a.role==='student'?'Your next step':a.role==='specialist'?'Your assignments':'Work that needs attention','',
    '<div class="case-actions">'+(a.role==='student'?buttonRoute('Request a quote','quote','primary')+
      b('Open my academic work','tab-commissions'):
     a.role==='specialist'?b('View assignments & files','tab-commissions','','primary')+
      b('Open inbox','tab-inbox'):
      b('Open inbox','tab-inbox','','primary')+
      b('Academic jobs','tab-commissions'))+'</div>')+
   panel('Messages & files','Find academic conversations, uploaded documents and delivery in the relevant job.',
    '<div class="case-actions">'+b('Go to inbox','tab-inbox','','primary')+
    b('Open academic jobs','tab-commissions')+'</div>')+
   (a.role==='root'?panel('People & staffing','Students and Specialists are managed separately.',
    '<div class="case-actions">'+b('Manage Students','tab-students')+
     b('Manage Specialists','tab-specialists')+b('Team','tab-workforce')+'</div>'):'')+'</div>';
 }else if(tab==='inbox'){
  const d=await api('/operations/inbox');
  html=panel('Inbox & conversations','Academic enquiries, job messages, support and direct company correspondence.',
   d.inbox.length?'<div class="small-list">'+d.inbox.slice(0,120).map(x=>
    '<article class="inbox-row"><div><span class="kicker">'+e(x.type)+' · '+e(x.service||'IPS')+'</span>'+
    '<h3>'+e(x.subject||'Academic case')+'</h3><p>'+e(x.id)+' · '+date(x.updatedAt)+'</p></div>'+
    '<div class="case-actions">'+stat(x.status)+b('Open','inbox-open',x.type+'::'+x.id,'primary')+'</div></article>').join('')+'</div>':
   empty('Nothing waiting in your IPS inbox. New written correspondence will appear here.'))+
   (state.opened?.startsWith('DM-')?await dmDetail(state.opened,a):'');
 }else if(tab==='queues'){
  const d=await api('/administration/queues');
  html=panel('Department queue','Only tasks needing an IPS response appear here.',
   d.queues.length?'<div class="small-list">'+d.queues.map(q=>
    '<section class="panel"><h3>'+e(q.name)+' · '+q.count+'</h3>'+
    (q.items.length?q.items.map(x=>record(x.service+' · '+x.subject,'',x.id,x.stage,
      b('Open work','queue-open',x.id))).join(''):empty('Nothing waiting in this queue.'))+'</section>').join('')+'</div>':empty('No pending tasks for this department.'));
 }else if(tab==='quotes'){
  const d=await api('/academic/quotes');
  html=(a.role==='student'?panel('New academic request','',
   '<div class="case-actions">'+(canSimulate?buttonRoute('Request a quotation','quote','primary'):'')+
   (!rootAssisted?form('claim-quote',field('Existing enquiry reference','reference','text','IPS-Q-…'),'Link existing enquiry'):'')+
   '</div>'):'')+
   panel(a.role==='student'?'Your quotations':'Academic enquiries','Review scope, quotation and messages in one record.',
    d.quotes.length?'<div class="small-list">'+d.quotes.map(q=>
     record(q.subject+' · '+q.serviceName,q.requirements,q.id,q.status,
      (a.role==='student'&&q.status==='offered'&&canSimulate?
       b('Accept quotation','quote-accept',q.id,'primary')+b('Decline','quote-decline',q.id):
       ['root','manager'].includes(a.role)&&q.status==='received'?
       b('Review','scope-form',q.id):['root','manager'].includes(a.role)&&q.status==='scoped'?
       b('Send quotation','offer-form',q.id):'')+
      b('Open enquiry & messages','quote-detail',q.id))).join('')+'</div>':
     empty('No academic enquiries yet.'))+
    (state.opened?await quoteDetail(d.quotes.find(q=>q.id===state.opened),a):'');
 }else if(tab==='commissions'||tab==='quality'){
  const d=await api('/academic/commissions');
  const items=tab==='quality'?d.commissions.filter(x=>['qa_pending','correction_requested','client_delivery'].includes(x.status)):d.commissions;
  html=panel(tab==='quality'?'Quality review':'Academic jobs',
   'Open any job to manage its messages, instructions, assigned work and files.',
   items.length?'<div class="small-list">'+items.map(p=>record(
     p.subject+' · '+p.serviceName,
     'Updated '+date(p.updatedAt),p.id,p.status,
     b('Open job','commission-open',p.id,'primary'))).join('')+'</div>':
     empty('No academic jobs in this view.'))+
   (state.opened?await commissionDetail(items.find(p=>p.id===state.opened),a):'');
 }else if(['students','specialists','root-students','root-specialists','workforce'].includes(tab)){
  const d=await api('/administration/people');
  const role=tab==='root-students'||tab==='students'?'student':
    tab==='root-specialists'||tab==='specialists'?'specialist':'employee';
  const people=d.people.filter(p=>role==='employee'?['manager','staff'].includes(p.role):p.role===role);
  state.rootDirectory=people;
  const rootLensList=tab==='root-students'||tab==='root-specialists';
  const invite=['root','manager'].includes(a.role)&&tab==='workforce'?
   panel(a.role==='root'?'Create a department manager':'Invite department staff','',
    form('staff-invite',field('Full professional name','name')+
    field('Verified work email','email','email')+
    (a.role==='root'?options('Department','department',state.catalogue.departments.map(x=>[x.id,x.name])):''),
    'Email invitation')):'';
  const labels={student:'Students / Researchers',specialist:'Academic Specialists',employee:'Managers & staff'};
  html=invite+panel(rootLensList?'Select a workspace':labels[role],
   rootLensList?'Open the actual workspace under Nyoro’s accountable Root session.':'Separate people directories with straightforward management.',
   '<div class="directory-toolbar"><label class="field">Search<input type="search" data-directory-search placeholder="Name, username or email" autocomplete="off"></label>'+
   '<label class="field">Status<select data-directory-status><option value="all">All statuses</option>'+
   '<option value="active">Active</option><option value="pending_review">Pending approval</option>'+
   '<option value="suspended">Suspended</option></select></label></div>'+
   (people.length?'<div class="table-wrap"><table class="table directory-table"><thead><tr><th>Account</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+
   people.map(p=>'<tr data-directory-row data-status="'+e(p.status)+'" data-search="'+e((p.username||p.name||'')+' '+p.email)+'"><td><b>'+e(p.username||p.name||'Private account')+'</b><small>'+e(p.email)+'</small></td>'+
   '<td>'+e(p.role==='student'?'Student / Researcher':p.role==='specialist'?'Specialist':p.role)+'</td>'+
   '<td>'+stat(p.verified?p.status:'unverified')+'</td><td><div class="actions">'+
   (a.role==='root'&&['student','specialist'].includes(p.role)&&p.verified&&p.status==='active'?
    b('Open workspace','root-lens-open',p.id,'small primary'):'')+
   (a.role==='root'?b('Message','person-message',p.id,'small'):'')+
   (!rootLensList&&canRecover(a,p)?b('Send reset link','person-recover',p.id,'small'):'')+
   (!rootLensList&&canApprove(a,p)?b('Approve','person-approve',p.id,'small'):'')+
   (!rootLensList&&canSuspend(a,p)?b('Suspend','person-suspend',p.id,'small danger'):'')+
   (!rootLensList&&p.status==='suspended'&&a.role==='root'?b('Reactivate','person-reactivate',p.id,'small'):'')+
   '</div></td></tr>').join('')+'</tbody></table></div>':empty('No accounts found.')))+
   (a.role==='root'&&state.opened?.startsWith('DMTO:')?directCompose(state.opened.slice(5),people):'');
 }else if(tab==='support'){
  const d=await api('/support');
  html=(['student','specialist'].includes(a.role)&&canSimulate?
   panel('Ask IPS for help','',
   form('support',field('Subject','subject')+textarea('Message','message','What do you need help with?'),'Send message')):'')+
   panel('Support conversations','',d.tickets.length?'<div class="small-list">'+d.tickets.map(t=>
    record(t.subject,t.replies?.at(-1)?.message,t.id,t.status,b('Open conversation','support-open',t.id))).join('')+'</div>':
    empty('No support cases yet.'))+
   (state.opened?supportDetail(d.tickets.find(t=>t.id===state.opened)):'');
 }else if(tab==='profile'){
  html=panel('Account & preferences','',
   '<p><strong>'+e(a.username||a.name)+'</strong> · '+e(a.email)+'</p>'+
   (rootAssisted?'<p>Nyoro is operating this workspace. Passwords and personal preferences remain account-holder controlled.</p>':
   form('contact-preference',options('Reply method','contactPreference',
    [['workspace','IPS workspace'],['email','Email'],['telegram','Telegram']])+
     field('Telegram username (optional)','telegram','text','@username',false),'Save changes')+
   '<div class="case-actions">'+buttonRoute('Email me a password reset link','recover')+'</div>'));
 }else if(tab==='finance'){
  const d=await api('/administration/queues');
  const q=d.queues.find(x=>x.department==='finance');
  html=panel('Finance readiness','Payment provider integration is not enabled in this evaluation.',
   q?'<p>'+e(q.count)+' accepted academic cases await the verified payment gate.</p>':
   empty('No outstanding finance cases.'));
 }else if(tab==='audit'){
  const d=await api('/administration/audit');
  html=panel('Audit trail','Every company action, including Root intervention, is attributable.',
   d.events.length?'<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Role</th><th>Action</th><th>Case / account</th></tr></thead><tbody>'+
   d.events.map(x=>'<tr><td>'+date(x.at)+'</td><td>'+e(x.actorRole)+'</td><td>'+e(x.action.replaceAll('_',' '))+'</td><td>'+e(x.ref)+'</td></tr>').join('')+'</tbody></table></div>':
   empty('No events recorded.'));
 }else if(tab==='notifications'){
  const d=await api('/notifications');
  html=panel('Updates','',d.notifications.length?'<div class="small-list">'+d.notifications.map(n=>
   record(n.message,date(n.createdAt),n.id,n.kind,n.read||rootAssisted?'':b('Mark read','notification-read',n.id))).join('')+'</div>':
   empty('No updates.'));
 }
 const current=root.querySelector('#workbody');if(current)current.innerHTML=html;
 }catch(err){const current=root.querySelector('#workbody');if(current)current.innerHTML='<div class="notice error" role="alert">'+e(err.message)+'</div>'}
}
function directCompose(id,people){
 const p=people.find(x=>x.id===id);if(!p)return '';
 return '<div class="mt">'+panel('Write to '+(p.username||p.name),'Send a private IPS message or academic document.',
 form('direct-message','<input type="hidden" name="recipientId" value="'+e(id)+'">'+
 textarea('Message','body','Your message to this account'),'Send message')+
 form('direct-file','<input type="hidden" name="recipientId" value="'+e(id)+'">'+
 field('Attach PDF, DOCX or TXT (5 MB max)','upload','file','','true'),
 'Send private document'))+'</div>';
}
async function dmDetail(id,a){
 const all=await api('/operations/direct-message');
 const m=all.messages.find(x=>x.id===id);
 if(!m)return '';
 const thread=await api('/operations/direct-message/'+encodeURIComponent(id)+'/thread');
 return '<div class="mt">'+panel('Private IPS conversation','',
  '<div class="messages">'+thread.messages.map(t=>'<div class="message"><small>'+
   e(t.fromRole||'IPS')+' · '+date(t.createdAt)+'</small><p>'+e(t.body||'')+'</p>'+
   (t.attachmentId?'<p><a href="/api/operations/direct-file/'+e(t.attachmentId)+'" download>Download attached document</a></p>':'')+
   '</div>').join('')+'</div>'+
   form('direct-reply','<input type="hidden" name="messageId" value="'+e(id)+'">'+
    textarea('Reply','body','Write your reply'),'Send reply'))+'</div>';
}
function canRecover(a,p){return p.verified&&p.status==='active'&&
 (a.role==='root'||(a.role==='manager'&&p.role==='staff'&&p.managerId===a.id)||
 (['manager','staff'].includes(a.role)&&
 ((a.department==='client_relations'&&p.role==='student')||(a.department==='specialist_network'&&p.role==='specialist'))))}
function canApprove(a,p){return p.role==='specialist'&&p.status==='pending_review'&&p.verified&&
 (a.role==='root'||(a.role==='manager'&&a.department==='specialist_network'))}
function canSuspend(a,p){return p.status==='active'&&(a.role==='root'||(a.role==='manager'&&p.role==='staff'&&p.managerId===a.id))}
async function quoteDetail(q,a){
 if(!q)return '';
 const d=await api('/academic/quotes/'+encodeURIComponent(q.id)+'/messages');
 const manager=['root','manager','staff'].includes(a.role);
 const thread='<div class="messages">'+(d.messages.length?d.messages.map(m=>
  '<article class="message"><small>'+e(m.actorRole==='root'?'Nyoro · IPS':m.actorRole==='student'?'Student / Researcher':'IPS team')+
  ' · '+date(m.createdAt)+'</small><p>'+e(m.body)+'</p></article>').join(''):
  empty('No messages yet. Your reply will appear here.'))+'</div>';
 const chat=form('quote-message',
  '<input type="hidden" name="quoteId" value="'+e(q.id)+'">'+
  (manager?options('Recipient','audience',[['student','Student / Researcher'],['internal','Internal IPS note']]):'')+
  textarea('Write a reply','body','Ask a question or reply in writing'),'Send message');
 const summary='<div class="case-summary"><div class="kicker">ENQUIRY / '+e(q.id)+'</div><h3>'+
   e(q.subject)+'</h3><p>'+e(q.requirements)+'</p><div class="separator"></div>'+
   '<div class="case-flow"><span>'+e(q.academicLevel)+'</span><span>'+e(q.serviceName)+'</span>'+
   stat(q.status)+'</div><p><strong>Deadline:</strong> '+e(q.deadline||'To be agreed')+'</p>'+
   (q.scopeNote?'<p><strong>Reviewed scope:</strong> '+e(q.scopeNote)+'</p>':'')+
   (q.deliverables?'<p><strong>Deliverables:</strong> '+e(q.deliverables)+'</p>':'')+
   (Number.isInteger(q.priceMinor)?'<p><strong>Written quotation:</strong> '+price(q.priceMinor)+'</p>':'')+
   (q.terms?'<p><strong>Terms:</strong> '+e(q.terms)+'</p>':'')+
   '<div class="case-actions">'+b('Close enquiry','close-case')+'</div></div>';
 return '<section class="mt"><div class="section-head"><h2>Enquiry & written conversation</h2></div>'+
 '<div class="case-layout">'+summary+'<section class="case-chat"><h3>Messages</h3>'+thread+chat+'</section></div></section>';
}
async function commissionDetail(p,a){
 if(!p)return '';
 const [msgData,fileData]=await Promise.all([
  api('/academic/commissions/'+encodeURIComponent(p.id)+'/messages'),
  api('/operations/'+encodeURIComponent(p.id)+'/files')]);
 const rootFileData=state.rootLens&&state.account?.role==='root'?await api('/operations/'+encodeURIComponent(p.id)+'/files',{operator:true}):null;
 const isRoot=state.account?.role==='root';
 const manager=isRoot||a.role==='manager';
 const specialist=a.role==='specialist'&&p.specialistId===a.id;
 const student=a.role==='student'&&p.studentId===a.id;
 const assisted=!!state.rootLens,canSimulate=!assisted||state.isEvaluation;
 let actions='';
 if(manager&&p.status==='ready_for_assignment'){
  const avail=await api('/operations/available-specialists?service='+encodeURIComponent(p.serviceId));
  actions+=panel('Assign an academic Specialist','',
   avail.specialists.length?form('assign',
    '<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
    options('Approved Specialist','specialistId',avail.specialists.map(s=>[s.id,s.name])),
    'Assign Specialist'):empty('No approved Specialist is currently available for this service. Root can take responsibility directly.'))}
 if(manager&&p.status==='qa_pending')
  actions+=panel('Academic quality review','Approve or request corrections before Student delivery.',
   form('quality','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
    options('Decision','decision',[['approve','Approve for release'],['return_for_correction','Request corrections']])+
    textarea('Review note','note','Specify the results of your academic review'),
    'Record QA decision'));
 if(student&&canSimulate&&p.status==='client_delivery')
  actions+=panel('Review delivered work','The approved file is ready to download.',
   form('student-decision','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
    options('Decision','decision',[['accept',assisted?'Simulate Student acceptance':'Accept completed support'],
     ['request_revision',assisted?'Simulate revision request':'Request revision']])+
    textarea('Revision details, if needed','note','What needs adjusting?',false),
    assisted?'Record fictional Student simulation':'Send my decision'));
 const fileRows=(fileData.files||[]).map(f=>'<article class="file-item"><div><strong>'+e(f.filename)+
   '</strong><small>'+e((f.purpose||'academic file').replaceAll('_',' '))+' · Uploaded '+date(f.createdAt)+
   ' · '+e(f.sha256?.slice(0,12)||'')+'</small></div>'+
   '<a href="/api/academic/files/'+encodeURIComponent(f.id)+'" download>Download ↓</a></article>').join('');
 const canDeliver=(isRoot||specialist&&canSimulate)&&['specialist_assigned','root_in_progress','correction_requested','student_revision_requested'].includes(p.status);
 const canReference=isRoot||student||specialist;
 const purposes=canDeliver&&canReference?[['reference','Supporting document'],['deliverable','Deliverable for QA']]:
   canDeliver?[['deliverable','Deliverable for QA']]:[['reference','Supporting document']];
 const upload=(canReference||canDeliver)?panel('Upload a document','PDF, DOCX or TXT · maximum 5 MB per file.',
  form('case-upload','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
   options('File type','purpose',purposes)+
   field('Choose file','upload','file','','true'),'Upload document')):'';
 const timeline=['Academic scope and quotation','Commission/payment verification',
  p.managedBy?'Root work allocation':'Specialist assignment',
  'Academic quality assurance','Secure final delivery'];
 const current=(p.milestones||[]).findIndex(m=>m.status==='pending'||m.status==='blocked');
 const flow='<div class="case-flow">'+timeline.map((name,i)=>
  '<span class="'+(current===i?'current':'')+'">'+e(name.split(' ').slice(0,3).join(' '))+'</span>').join('')+'</div>';
 const conversation='<div class="messages">'+(msgData.messages.length?msgData.messages.map(m=>
  '<article class="message"><small>'+e(m.actorRole==='root'?'Nyoro · IPS':m.actorRole==='student'?'Student / Researcher':
    m.actorRole==='specialist'?'Academic Specialist':'IPS team')+' · '+e(m.audience)+
    ' · '+date(m.createdAt)+'</small><p>'+e(m.body)+'</p></article>').join(''):
    empty('No correspondence yet. Start with a short message.'))+'</div>'+
  form('commission-message','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
   ((manager||assisted)?options('Send to','audience',
      [['student','Student / Researcher'],['specialist','Assigned Specialist'],['shared','Both']]):'')+
   textarea('Message','body','Write a message about this job'),'Send message');
 if(isRoot){
  const takeover=['ready_for_assignment','specialist_assigned','root_in_progress','correction_requested','student_revision_requested'].includes(p.status);
  if(takeover)actions+=panel('Root takeover','Manage the assignment directly if no Specialist is available.',
   form('root-takeover','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
     textarea('Reason','reason','Why is Root taking responsibility?'),'Take responsibility'));
  if(p.status==='root_in_progress')
   actions+=panel('Private outsourcing','Nyoro-only sourcing details. Other IPS accounts cannot view the provider information.',
    form('root-outsourcing','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
     field('External provider reference','provider','text','Private name or reference')+
     textarea('Private brief','instructions','Outsourced work scope and instructions'),
     'Record private outsourcing'));
 }
 const overview='<div class="case-summary"><span class="kicker">ACADEMIC JOB / '+e(p.id)+'</span>'+
  '<h3>'+e(p.subject)+'</h3><p>'+e(p.requirements)+'</p>'+
  '<div class="case-actions">'+stat(p.status)+
   '<span class="pill">'+e(p.serviceName)+'</span></div>'+flow+
  '<p><strong>Delivery:</strong> '+e(p.deadline||'As agreed in your quotation')+'</p>'+
  '<p><strong>Company responsibility:</strong> '+e(p.managedBy?'Nyoro · IPS Root':
    p.specialistId?'Assigned IPS Specialist':'IPS Academic Delivery')+'</p>'+
  '<div class="case-actions">'+b('Close job','close-case')+
   b('Open inbox','tab-inbox')+'</div></div>';
 return '<section class="mt"><div class="section-head"><div><span class="kicker">SINGLE JOB WORKSPACE</span>'+
  '<h2>Work, messages & delivery</h2></div></div>'+
  '<div class="case-layout"><div>'+overview+
   panel('Files & delivery','All permitted supporting files and released work are here.',
    '<div class="file-tray">'+(fileRows||empty('No documents yet. Upload a file below.'))+'</div>')+
   (rootFileData?panel('Root-only documents','Drafts, QA-rejected versions and internal files visible only to Nyoro.',
    '<div class="file-tray">'+rootFileData.files.filter(f=>!fileData.files.some(x=>x.id===f.id)).map(f=>
     '<article class="file-item"><strong>'+e(f.filename)+'</strong><a download href="/api/academic/files/'+e(f.id)+'">Download as Root ↓</a></article>').join('')+'</div>'):'')+
   upload+actions+'</div><section class="case-chat"><h3>Job messages</h3>'+
   '<p>Communication stays attached to the academic job.</p>'+conversation+'</section></div></section>';
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
 if(state.account&&!['quote','services','service','how','privacy','recover'].includes(state.page))return work();
 const params=new URLSearchParams(location.hash.slice(1));
 for(const k of ['verify','recover','invite','guestconfirm'])if(params.has(k)){tokenForm(k);return}
 switch(state.page){case 'services':services();break;case 'service':serviceDetail();break;
 case 'how':how();break;case 'privacy':privacy();break;case 'quote':quote();break;
 case 'login':login();break;case 'register':register(state.registerRole==='specialist'?'specialist':'student');break;
 case 'specialist':register('specialist');break;case 'recovery':recovery();break;
 default:home();}
}
async function filePayload(formNode){
 const file=formNode.querySelector('input[name=upload]')?.files?.[0];
 if(!file)throw Error('Choose an academic PDF, DOCX or TXT file.');
 if(file.size<12||file.size>5*1024*1024)throw Error('The file must be smaller than 5 MB.');
 const ext=file.name.toLowerCase().split('.').pop();
 const mime={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt:'text/plain'}[ext];
 if(!mime)throw Error('Only PDF, DOCX and TXT documents can be uploaded.');
 const contents=await new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);
  reader.onerror=()=>reject(Error('Could not read the selected file.'));reader.readAsDataURL(file);
 });
 return {filename:file.name,mime,data:contents};
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
 if(name==='recovery'){await api('/auth/recovery/request',{method:'POST',body:data});state.page=state.account?'workspace':'login';if(state.account)state.tab='profile';return 'A private recovery link has been requested immediately. Check the registered mailbox.'}
 if(name==='recover'||name==='invite'){if(data.password!==data.confirmPassword)throw Error('Passwords do not match.');
  const r=await api(name==='recover'?'/auth/recovery/complete':'/auth/invitation/accept',{method:'POST',body:data});location.hash='';if(r.account){state.account=r.account;state.page='workspace';state.tab='overview'}else state.page='login';return 'Your private IPS account credentials were updated successfully.'}
 if(name==='quote-message'){
  await api('/academic/quotes/'+encodeURIComponent(data.quoteId)+'/messages',
   {method:'POST',body:{body:data.body,audience:data.audience||'student'}});
  return 'Message added to the academic enquiry.';
 }
 if(name==='case-upload'){
  const payload=await filePayload(formNode);
  const operator=!!state.rootLens&&!state.isEvaluation;
  const result=await api('/operations/'+encodeURIComponent(data.commissionId)+'/upload',
   {method:'POST',operator,body:{...payload,purpose:data.purpose}});
  return result.needsQa?'Deliverable uploaded. IPS quality review is next.':'Reference uploaded and available to authorized participants.';
 }
 if(name==='root-takeover'){
  await api('/operations/'+encodeURIComponent(data.commissionId)+'/takeover',
   {method:'POST',operator:true,body:{reason:data.reason}});
  return 'Nyoro now manages this academic job directly. This action is recorded in the audit trail.';
 }
 if(name==='root-outsourcing'){
  await api('/operations/'+encodeURIComponent(data.commissionId)+'/outsourcing',
   {method:'POST',operator:true,body:{provider:data.provider,instructions:data.instructions}});
  return 'Root-only external sourcing saved. IPS remains responsible for academic QA and client delivery.';
 }
 if(name==='direct-message'){
  await api('/operations/direct-message',{method:'POST',operator:true,body:data});
  return 'Private message sent to this IPS account.';
 }
 if(name==='direct-file'){
  const payload=await filePayload(formNode);
  await api('/operations/direct-message/file',
   {method:'POST',operator:true,body:{...payload,recipientId:data.recipientId}});
  return 'Document sent securely to this account’s IPS inbox.';
 }
 if(name==='direct-reply'){
  await api('/operations/direct-message/'+encodeURIComponent(data.messageId)+'/reply',
   {method:'POST',operator:true,body:{body:data.body}});
  return 'Private reply recorded.';
 }
 if(name==='claim-quote'){await api('/academic/quotes/claim',{method:'POST',body:data});return 'Your previously verified guest academic enquiry is now attached to your account.'}
 if(name==='staff-invite'){await api('/administration/invite',{method:'POST',body:data});return 'IPS sent a secure department invitation.'}
 if(name==='scope'){await api('/academic/quotes/'+encodeURIComponent(id)+'/scope',{method:'POST',operator:state.account?.role==='root',body:data});return 'Academic scope decision has been recorded.'}
 if(name==='offer'){data.priceMinor=Math.round(Number(data.pricePLN)*100);delete data.pricePLN;
  await api('/academic/quotes/'+encodeURIComponent(id)+'/offer',{method:'POST',operator:state.account?.role==='root',body:data});return 'Reviewed academic quotation issued in writing.'}
 if(name==='assign'){await api('/academic/commissions/'+encodeURIComponent(id)+'/assign',{method:'POST',operator:state.account?.role==='root',body:{specialistId:data.specialistId}});return 'Approved academic Specialist assignment recorded.'}
 if(name==='submit-academic'){
  const file=formNode.querySelector('input[name=upload]')?.files?.[0];
  if(!file)throw Error('Select a real academic deliverable.');
  if(file.size>1048576)throw Error('Academic file is over the current 1 MB evaluation limit.');
  const encoded=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result).split(',')[1]);rd.onerror=()=>reject(Error('Cannot read academic file.'));rd.readAsDataURL(file)});
  await api('/academic/commissions/'+encodeURIComponent(id)+'/submission',{method:'POST',body:{filename:file.name,mime:file.type,data:encoded}});
  return 'Academic deliverable submitted to independent IPS QA.';
 }
 if(name==='quality'){await api('/academic/commissions/'+encodeURIComponent(id)+'/quality',{method:'POST',operator:state.account?.role==='root',body:data});return 'Academic QA decision recorded and responsible parties notified.'}
 if(name==='student-decision'){await api('/academic/commissions/'+encodeURIComponent(id)+'/student-decision',{method:'POST',body:data});return 'Your academic delivery decision is saved.'}
 if(name==='commission-message'){await api('/academic/commissions/'+encodeURIComponent(id)+'/messages',{method:'POST',body:data});return 'Message sent and attached to this academic job.'}
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
 if(state.account){render()}else{const msg=state.message,err=state.error;render();const container=root.querySelector('.page-intro')||root.querySelector('.hero')||root.querySelector('.auth .page-intro');if(container&&!root.querySelector('.notice.error, .notice.success'))container.insertAdjacentHTML('afterend',err?'<div class="notice error" role="alert">'+e(err)+'</div>':'<div class="notice success" role="status">'+e(msg)+'</div>')}
});
function filterDirectory(){
 const find=(root.querySelector('[data-directory-search]')?.value||'').trim().toLowerCase();
 const status=root.querySelector('[data-directory-status]')?.value||'all';
 for(const item of root.querySelectorAll('[data-directory-row]')){
  item.hidden=!((item.dataset.search||'').toLowerCase().includes(find)&&
   (status==='all'||item.dataset.status===status));
 }
}
document.addEventListener('input',ev=>{if(ev.target.matches('[data-directory-search]'))filterDirectory()});
document.addEventListener('change',async ev=>{
 if(ev.target.matches('[data-directory-status]')){filterDirectory();return}
 const select=ev.target.closest('select[data-root-target]');
 if(!select||!state.rootLens||state.account?.role!=='root')return;
 try{await openRootLens(select.value)}catch(err){state.error=err.message;render()}
});
document.addEventListener('click',async ev=>{
 const route=ev.target.closest('[data-nav]'),tab=ev.target.closest('[data-tab]'),action=ev.target.closest('[data-action]'),category=ev.target.closest('[data-category]');
 if(category){remember();state.category=category.dataset.category;services();return}
 if(route){ev.preventDefault();remember();const dest=route.dataset.nav;state.error='';state.message='';state.opened='';
  if(state.account&&['home','services','quote','how','privacy'].includes(dest)){if(state.rootLens&&dest==='quote'&&!state.isEvaluation){state.error='Real client quote authorization must come from the account holder.';render();return}state.page=dest==='home'?'services':dest;render();return}
  state.page=dest;state.registerRole=dest==='specialist'?'specialist':dest==='register'?'student':state.registerRole;render();return}
 if(tab){remember();state.tab=tab.dataset.tab;state.opened='';state.message='';state.error='';render();return}
 if(!action||state.busy)return;const act=action.dataset.action,id=action.dataset.id;state.error='';state.message='';
 if(act==='back'){if(state.backStack.length)history.back();else goBack();return}
 if(act==='root-lens-exit'){remember();state.rootLens=null;state.rootDirectory=[];state.page='workspace';state.tab='overview';state.opened='';history.replaceState(null,'','/root');render();return}
 if(act==='root-lens-open'){remember();try{await openRootLens(id)}catch(err){state.error=err.message;render()}return}
 if(act==='close-case'){state.opened='';render();return}
 if(['tab-inbox','tab-students','tab-specialists','tab-workforce'].includes(act)){
  remember();state.tab=act.slice(4);state.opened='';render();return}
 if(act==='inbox-open'||act==='queue-open'){
  remember();
  const parts=act==='inbox-open'?id.split('::'): [id.startsWith('IPS-Q')?'quote':id.startsWith('IPS-S')?'support':'commission',id];
  const kind=parts[0];state.opened=parts.slice(1).join('::');
  state.tab=kind==='quote'?'quotes':kind==='support'?'support':kind==='direct'?'inbox':'commissions';
  render();return;
 }
 if(act==='person-message'){remember();state.opened='DMTO:'+id;render();return}
if(act==='service'){remember();state.service=id;state.page='service';serviceDetail();return}
 if(act==='request-service'){remember();state.service=id;state.page='quote';quote();return}
 if(['tab-commissions','tab-queues','tab-root-students','tab-root-specialists'].includes(act)){remember();state.tab=act.slice(4);state.opened='';state.message='';state.error='';render();return}
 if(act==='quote-detail'||act==='commission-open'||act==='support-open'){remember();state.opened=state.opened===id?'':id;render();return}
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
  if(act==='logout'){await api('/auth/logout',{method:'POST'});state.backStack=[];state.account=null;state.rootLens=null;state.page=state.rootEntry?'root-login':'home';state.opened='';state.tab='overview';}
  else if(['quote-accept','quote-decline'].includes(act)){
   const decision=act==='quote-accept'?'accept':'decline';
   const r=await api('/academic/quotes/'+encodeURIComponent(id)+'/decision',{method:'POST',body:{decision}});
   state.message=decision==='accept'?'Your quotation is accepted. IPS will tell you when verified payment commissioning becomes available.':'Your quotation has been declined.';}
  else if(['person-recover','person-approve','person-suspend','person-reactivate'].includes(act)){
   if(act==='person-recover'){await api('/administration/people/'+encodeURIComponent(id)+'/send-recovery',{method:'POST'});state.message='IPS emailed a secure recovery link to the account owner.'}
   else{const decision=act==='person-approve'?'approve_specialist':act==='person-reactivate'?'reactivate':'suspend';await api('/administration/people/'+encodeURIComponent(id)+'/decision',{method:'POST',body:{decision}});state.message='Governed account decision recorded.'}
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
