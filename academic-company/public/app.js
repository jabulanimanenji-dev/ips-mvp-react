/* IPS Academic Services — independent public site and authenticated company workspaces. */
const root=document.getElementById('app');
const state={account:null,catalogue:null,page:'home',category:'all',registerRole:'student',service:'',tab:'overview',opened:'',
 message:'',error:'',busy:false,workPage:0,backStack:[],isEvaluation:false,isStaging:false,firstLogin:false,rootEntry:location.pathname.startsWith('/root'),rootLens:null,rootDirectory:[],directoryTab:'',directoryPage:1,directoryQuery:'',directoryStatus:'all',telegramLinkUrl:'',guestVerifiedEmail:'',contactPage:1,contactKind:'general'};
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
const readableStatus=value=>({client_delivery:'Ready for your review',qa_pending:'Under academic quality review',awaiting_payment_integration:'Commissioning unavailable until payments launch',ready_for_assignment:'Preparing your academic team',specialist_assigned:'Specialist assigned',correction_requested:'Corrections in progress',student_revision_requested:'Revision requested',awaiting_specialist_acceptance:'Awaiting Specialist confirmation',pending_review:'Application under review',pending_verification:'Email verification required',offer_delivery_failed:'Quote notification needs attention'})[value]||String(value||'pending').replaceAll('_',' ');
const stat=value=>'<span class="pill '+(['active','approved','accepted','completed','client_delivery','scoped'].includes(value)?'good':['suspended','declined','correction_requested'].includes(value)?'bad':'wait')+'">'+e(readableStatus(value))+'</span>';
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
 [buttonRoute('Academic services','services'),buttonRoute('How IPS works','how'),buttonRoute('Privacy','privacy'),buttonRoute('Contact IPS','contact'),buttonRoute('Student / Researcher','register'),buttonRoute('Join our specialist network','specialist'),buttonRoute('Login','login','primary')].join(''))+
 '</nav></header></div>';
const footer=()=>'<footer class="foot"><span>© IPS Academic Services · Academic & research support</span><span>'+buttonRoute('Privacy policy','privacy','quiet')+' · '+buttonRoute('Contact IPS','contact','quiet')+' · Written correspondence only</span></footer>';
const banner=()=>state.isEvaluation?'<div class="banner" role="status">REVIEW ENVIRONMENT · Fictional accounts and academic records · No payments or external messages</div>':
 state.isStaging?'<div class="banner" role="status">ISOLATED IPS PROVIDER TESTING · Approved test identities only · External written messages may be real · No payments</div>':'';
const flash=()=>state.error?'<div class="notice error" role="alert">'+e(state.error)+'</div>':state.message?'<div class="notice success" role="status">'+e(state.message)+'</div>':'';
const shell=content=>{root.innerHTML=header()+banner()+((state.page!=='home'&&state.page!=='workspace'&&state.page!=='root-login')?'<div class="toolbar global-toolbar">'+b('← Back','back','','back-btn')+'</div>':'')+content+footer();document.title='IPS Academic Services | '+(state.account?'Private workspace':state.page==='services'?'Academic services':'Academic & Research Support')};
const intro=(tag,title,desc)=>'<div class="page-intro"><span class="kicker">'+e(tag)+'</span><h1>'+e(title)+'</h1><p>'+e(desc)+'</p></div>';
const navData=(route,name,active)=>'<button type="button" data-tab="'+e(route)+'" class="'+(active===route?'active':'')+'">'+e(name)+'</button>';
const selectService=()=>state.catalogue.services.map(s=>[s.id,s.title]);
const chooseLevel=()=>state.catalogue.levels.map(x=>[x,x]);
const privacyCheck='<label class="field full"><span><input type="checkbox" name="privacyConsent" required> I agree to secure processing of my private enquiry and written communication from IPS.</span></label>';
const integrityCheck='<label class="field full"><span><input type="checkbox" name="integrityAcknowledged" required> I agree to the academic integrity requirements.</span></label>';
async function api(endpoint,{method='GET',body,operator=false}={}){
 const assistedRead=method==='GET'&&(
  /^\/operations\/direct-message$/.test(endpoint)||
  /^\/operations\/direct-message\/[^/]+\/thread$/.test(endpoint)||
  /^\/finance\/(?:my-billing|work-logs|disputes)$/.test(endpoint)||
  /^\/finance\/compensation\/[^/]+$/.test(endpoint));
 const assistedEndpoint=/^\/(academic|support|notifications)(\/|$)/.test(endpoint)||
  /^\/operations\/inbox$/.test(endpoint)||
  /^\/operations\/[^/]+\/(?:files|upload)$/.test(endpoint)||assistedRead;
 const assisted=!!(state.rootLens&&!operator&&assistedEndpoint);
 const response=await fetch('/api'+endpoint,{method,credentials:'same-origin',cache:'no-store',
  headers:{...(body?{'Content-Type':'application/json'}:{}),
   ...(assisted?{'X-IPS-Root-Workspace-Target':state.rootLens.account.id}:{})},
  body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'IPS could not complete the requested action.');
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
 shell('<main class="page policy-page">'+intro('PRIVACY & DATA PROTECTION','Discreet academic support with accountable data handling.',
 'Your private academic work is processed to answer enquiries, coordinate permitted services and provide secure records.')+
 panel('What IPS requests','Students use a chosen private username rather than a mandatory legal name.',
 '<p>We collect verified email ownership, academic enquiries, agreed scope, correspondence, uploaded files, service decisions and essential security records. Specialists provide their professional names, qualifications and agreements. Billing details are collected only when needed for actual commissioning.</p>'+
 '<p>Authorized IPS personnel receive case-specific access according to their responsibilities. We do not offer telephone calls.</p>')+
 panel('How data is used and protected','Academic files remain inside authenticated workspaces.',
 '<p>IPS uses private sessions, role-based access, screened document uploads and logged administrative decisions. External services may include the hosting platform, database provider, verified email delivery and Telegram when you explicitly connect that channel. Telegram notices contain no academic documents or confidential case details.</p>'+
 '<p>We keep records only for operational, contractual, security and applicable legal retention needs. An authorized review is required before deleting records that must be retained.</p>')+
 panel('Your requests and rights','Access, corrections, consent concerns and lawful retention or erasure requests must reach an accountable privacy reviewer.',
 '<p>You can request a copy of your information, explain a correction or raise a privacy concern using the verified written contact form. IPS verifies your email before routing the request to Governance. The company will explain any retention exceptions in its response.</p>'+
 '<div class="case-actions">'+buttonRoute('Send a privacy or data request','contact','primary')+'</div>')+
 panel('Academic integrity and legitimate use','Guidance must preserve the student’s permitted authorship.',
 '<p>IPS offers legitimate academic guidance, editorial services, tutoring, permitted data analysis and research support. We do not fabricate data or references, guarantee grades, or misrepresent student authorship.</p>'+
 '<p>This page describes current company practices. Formal jurisdiction-specific notices, identity of the registered controller and mandatory retention periods remain subject to legal and owner verification before official production publication.</p>')+'</main>');
}
function contact(){
 state.page='contact';
 shell('<main class="page quote-page">'+intro('CONTACT IPS IN WRITING','Tell IPS what you need.',
 'Questions, Specialist application appeals and privacy rights requests are available without an account or telephone call.')+
 panel('Verified written contact','Your email is used to verify ownership and send a written response.',
 form('public-contact',
 options('Request type','category',[['general','General academic services enquiry'],
  ['specialist_appeal','Specialist application review or appeal'],
  ['privacy_request','Privacy, data access or correction']])+
 field('Reply email address','email','email','you@example.com')+
 field('Subject','subject','text','What should IPS help you with?')+
 textarea('Your request','message','Describe the question or review you need. Do not include passwords or confidential documents.')+
 privacyCheck,'Send private request'))+'</main>');
 const selected=root.querySelector('select[name=category]');if(selected)selected.value=state.contactKind||'general';
 const mail=root.querySelector('input[name=email]');if(mail&&state.account?.email)mail.value=state.account.email;
}
function quoteFields(guest){
 const info=options('Academic service needed','serviceId',selectService())+
 options('Your academic level','academicLevel',chooseLevel())+
 field('Academic subject / discipline','subject','text','e.g. Nursing, Economics, Psychology')+
 field('Preferred deadline','deadline','date','',false)+
 textarea('Describe the academic help you need','requirements','Share the topic, current progress, challenges and expected result')+
 textarea('University guidance or special instructions (optional)','institutionGuidance','Brief, style guide, supervisor comments or permitted support',false)+
 options('Preferred written reply','contactChannel',guest?[['email','Email']]:
 [['workspace','Private IPS workspace'],['email','Email'],
 ...(state.account?.telegramLinked&&state.catalogue.telegramBotUsername?
  [['telegram','Verified private Telegram chat']]:[])] )+integrityCheck;
 return info;
}
function quote(){
 state.page='quote';const guest=!state.account;
 shell('<main class="page quote-page">'+intro('REQUEST A QUOTATION','Tell us what you need.',
 'Choose an academic service and describe your requirements. IPS will reply in writing.')+
 panel('Your academic request','',
 (guest?'<p class="subtle">You can request a confidential quotation without creating an account. IPS verifies your email first; create a free private Student account with that email to see the reviewed quotation and reply securely.</p>':'')+
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
 form('login',field('Email or Student username','email','text','Email or private username')+field('Password','password','password'),'Open my IPS workspace'),
 '<div class="action-row">'+buttonRoute('Get started','register')+buttonRoute('Forgot password?','recover')+buttonRoute('Resend email verification','resend')+'</div>')}
function rootLogin(){
 state.page='root-login';
 auth('Nyoro · Root Administration','Direct secure entry to IPS Academic Services company administration. Root authentication is required. Other accounts cannot use this address.',
 form('login',field('Root email address','email','email','Root account email')+field('Password','password','password','Root Admin password'),'Sign in as Nyoro Root Admin'),
 '<div class="action-row">'+buttonRoute('Recover Root password by email','recover')+'</div>'+
 '<div class="notice mt">This URL provides a direct Root entry, not a login bypass. Root can open actual Student and Specialist workspaces after signing in.</div>');
}
function rootForbidden(){
 shell('<main class="auth">'+intro('ACCESS RESTRICTED','Nyoro Root Administration only',
 'Your current account is not the Root Admin. No Root permissions were granted.')+
 panel('Protected company workspace','Sign out of this account and authenticate as Nyoro to access the Root command centre.',
 '<div class="action-row">'+b('Sign out','logout','','primary')+'</div>')+'</main>');
}
function specialistAgreementFields(){
 const agreement=state.catalogue?.specialistAgreement;
 if(!agreement)return '<div class="notice error">The Specialist agreement is temporarily unavailable.</div>';
 return '<details class="agreement-box field full" open><summary>'+e(agreement.title)+
  ' · '+e(agreement.version)+'</summary><div class="agreement-copy">'+e(agreement.text)+'</div></details>'+
  '<input type="hidden" name="specialistAgreementVersion" value="'+e(agreement.version)+'">'+
  field('Type your full professional name to sign','specialistSignature','text','Exactly as registered')+
  '<label class="field full"><span><input type="checkbox" name="specialistAgreementAccepted" required> '+
  'I have read and accept the current IPS Specialist Confidentiality and Service Agreement.</span></label>';
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
 '<fieldset class="field full expertise-choices"><legend>Academic services you can professionally provide</legend>'+
 '<div class="expertise-grid">'+selectService().map(x=>'<label class="check"><input type="checkbox" name="expertise" value="'+e(x[0])+'"> '+e(x[1])+'</label>').join('')+
 '</div><small>Select all services that match your qualifications.</small></fieldset>':'')+
 (specialist?specialistAgreementFields():'')+
 privacyCheck;
 auth(specialist?'Join our academic specialist network':'Get started with IPS',
 specialist?'Qualified Specialists use their real names and must pass review before assignment.':
 'Choose a private username. Legal full names are not required simply to register.',
 form('register',content,specialist?'Submit Specialist application':'Create private IPS account'),
 '<div class="action-row">'+buttonRoute('Already registered? Sign in','login')+'</div>');
 const select=root.querySelector('select[name=role]');if(select){select.value=role;select.addEventListener('change',ev=>register(ev.target.value))}
 if(state.guestVerifiedEmail&&!specialist){const input=root.querySelector('input[name=email]');if(input)input.value=state.guestVerifiedEmail;}
}
function recovery(){state.page='recover';auth('Reset your password','Enter the registered email. IPS automatically sends a one-use recovery link.',
 form('recovery',field('Registered email','email','email','you@example.com'),'Email recovery link'))}
function resendVerification(){state.page='resend';auth('Resend your verification link','Use the same email address you registered with.',
 form('resend-verification',field('Registered email','email','email','you@example.com'),'Resend verification email'))}
function tokenForm(kind){
 const params=new URLSearchParams(location.hash.slice(1)),token=params.get(kind)||'',mail=params.get('email')||'';
 const headline=kind==='verify'?'Verify your IPS email':kind==='invite'?'Accept your IPS staff invitation':kind==='guestconfirm'?'Verify your academic enquiry':kind==='contactverify'?'Verify your IPS written request':'Set a new password';
 const contents='<input type="hidden" name="token" value="'+e(token)+'"><input type="hidden" name="email" value="'+e(mail)+'">'+
 (['guestconfirm','contactverify'].includes(kind)?'<input type="hidden" name="reference" value="'+e(params.get('ref')||'')+'">':'')+
 (['recover','invite'].includes(kind)?field('New strong password','password','password','8+ characters, uppercase, number and symbol')+field('Confirm password','confirmPassword','password'):'');
 state.page=kind;auth(headline,'This private link expires and can only be used once.',form(kind,contents,
 kind==='guestconfirm'?'Confirm my academic enquiry':kind==='contactverify'?'Verify my written request':kind==='verify'?'Verify my email':'Secure my account'));
}
function departmentsForRole(a){
 if(a.role==='student')return [['overview','Overview'],['inbox','Inbox & messages'],['notifications','Updates'],
  ['quotes','My quotations'],['commissions','My academic work'],['billing','Billing'],['support','Support'],['profile','Profile']];
 if(a.role==='specialist')return [['overview','My work'],['inbox','Inbox & messages'],['notifications','Updates'],
  ['commissions','Assignments & files'],['worklogs','Work records'],['support','Support'],['profile','Profile']];
 if(a.role==='root')return [['overview','Command centre'],['inbox','Inbox & messages'],['contacts','Public contacts'],['queues','Department queues'],['notifications','Alerts & delivery'],
  ['quotes','Enquiries'],['students','Students'],['specialists','Specialists'],
  ['commissions','Academic jobs'],['quality','Quality review'],['root-students','Student workspace'],
  ['root-specialists','Specialist workspace'],['workforce','Team & managers'],
  ['finance','Finance'],['audit','Audit']];
 const t=[['overview','Overview'],['inbox','Inbox & messages'],['notifications','Updates'],['queues','My queue']];
 if(['client_relations','specialist_network','governance'].includes(a.department))t.push(['contacts','Public contacts']);
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
// Busy company inboxes remain searchable and paginated without lost keyboard focus.
const workListTools=(items)=>'<div class="worklist-tools"><label class="field">Search this worklist'+
 '<input type="search" data-work-search placeholder="Search case, person, service or department" autocomplete="off"></label>'+
 '<label class="field">Filter status<select data-work-status><option value="all">All statuses</option>'+
 [...new Set(items.map(x=>String(x.status||'pending')))].sort().map(x=>
 '<option value="'+e(x)+'">'+e(x.replaceAll('_',' '))+'</option>').join('')+
 '</select></label><span class="worklist-count" data-work-count aria-live="polite"></span></div>';
const workListPager=()=>'<div class="worklist-pager"><span class="worklist-count" data-work-page></span>'+
 b('Previous page','work-prev','','quiet')+b('Next page','work-next','','quiet')+'</div>';
function filterWorklist(reset=false){
 const box=root.querySelector('[data-work-search]');if(!box)return;
 if(reset)state.workPage=0;
 const term=box.value.trim().toLowerCase();
 const status=root.querySelector('[data-work-status]')?.value||'all';
 const rows=[...root.querySelectorAll('[data-work-row]')],per=14;
 const matches=rows.filter(x=>(!term||(x.dataset.workSearch||'').toLowerCase().includes(term))&&
  (status==='all'||x.dataset.workStatus===status));
 const pages=Math.max(1,Math.ceil(matches.length/per));
 state.workPage=Math.min(state.workPage,pages-1);
 const visible=new Set(matches.slice(state.workPage*per,(state.workPage+1)*per));
 for(const row of rows)row.hidden=!visible.has(row);
 const first=matches.length?state.workPage*per+1:0,last=Math.min(matches.length,(state.workPage+1)*per);
 const count=root.querySelector('[data-work-count]');
 if(count)count.textContent='Showing '+first+'–'+last+' of '+matches.length+' matching · '+rows.length+' total';
 const page=root.querySelector('[data-work-page]');
 if(page)page.textContent='Page '+(state.workPage+1)+' of '+pages;
 const prev=root.querySelector('[data-action=work-prev]'),next=root.querySelector('[data-action=work-next]');
 if(prev)prev.disabled=state.workPage===0;
 if(next)next.disabled=state.workPage>=pages-1;
}
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
  if(!rootAssisted&&(a.role==='root'||(['manager','staff'].includes(a.role)&&a.department==='communications'))){
   const conversations=await api('/communications/telegram/threads');
   d.inbox.push(...conversations.threads.map(x=>({type:'telegram',id:x.accountId,
    subject:'Telegram · '+x.label,service:'Verified IPS chat'+(x.unread?' · '+x.unread+' unread':''),
    status:x.linked?'connected':'unlinked',updatedAt:x.updatedAt})));
   d.inbox.sort((x,y)=>new Date(y.updatedAt)-new Date(x.updatedAt));
  }
  if(state.opened?.startsWith('TG:'))html=await telegramDetail(state.opened.slice(3));
  else if(state.opened?.startsWith('DM-'))html=await dmDetail(state.opened,a);
  else html=panel('Inbox & conversations','Search and handle private academic enquiries, support, job conversations and verified written channels.',
   d.inbox.length?workListTools(d.inbox)+
   '<div class="small-list worklist-rows">'+d.inbox.map(x=>
    '<article class="inbox-row" data-work-row data-work-status="'+e(x.status||'pending')+
    '" data-work-search="'+e([x.type,x.id,x.service,x.subject,x.status].filter(Boolean).join(' '))+'">'+
    '<div><span class="kicker">'+e(x.type)+' · '+e(x.service||'IPS')+'</span>'+
    '<h3>'+e(x.subject||'Academic case')+'</h3><p>'+e(x.id)+' · '+date(x.updatedAt)+'</p></div>'+
    '<div class="case-actions">'+stat(x.status)+b('Open','inbox-open',x.type+'::'+x.id,'primary')+
    '</div></article>').join('')+'</div>'+workListPager():
   empty('Nothing waiting in your IPS inbox. New written correspondence will appear here.'));
 }else if(tab==='queues'){
  const d=await api('/administration/queues');
  const rows=d.queues.flatMap(q=>q.items.map(x=>({...x,departmentId:q.department,
   departmentName:q.name,status:x.stage||'pending'})));
  const summary='<div class="metrics">'+d.queues.map(q=>kpi(q.name,q.count,
   q.items.length<q.count?'Showing '+q.items.length+' oldest items':'All visible items')).join('')+'</div>';
  html=summary+panel('Department queues','Real total counts, responsible departments and individual tasks. Lists display the oldest 50 records per queue; do not mistake them for the full company.',
   rows.length?workListTools(rows)+
   '<div class="small-list worklist-rows">'+rows.map(x=>
    '<article class="inbox-row" data-work-row data-work-status="'+e(x.status)+
    '" data-work-search="'+e([x.departmentName,x.service,x.subject,x.id,x.stage].filter(Boolean).join(' '))+'">'+
    '<div><span class="kicker">'+e(x.departmentName)+'</span>'+
    '<h3>'+e((x.service||'Academic case')+' · '+(x.subject||'Case needing attention'))+'</h3><p>'+e(x.id)+'</p></div>'+
    '<div class="case-actions">'+stat(x.status)+
    (x.type==='telegram'?b('Open conversation','queue-telegram',x.accountId,'primary'):
     x.type==='delivery'||x.type==='alert'?b('Review exceptions','queue-notifications',x.id,'primary'):
     x.type==='specialist'?b('Review application','queue-specialist',x.id,'primary'):
     x.type==='contact'?b('Open written request','queue-contact',x.id,'primary'):
     !x.ownerId&&a.role!=='root'&&a.department===x.departmentId&&
      ['academic_delivery','quality_assurance'].includes(x.departmentId)?
      b('Claim and open','queue-claim',x.id,'primary'):
      b('Open work','queue-open',x.id,'primary'))+
    '</div></article>').join('')+'</div>'+workListPager():
   empty('No pending tasks for this department.'));
 }else if(tab==='contacts'){
  const d=await api('/administration/public-contacts?page='+state.contactPage);
  const summaries=d.cases||[];
  if(state.opened){
   const item=(await api('/administration/public-contacts/'+encodeURIComponent(state.opened))).case;
   const canRespond=a.role==='root'||item.assignedTo===a.id;
   html=panel('Verified written contact · '+item.id,
    'IPS accepted the request after the sender verified email ownership. Keep correspondence confidential and in writing.',
    '<p><strong>Category:</strong> '+e(item.category.replaceAll('_',' '))+
    ' · <strong>Status:</strong> '+e(item.status)+
    ' · <strong>Responsible:</strong> '+e(item.assignedTo||'Not yet assigned')+'</p>'+
    '<p><strong>Reply email:</strong> '+e(item.email)+'</p>'+
    '<h3>'+e(item.subject)+'</h3><p>'+e(item.message)+'</p>'+
    (item.replies||[]).map(x=>'<div class="message"><small>'+date(x.at)+
     ' · IPS written reply</small><p>'+e(x.message)+'</p></div>').join('')+
    (item.status==='open'&&!item.assignedTo?
     b('Claim this written request','contact-claim',item.id,'primary'):'')+
    (canRespond?form('contact-reply',
      '<input type="hidden" name="contactId" value="'+e(item.id)+'">'+
      textarea('Written response','message',
       'Write a factual reply without copying confidential documents into email'),
      'Email verified sender'):'<p>Claim this request before responding on behalf of IPS.</p>')+
    '<div class="case-actions">'+b('← Back to written contacts','contact-close')+'</div>');
  }else html=panel('Public written contacts',
   'Verified guest enquiries, Specialist application appeals and data-rights requests belong to accountable departments.',
   '<p>'+e(d.total)+' matching written requests · Page '+e(d.page)+'</p>'+
   (summaries.length?summaries.map(x=>
    record(x.subject,x.category.replaceAll('_',' ')+' · '+x.email+
     ' · '+(x.assignedTo?'Assigned':'Needs owner'),x.id,x.status,
     b('Open request','contact-open',x.id,'small primary'))).join(''):
    empty('No verified written requests assigned to this department.'))+
   '<div class="case-actions">'+(d.hasPrevious?b('Previous requests','contact-prev'):'')+
   (d.hasNext?b('More requests','contact-next'):'')+'</div>');
 }else if(tab==='quotes'){
  const d=await api('/academic/quotes');
  if(state.opened)html=await quoteDetail(d.quotes.find(q=>q.id===state.opened),a);
  else html=(a.role==='student'?panel('New academic request','',
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
      (!q.assignedTo&&['received','clarify','scoped'].includes(q.status)&&
       a.role==='staff'&&a.department==='client_relations'?b('Claim enquiry','quote-claim',q.id):'')+
      b('Open enquiry & messages','quote-detail',q.id))).join('')+'</div>':
     empty('No academic enquiries yet.'))+
    '';
 }else if(tab==='commissions'||tab==='quality'){
  const d=await api('/academic/commissions');
  const items=tab==='quality'?d.commissions.filter(x=>['qa_pending','correction_requested','client_delivery'].includes(x.status)):d.commissions;
  if(state.opened)html=await commissionDetail(items.find(p=>p.id===state.opened),a);
  else html=(a.role==='specialist'&&!rootAssisted?(
   await api('/academic/assignment-offers')).offers.map(o=>
    panel('New Specialist assignment offer','Review the permitted scope, your fee and delivery time before committing your capacity.',
     '<p><strong>'+e(o.serviceName)+'</strong> · '+e(o.subject)+'</p>'+
     '<p><strong>Agreed fee if accepted:</strong> '+price(o.feeMinor)+
     ' · <strong>Deadline:</strong> '+e(o.deadline||'To be agreed')+'</p>'+
     '<p>'+e(o.deliverables)+'</p><p><strong>Terms:</strong> '+e(o.terms)+'</p>'+
     form('assignment-decision',
      '<input type="hidden" name="commissionId" value="'+e(o.id)+'">'+
      options('Your response','decision',[['accept','Accept assignment and stated fee'],['decline','Decline without a penalty']])+
      field('Reason if declining','reason','text','Provide a brief reason when declining',false),
      'Send my decision'))).join(''):'')+
   panel(tab==='quality'?'Quality review':'Academic jobs',
   'Open any job to manage its messages, instructions, assigned work and files.',
   items.length?'<div class="small-list">'+items.map(p=>record(
     p.subject+' · '+p.serviceName,
     'Updated '+date(p.updatedAt),p.id,p.status,
     b('Open job','commission-open',p.id,'primary'))).join('')+'</div>':
     empty('No academic jobs in this view.'))+
   '';
 }else if(['students','specialists','root-students','root-specialists','workforce'].includes(tab)){
  if(state.directoryTab!==tab){
   state.directoryTab=tab;state.directoryPage=1;
   state.directoryQuery='';state.directoryStatus='all';
  }
  const role=tab==='root-students'||tab==='students'?'student':
    tab==='root-specialists'||tab==='specialists'?'specialist':'employee';
  const lookup=new URLSearchParams({page:String(state.directoryPage),pageSize:'100'});
  if(role!=='employee')lookup.set('role',role);
  if(state.directoryQuery)lookup.set('search',state.directoryQuery);
  if(state.directoryStatus!=='all')lookup.set('status',state.directoryStatus);
  const d=await api('/administration/people?'+lookup.toString());
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
   '<div class="directory-toolbar"><label class="field">Search<input type="search" data-directory-search placeholder="Name, username or email" value="'+e(state.directoryQuery)+'" autocomplete="off"></label>'+
   '<label class="field">Status<select data-directory-status>'+
   [['all','All statuses'],['active','Active'],['pending_review','Pending approval'],['suspended','Suspended'],['disabled','Offboarded'],['rejected','Rejected'],['invited','Invited']].map(([value,label])=>
    '<option value="'+e(value)+'"'+(state.directoryStatus===value?' selected':'')+'>'+e(label)+'</option>').join('')+'</select></label></div>'+
   '<div class="case-actions">'+b('Search directory','directory-apply','','small primary')+
   b('Clear search','directory-clear','','small')+'</div>'+
   '<p class="subtle">Showing '+people.length+' of '+d.total+
   ' matching accounts · Page '+d.page+'.</p>'+
   (people.length?'<div class="table-wrap"><table class="table directory-table"><thead><tr><th>Account</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+
   people.map(p=>'<tr data-directory-row data-status="'+e(p.status)+'" data-search="'+e((p.username||p.name||'')+' '+p.email)+'"><td><b>'+e(p.username||p.name||'Private account')+'</b><small>'+e(p.email)+'</small></td>'+
   '<td>'+e(p.role==='student'?'Student / Researcher':p.role==='specialist'?'Specialist':p.role)+'</td>'+
   '<td>'+stat(p.verified?p.status:'unverified')+
   (p.role==='specialist'?'<small>'+e(p.specialistAgreementVersion===state.catalogue.specialistAgreement.version?
    'Agreement signed':'Agreement required')+'</small>':'')+'</td><td><div class="actions">'+
   (a.role==='root'&&['student','specialist'].includes(p.role)&&p.verified&&p.status==='active'?
    b('Open workspace','root-lens-open',p.id,'small primary'):'')+
   (a.role==='root'?b('Message','person-message',p.id,'small'):'')+
   (!rootLensList&&canRecover(a,p)?b('Send reset link','person-recover',p.id,'small'):'')+
   (!rootLensList&&canApprove(a,p)?b('Review','person-manage',p.id,'small primary'):'')+
   (!rootLensList&&(a.role==='root'||a.role==='manager'&&p.role==='staff'&&p.managerId===a.id)&&
    !canApprove(a,p)?b('Manage','person-manage',p.id,'small'):'')+
   (!rootLensList&&canSuspend(a,p)?b('Suspend','person-suspend',p.id,'small danger'):'')+
   (!rootLensList&&p.status==='suspended'&&a.role==='root'?b('Reactivate','person-reactivate',p.id,'small'):'')+
   '</div></td></tr>').join('')+'</tbody></table></div>':empty('No accounts found.'))+
   '<div class="case-actions">'+(d.hasPrevious?b('Previous accounts','directory-prev','','small'):'')+
   (d.hasNext?b('Next accounts','directory-next','','small'):'')+'</div>')+
   '';
  if(a.role==='root'&&state.opened?.startsWith('DMTO:'))html=directCompose(state.opened.slice(5),people);
  if(state.opened?.startsWith('PERSON:')){
   const selected=d.people.find(p=>p.id===state.opened.slice(7));
   if(selected)html+=await peopleManagementDetail(selected,a,d.people);
  }
 }else if(tab==='support'){
  const d=await api('/support');
  if(state.opened)html=await supportDetail(d.tickets.find(t=>t.id===state.opened));
  else html=(['student','specialist'].includes(a.role)&&canSimulate?
   panel('Ask IPS for help','',
   form('support',field('Subject','subject')+textarea('Message','message','What do you need help with?'),'Send message')):'')+
   panel('Support conversations','',d.tickets.length?'<div class="small-list">'+d.tickets.map(t=>
    record(t.subject,t.replies?.at(-1)?.message,t.id,t.status,b('Open conversation','support-open',t.id))).join('')+'</div>':
    empty('No support cases yet.'))+
   '';
 }else if(tab==='profile'){
  html=panel('Account & preferences','',
   '<p><strong>'+e(a.username||a.name)+'</strong> · '+e(a.email)+'</p>'+
   (rootAssisted?'<p>Nyoro is operating this workspace. Passwords and personal preferences remain account-holder controlled.</p>':
   form('contact-preference',options('Reply method','contactPreference',
    [['workspace','IPS workspace'],['email','Email'],
     ...(a.telegramLinked?[['telegram','Telegram (verified)']]:[])]),'Save changes')+
   '<div class="case-actions">'+buttonRoute('Email me a password reset link','recover')+'</div>'));
  if(!rootAssisted&&['student','specialist'].includes(a.role)){
   const bot=state.catalogue.telegramBotUsername;
   html+=panel('Private Telegram updates',
    'Only a Telegram chat you link through the IPS bot can receive notifications. Full academic details stay in IPS.',
    '<p>'+e(a.telegramLinked?'Your private bot chat is connected.':'Telegram is not connected to this account.')+'</p>'+
    (bot?'<div class="action-row">'+(a.telegramLinked?b('Disconnect Telegram','telegram-unlink'):
      b('Connect my Telegram chat','telegram-link'))+
      b('Refresh connection status','telegram-refresh','','quiet')+'</div>'+
      (state.telegramLinkUrl&&!a.telegramLinked?'<p><a href="'+e(state.telegramLinkUrl)+
       '" target="_blank" rel="noopener noreferrer">Open IPS Telegram bot and confirm this one-use link</a></p>':''):
     '<p>Telegram connection is not yet enabled. IPS workspace and email remain available.</p>'));
  }
  if(a.role==='specialist'&&!rootAssisted){
   const agreement=state.catalogue.specialistAgreement;
   html+=panel('Specialist confidentiality agreement',
    'Your service obligations are retained with their exact signed version.',
    a.specialistAgreementVersion===agreement.version?
     '<p>Current agreement accepted: <strong>'+e(agreement.version)+'</strong></p>':
     form('specialist-agreement',specialistAgreementFields(),'Accept current agreement'));
   const availability=await api('/specialist/availability');
   html+=panel('Availability & assignments',
    'Keep your capacity accurate so IPS can offer assignments you can deliver responsibly.',
    '<p>Current status: <strong>'+e(availability.availabilityStatus.replaceAll('_',' '))+
    '</strong> · Active assignments: '+e(availability.activeAssignments)+
    ' / '+e(availability.maxConcurrentCases)+
    ' · Declared turnaround: '+e(availability.turnaroundDays)+' days</p>'+
    form('specialist-availability',
     options('New availability','availabilityStatus',
      [['available','Available for academic work'],['limited','Limited availability'],['unavailable','Unavailable for new assignments']])+
     field('Maximum concurrent assignments (1–8)','maxConcurrentCases','number','e.g. 2')+
     field('Normal turnaround in days (1–60)','turnaroundDays','number','e.g. 7'),
     'Update my availability'));
  }
 }else if(tab==='billing'){
  const [result,disputes]=await Promise.all([api('/finance/my-billing'),api('/finance/disputes')]);
  html=panel('Your academic billing','Your accepted academic quotations are recorded here. No payment, invoice or receipt has been issued.',
   result.records.length?'<div class="small-list">'+result.records.map(bill=>
    record('Accepted academic quotation · '+price(bill.amountMinor),
     'Payment gateway not enabled · This is not an invoice or receipt',
     bill.commissionId,bill.state)).join('')+'</div>':
    empty('Accepted academic quotations will appear here. You have no issued invoices or receipts.'))+
   panel('Written billing concerns','Contact IPS privately about a billing record.',
    disputes.disputes.length?'<div class="small-list">'+disputes.disputes.map(d=>
     record('Billing concern',d.reason,d.id,d.status)).join('')+'</div>':'')+
   (result.records.length&&!rootAssisted?
    panel('Open a billing concern','No payments are currently processed, so there are no refunds to initiate.',
    form('billing-dispute',
     options('Academic commission','commissionId',result.records.map(x=>[x.commissionId,x.commissionId]))+
     textarea('Explain the issue','reason','Provide the relevant private academic billing concern'),
     'Send to IPS Finance')):'');
 }else if(tab==='worklogs'){
  const [logs,jobs]=await Promise.all([api('/finance/work-logs'),api('/academic/commissions')]);
  const active=jobs.commissions.filter(p=>p.specialistId===a.id&&p.paymentStatus!=='not_collected');
  html=panel('Specialist work records','Record genuine work against an assigned academic commission. Finance will review it; no payout is available.',
   logs.logs.length?'<div class="small-list">'+logs.logs.map(log=>
    record('Time record · '+e(log.minutes)+' minutes',log.summary+' · '+log.workDate,
     log.id,log.status)).join('')+'</div>':empty('No time records submitted.'))+
    (!rootAssisted&&active.length?
     panel('Submit work time','Submissions are auditable, and repeated requests are idempotent.',
      form('work-log',
       '<input type="hidden" name="requestId" value="'+e(crypto.randomUUID())+'">'+
       options('Assigned academic job','commissionId',active.map(x=>[x.id,x.id]))+
       field('Date of work','workDate','date')+
       field('Minutes worked (5–960)','minutes','number','e.g. 90')+
       textarea('Describe the actual work','summary','Describe the academic guidance, corrections or analysis completed'),
       'Submit work record')):'')+
    (active.length?panel('Specialist compensation terms','IPS must agree any proposed fee with you; no automatic payment occurs.',
      (await Promise.all(active.map(async p=>{
       try{const v=await api('/finance/compensation/'+encodeURIComponent(p.id));
        return '<article class="record"><div><h3>'+e(p.id)+'</h3><p>Proposed amount: '+
         price(v.proposal.proposedFeeMinor)+'</p></div><aside>'+stat(v.proposal.status)+
         (v.proposal.status==='proposed'&&!rootAssisted?
          b('Accept terms','compensation-accept',p.id)+b('Decline','compensation-decline',p.id):'')+
         '</aside></article>'}catch{return ''}}))).join('')||
        empty('No compensation proposal has been offered yet.')):'');
 }else if(tab==='finance'){
  const d=await api('/finance/overview');
  const t=d.totals;
  html='<div class="metrics">'+kpi('Accepted quote value',price(t.acceptedQuoteValueMinor),'Not collected')+
   kpi('Awaiting payment',t.awaitingPaymentIntegration,'Gateway disabled')+
   kpi('Money collected',price(t.collectedAmountMinor),'Verified settlements only')+
   kpi('Receipts',t.issuedReceipts,'Nothing issued')+'</div>'+
   panel('Accepted quotation billing','Real accepted quotation values, not revenue, invoices or successful transactions.',
    d.billing.length?'<div class="small-list">'+d.billing.map(bill=>
      record('Billing preparation · '+price(bill.amountMinor),
       'Student account '+bill.studentId+' · '+bill.commissionId,
       bill.id,bill.state)).join('')+'</div>':
     empty('No accepted academic billing records yet.'))+
   panel('Specialist time & review','Every work entry must be approved by Root or authorized Finance management.',
    d.workLogs.length?'<div class="small-list">'+d.workLogs.map(log=>
      '<article class="record"><div><h3>'+e(log.minutes)+' minutes · '+e(log.commissionId)+'</h3>'+
       '<p>'+e(log.summary)+' · '+e(log.workDate)+'</p><small>'+e(log.id)+'</small></div><aside>'+
       stat(log.status)+(log.status==='submitted'&&a.role!=='staff'?
        b('Review','worklog-review',log.id):'')+
       '</aside></article>'+
       (state.opened===log.id&&log.status==='submitted'&&a.role!=='staff'?
        form('worklog-decision',
         '<input type="hidden" name="workLogId" value="'+e(log.id)+'">'+
         options('Finance decision','decision',[['approve','Approve documented work'],['reject','Reject with reason']])+
         textarea('Review reason','note','Document your assessment of this work record'),
         'Save work review'):'')).join('')+'</div>':
     empty('No Specialist work records for review.'))+
   panel('Proposed Specialist compensation','Proposals require a documented, agreed fee; no payout is executed.',
    d.compensation.length?'<div class="small-list">'+d.compensation.map(c=>
      record('Specialist compensation · '+price(c.proposedFeeMinor),
       c.commissionId+' · '+c.specialistId,c.commissionId,c.status)).join('')+'</div>':
     empty('No compensation has been proposed yet.'))+
   (a.role!=='staff'?panel('Offer Specialist compensation','Only assigned jobs are eligible for a written fee proposal.',
    form('compensation-propose',
     field('Assigned commission ID','commissionId','text','IPS-A-…')+
     field('Proposed fee in PLN','feePLN','number','e.g. 200')+
     textarea('Reason and fee terms','reason','Explain specialist compensation terms and scope'),
     'Propose Specialist fee')):'')+
   panel('Billing concerns','No refund can be processed while payments are not enabled.',
    d.disputes.length?'<div class="small-list">'+d.disputes.map(dispute=>
     '<article class="record"><div><h3>'+e(dispute.commissionId)+'</h3><p>'+
     e(dispute.reason)+'</p></div><aside>'+stat(dispute.status)+
     (a.role!=='staff'&&dispute.status!=='resolved_without_settlement'?
      b('Review','finance-dispute-open',dispute.id):'')+
     '</aside></article>'+
     (state.opened===dispute.id&&a.role!=='staff'&&dispute.status!=='resolved_without_settlement'?
      form('billing-review','<input type="hidden" name="disputeId" value="'+e(dispute.id)+'">'+
       options('Finance outcome','decision',[['reviewing','Continue investigation'],['resolved_without_settlement','Resolve without financial settlement']])+
       textarea('Written decision','note','Record the facts, applicable terms, and resolution'),
       'Save billing review'):'')).join('')+'</div>':
     empty('No billing concerns require attention.'));
 }else if(tab==='audit'){
  const d=await api('/administration/audit');
  html=panel('Audit trail','Every company action, including Root intervention, is attributable.',
   d.events.length?'<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Role</th><th>Action</th><th>Case / account</th></tr></thead><tbody>'+
   d.events.map(x=>'<tr><td>'+date(x.at)+'</td><td>'+e(x.actorRole)+'</td><td>'+e(x.action.replaceAll('_',' '))+'</td><td>'+e(x.ref)+'</td></tr>').join('')+'</tbody></table></div>':
   empty('No events recorded.'));
 }else if(tab==='notifications'){
  const d=await api('/notifications');
  html=panel(a.role==='root'?'Company alerts':'Updates','',
   d.notifications.length?'<div class="small-list">'+d.notifications.map(n=>
   record(n.message,date(n.createdAt),n.id,n.kind,n.read||rootAssisted?'':b('Mark read','notification-read',n.id))).join('')+'</div>':
   empty('No updates.'));
  if(a.role==='root'){
   const delivery=await api('/operations/delivery-status',{operator:true});
   const totals=delivery.counts;
   html+=panel('Email delivery operations','Non-sensitive delivery status. Email notices are sent only when users have selected email updates.',
    '<div class="metrics">'+kpi('Pending',totals.pending||0,'Waiting to send')+
    kpi('Sending',totals.sending||0,'In progress')+
    kpi('Provider accepted',totals.provider_accepted||0,'Not yet verified delivered')+
    kpi('Sandbox',totals.synthetic_dispatched||0,'Synthetic only')+
    kpi('Delivered',totals.delivered||0,'Confirmed by recipient server')+
    kpi('Delayed',totals.delayed||0,'Provider retry in progress')+
    kpi('Bounced',totals.bounced||0,'Hard delivery failure')+
    kpi('Complaints',totals.complained||0,'Consent review required')+
    kpi('Suppressed',totals.suppressed||0,'Address suppressed')+
    kpi('Failed',totals.failed||0,'Action needed')+'</div>'+
    (delivery.exceptions.length?'<div class="small-list">'+delivery.exceptions.map(x=>
     record('Undelivered IPS notification',x.kind+' · attempted '+x.attempts+' times',x.id,x.status,
      x.status==='failed'?b('Retry delivery','delivery-retry',x.id,'small'):
       '<small>Do not retry automatically; review consent and destination.</small>')).join('')+'</div>':
     '<p>No permanently failed email notifications.</p>'));
  }
 }
 const current=root.querySelector('#workbody');if(current){current.innerHTML=html;filterWorklist();}
 }catch(err){const current=root.querySelector('#workbody');if(current)current.innerHTML='<div class="notice error" role="alert">'+e(err.message)+'</div>'}
}
function directCompose(id,people){
 const p=people.find(x=>x.id===id);if(!p)return '';
 return '<div class="mt"><div class="toolbar">'+b('← Back to people','close-case')+'</div>'+panel('Write to '+(p.username||p.name),'Send a private IPS message or academic document.',
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
 return '<div class="mt"><div class="toolbar">'+b('← Back to inbox','close-case')+'</div>'+panel('Private IPS conversation','',
  '<div class="messages">'+thread.messages.map(t=>'<div class="message"><small>'+
   e(t.fromRole||'IPS')+' · '+date(t.createdAt)+'</small><p>'+e(t.body||'')+'</p>'+
   (t.attachmentId?'<p><a href="/api/operations/direct-file/'+e(t.attachmentId)+'" download>Download attached document</a></p>':'')+
   '</div>').join('')+'</div>'+
   form('direct-reply','<input type="hidden" name="messageId" value="'+e(id)+'">'+
    textarea('Reply','body','Write your reply'),'Send reply'))+'</div>';
}
async function telegramDetail(accountId){
 const d=await api('/communications/telegram/threads/'+encodeURIComponent(accountId));
 return '<div class="mt"><div class="toolbar">'+b('← Back to inbox','close-case')+'</div>'+
 panel('Verified Telegram conversation · '+d.label,
  'Messages here are private company records. Telegram replies must not disclose academic briefs, identities, prices, credentials or attachments.',
  '<div class="messages">'+(d.messages.length?d.messages.map(m=>
   '<article class="message"><small>'+e(m.direction==='inbound'?'Verified account · Telegram':'IPS operator · Telegram')+
   ' · '+date(m.createdAt)+' · '+e(m.status)+'</small><p>'+e(m.body)+'</p></article>').join(''):
   empty('No messages recorded yet.'))+'</div>'+
  '<div class="case-actions">'+b('Mark incoming messages read','telegram-read',accountId)+'</div>'+
  (d.linked?form('telegram-reply','<input type="hidden" name="accountId" value="'+e(accountId)+'">'+
    textarea('Non-sensitive written Telegram reply','body','For academic details please sign in to your secure IPS workspace.')+
    '<label class="field full"><span><input type="checkbox" name="privacyConfirmed" required> I confirm this reply contains no confidential case, identity, payment or document information.</span></label>',
    'Queue Telegram reply'):
   '<p>This Telegram chat is no longer linked. Previous correspondence is retained for authorized review only.</p>'))+'</div>';
}
async function peopleManagementDetail(p,a,people){
 const r=await api('/administration/people/'+encodeURIComponent(p.id)+'/history');
 const note='<p>Historical company records are preserved. No employee can view or set account passwords, and Nyoro cannot be deleted.</p>';
 const id='<input type="hidden" name="personId" value="'+e(p.id)+'">';
 const reason=textarea('Written governance reason','reason','Explain the business need and approved authority');
 const isManagedStaff=p.role==='staff'&&(a.role==='root'||a.role==='manager'&&p.managerId===a.id);
 const reviewer=canApprove(a,p);
 const managerChoices=people.filter(x=>x.role==='manager'&&x.department===p.department&&
  x.status==='active'&&x.verified&&x.id!==p.managerId).map(x=>[x.id,x.name||x.email]);
 const history=r.history.length?'<div class="small-list">'+r.history.map(h=>
  record(h.action.replaceAll('_',' '),h.actorRole+' · '+date(h.at),h.id,'recorded')).join('')+
  '</div>':empty('No recorded governance actions for this account yet.');
 return panel('Manage IPS person · '+(p.username||p.name||p.id),
  e(p.role)+' · '+e(p.status)+' · '+e(p.department||'Academic account'),
  '<div class="case-actions">'+b('← Back to directory','close-case')+'</div>'+note+
  form('person-session-revoke',id+reason,'Revoke all sessions')+
  (reviewer?form('specialist-review',id+
   options('Application decision','decision',[['approve_specialist','Approve after credential review'],['reject_specialist','Reject with written explanation']])+
   textarea('Credential evidence and decision explanation','reviewNote',
    'Record the actual credential checks, academic experience and reason for approval or refusal')+
   '<label class="field full"><span><input type="checkbox" name="credentialEvidenceReviewed"> I personally verified professional credential evidence (mandatory for approval).</span></label>',
   'Record Specialist review'):'')+
  (isManagedStaff?form('people-offboard',id+reason,
    'Offboard employee without deleting records'):'')+
  (a.role==='root'&&p.role==='staff'&&managerChoices.length?
   form('people-reassign',id+options('New departmental manager','managerId',managerChoices)+reason,
    'Reassign employee'):'')+
  panel('Recorded account management history','Actions are attributed to authorized IPS personnel.',history));
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
 const [d,docs]=await Promise.all([
  api('/academic/quotes/'+encodeURIComponent(q.id)+'/messages'),
  api('/academic/quotes/'+encodeURIComponent(q.id)+'/files')]);
 const manager=state.account?.role==='root'||['root','manager','staff'].includes(a.role);
 const thread='<div class="messages">'+(d.messages.length?d.messages.map(m=>
  '<article class="message"><small>'+e(m.actorRole==='root'?'Nyoro · IPS':m.actorRole==='student'?'Student / Researcher':'IPS team')+
  ' · '+date(m.createdAt)+'</small><p>'+e(m.body)+'</p></article>').join(''):
  empty('No messages yet. Your reply will appear here.'))+'</div>';
 const chat=form('quote-message',
  '<input type="hidden" name="quoteId" value="'+e(q.id)+'">'+
  (manager?options('Recipient','audience',[['student','Student / Researcher'],['internal','Internal IPS note']]):'')+
  textarea('Write a reply','body','Ask a question or reply in writing'),'Send message');
 const docRows=(docs.files||[]).map(f=>'<article class="file-item"><div><strong>'+
  e(f.filename)+'</strong><small>'+e(f.audience==='internal'?'Internal IPS document':'Academic enquiry document')+
  ' · '+date(f.createdAt)+'</small></div><a href="/api/academic/quote-files/'+
  encodeURIComponent(f.id)+'" download>Download ↓</a></article>').join('');
 const docsPanel=panel('Supporting documents','Attach your instructions, institution guidelines or reference drafts before the quotation is agreed.',
  '<div class="file-tray">'+(docRows||empty('No supporting documents yet.'))+'</div>'+
  form('quote-upload','<input type="hidden" name="quoteId" value="'+e(q.id)+'">'+
   (manager?options('Document audience','audience',[['student','Student / Researcher'],['internal','IPS internal']]):'')+
   field('PDF, DOCX or TXT (up to 20 MB)','upload','file','','true'),
   'Upload document'));
 const authorizedQuoteManager=state.account?.role==='root'||['root','manager'].includes(a.role);
 const clarificationActions=a.role==='student'&&q.status==='clarify'&&(!state.rootLens||state.isEvaluation)?
  panel('Clarification requested by IPS','Send your updated instructions back into the academic scope review queue.',
   form('quote-resubmit',
    '<input type="hidden" name="quoteId" value="'+e(q.id)+'">'+
    textarea('Your academic clarification','clarification','Explain exactly what IPS requested and what you need')+
    textarea('Revised requirements (optional)','requirements','Replace the original brief if its scope changed',false),
    'Resubmit for academic scope review')):'';
 const decisionActions=a.role==='student'&&q.status==='offered'&&(!state.rootLens||state.isEvaluation)?
  '<div class="case-actions">'+b('Accept quotation','quote-accept',q.id,'primary')+
   b('Decline quotation','quote-decline',q.id)+'</div>':'';
 const adminActions=authorizedQuoteManager&&q.status==='received'?
  panel('Review academic scope','',
   form('scope',options('Decision','decision',[['approved','Approve appropriate support'],
    ['clarify','Ask for clarification'],['declined','Decline scope']])+
    textarea('Review note','note','Explain the permitted academic scope'),
    'Record review',' data-id="'+e(q.id)+'"')):authorizedQuoteManager&&q.status==='scoped'?
  panel('Send written quotation','',
   form('offer',field('Reviewed amount (PLN)','pricePLN','number','250.00')+
    textarea('Academic deliverables','deliverables','Describe the permitted work')+
    textarea('Quotation terms','terms','Scope, deadlines and revisions')+
    field('Offer valid until','expires','date','',false),
    'Send quotation',' data-id="'+e(q.id)+'"')):'';
 const authorizedIntake=!state.rootLens&&(a.role==='root'||a.role==='manager'&&a.department==='client_relations');
 let ownershipPanel='';
 if(!state.rootLens&&['root','manager','staff'].includes(a.role)&&
  (a.role==='root'||a.department==='client_relations')){
  const claimable=!q.assignedTo&&['received','clarify','scoped'].includes(q.status);
  const current='<p><strong>Accountable employee:</strong> '+e(q.assignedTo||'Unassigned')+'</p>';
  if(authorizedIntake){
   const people=(await api('/administration/people',{operator:true})).people.filter(p=>
    ['manager','staff'].includes(p.role)&&p.department==='client_relations'&&p.status==='active');
   const history=await api('/academic/quotes/'+encodeURIComponent(q.id)+'/ownership',{operator:true});
   const trail=history.history.length?
    '<div class="small-list">'+history.history.slice(-5).reverse().map(h=>
     '<p><strong>'+e(h.action)+' → '+e(h.to)+'</strong><small> · '+date(h.at)+
      '</small>'+(h.reason?'<span>'+e(h.reason)+'</span>':'')+'</p>').join('')+'</div>':'';
   ownershipPanel=panel('Academic enquiry ownership','Each request has an accountable Client Relations employee. Staff handoffs are audited and private.',
    current+(claimable?b('Claim this enquiry','quote-claim',q.id,'small'):'')+
    (['received','clarify','scoped','offered','offer_delivery_failed'].includes(q.status)&&people.length?
     form('quote-assign',
      '<input type="hidden" name="quoteId" value="'+e(q.id)+'">'+
      options('Assign to Client Relations','assigneeId',people.map(p=>[p.id,p.name||p.email]))+
      textarea('Reason for assignment or handoff','reason','Document the accountable employee and reason'),
      'Assign accountable employee'):'')+trail);
  }else ownershipPanel=panel('Academic enquiry ownership','',current+
    (claimable?b('Claim this enquiry','quote-claim',q.id,'small primary'):''));
 }
 const revisionActions=authorizedQuoteManager&&['offered','expired'].includes(q.status)?
  panel('Revise written quotation','Preserve every earlier amount, scope and expiry. The Student must review this new version.',
   form('quote-revise',
    '<input type="hidden" name="quoteId" value="'+e(q.id)+'">'+
    field('Revised amount in PLN','pricePLN','number','Enter reviewed amount')+
    textarea('Revised academic deliverables','deliverables','State the permitted service')+
    textarea('Revised quotation terms','terms','State limits, deadlines and revision terms')+
    field('Valid until (UTC date)','expires','date','',false)+
    textarea('Reason for revision','reason','Document what changed from the previous offer'),
    'Issue revised quotation')):'';
 const summary='<div class="case-summary"><div class="kicker">ENQUIRY / '+e(q.id)+'</div><h3>'+
   e(q.subject)+'</h3><p>'+e(q.requirements)+'</p><div class="separator"></div>'+
   '<div class="case-flow"><span>'+e(q.academicLevel)+'</span><span>'+e(q.serviceName)+'</span>'+
   stat(q.status)+'</div><p><strong>Deadline:</strong> '+e(q.deadline||'To be agreed')+'</p>'+
   (q.offerVersion?'<p><strong>Quotation version:</strong> '+e(q.offerVersion)+'</p>':'')+
   (q.expires?'<p><strong>Offer valid until (UTC):</strong> '+e(q.expires)+'</p>':'')+
   (q.scopeNote?'<p><strong>Reviewed scope:</strong> '+e(q.scopeNote)+'</p>':'')+
   (q.deliverables?'<p><strong>Deliverables:</strong> '+e(q.deliverables)+'</p>':'')+
   (Number.isInteger(q.priceMinor)?'<p><strong>Written quotation:</strong> '+price(q.priceMinor)+'</p>':'')+
   (q.terms?'<p><strong>Terms:</strong> '+e(q.terms)+'</p>':'')+
   decisionActions+'<div class="case-actions">'+b('← Back to quotations','close-case')+'</div></div>';
 return '<section class="mt"><div class="section-head"><h2>Enquiry & written conversation</h2></div>'+
 '<div class="case-layout"><div>'+summary+ownershipPanel+clarificationActions+adminActions+revisionActions+docsPanel+'</div><section class="case-chat"><h3>Messages</h3>'+thread+chat+'</section></div></section>';
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
   avail.specialists.length?form('assignment-offer',
    '<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
    options('Approved Specialist','specialistId',avail.specialists.map(s=>[s.id,s.name+' · '+s.availableSlots+' open slot(s) · '+s.turnaroundDays+'d turnaround']))+
    field('Proposed Specialist fee (PLN)','feePLN','number','e.g. 150')+
    textarea('Assignment scope and commercial terms','terms','Define permitted work, deadline, revision terms and fee'),
    'Send assignment offer'):empty('No approved Specialist is currently available for this service. Root can take responsibility directly.'))}
 if(manager&&p.status==='qa_pending')
  actions+=panel(p.fulfilmentMode==='root'?'Root-supervised release review':'Academic quality review',
   p.fulfilmentMode==='root'?'If Nyoro prepared this deliverable, the release is recorded as a supervised exception—not independent QA.':'Approve or request corrections before Student delivery.',
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
 if(student&&p.status==='awaiting_payment_integration'&&!assisted)
  actions+=panel('Accepted quotation · commissioning not yet open',
   'You have not been charged. IPS will not begin paid work before verified commissioning. You may withdraw this request without a refund process because no payment was collected.',
   form('withdraw-unpaid',
    '<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
    textarea('Reason for withdrawal','reason','Tell IPS why you no longer want to proceed'),
    'Withdraw unpaid request'));
 const canDeliver=(isRoot||specialist&&canSimulate)&&['specialist_assigned','root_in_progress','correction_requested','student_revision_requested'].includes(p.status);
 const canReference=isRoot||student||specialist;
 const purposes=canDeliver&&canReference?[['reference','Supporting document'],['deliverable','Deliverable for QA']]:
   canDeliver?[['deliverable','Deliverable for QA']]:[['reference','Supporting document']];
 const upload=(canReference||canDeliver)?panel('Upload a document',
  'Private PDF, DOCX or TXT references and Specialist deliverables · up to 20 MB per document.',
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
 if(isRoot&&!state.rootLens){
  const takeover=['ready_for_assignment','specialist_assigned','root_in_progress','correction_requested','student_revision_requested'].includes(p.status);
  if(takeover)actions+=panel('Root takeover','Manage the assignment directly if no Specialist is available.',
   form('root-takeover','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
     textarea('Reason','reason','Why is Root taking responsibility?'),'Take responsibility'));
  if(p.status==='root_in_progress'){
   const [sourceData,supplierDocs]=await Promise.all([
    api('/operations/'+encodeURIComponent(p.id)+'/outsourcing',{operator:true}),
    api('/operations/'+encodeURIComponent(p.id)+'/external-files',{operator:true})]);
   const arrangement=sourceData.privateFulfilment;
   const authorized=arrangement?.activationStatus==='authorized';
   const files=supplierDocs.files||[];
   const fileRows=files.length?'<div class="file-tray">'+files.map(f=>
    '<article class="file-item"><div><strong>'+e(f.filename)+'</strong>'+
     '<small>'+e(f.kind.replaceAll('_',' '))+' · SHA-256 '+e(f.sha256.slice(0,14))+
     ' · '+date(f.createdAt)+'</small></div>'+
     '<div class="case-actions"><a href="/api/operations/external-files/'+encodeURIComponent(f.id)+
     '" download>Download privately ↓</a>'+
     (f.kind==='supplier_return'&&f.status==='private'&&authorized?
      b('Submit for QA','external-qa',p.id+'::'+f.id,'small'):'')+'</div></article>').join('')+
    '</div>':empty('No supplier files stored in the Root-only vault yet.');
   actions+=panel('Private external sourcing & document vault',
    'Only Nyoro can inspect supplier identities, contracts, instructions and returned work. IPS must approve confidentiality and academic-integrity safeguards before any supplier return is accepted.',
    '<p><strong>Arrangement:</strong> '+e(arrangement?.providerReference||'Not yet registered')+
    ' · '+e(authorized?'Authorized and recorded':'Not yet authorized')+'</p>'+
    form('root-outsourcing','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
      field('External provider reference','provider','text','Private name or reference')+
      textarea('Private brief','instructions','Instructions and minimum necessary academic scope'),
      'Record or update private sourcing')+
    (arrangement?.mode==='private_external'&&!authorized?
     form('root-outsourcing-authorize','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
      field('Signed NDA / contract reference','agreementReference','text','Identifiable executed agreement')+
      field('Permitted client disclosure / consent reference','clientDisclosureReference','text','Relevant terms or authorization')+
      '<label class="check"><input type="checkbox" name="confidentialityChecked" required> Confidentiality obligations verified</label>'+
      '<label class="check"><input type="checkbox" name="academicIntegrityChecked" required> Permitted academic assistance independently reviewed</label>'+
      '<label class="check"><input type="checkbox" name="minimumNecessaryDataOnly" required> Supplier receives only minimum necessary personal data</label>',
      'Authorize private sourcing'):'')+
    (arrangement?.mode==='private_external'?
      form('root-external-file','<input type="hidden" name="commissionId" value="'+e(p.id)+'">'+
       options('Document type','kind',[['agreement','NDA or contract'],['instructions','Private work instructions'],
        ['supplier_return','Supplier returned work for QA'],['qa_reference','Private QA reference']])+
       field('Upload Root-only document (up to 5 MB)','upload','file','','true'),
       'Store in private vault'):'')+files);
  }
 }
 const overview='<div class="case-summary"><span class="kicker">ACADEMIC JOB / '+e(p.id)+'</span>'+
  '<h3>'+e(p.subject)+'</h3><p>'+e(p.requirements)+'</p>'+
  '<div class="case-actions">'+stat(p.status)+
   '<span class="pill">'+e(p.serviceName)+'</span></div>'+flow+
  '<p><strong>Delivery:</strong> '+e(p.deadline||'As agreed in your quotation')+'</p>'+
  '<p><strong>Company responsibility:</strong> '+e(p.managedBy?'Nyoro · IPS Root':
    p.specialistId?'Assigned IPS Specialist':'IPS Academic Delivery')+'</p>'+
  (p.qaMode==='root_supervised_exception'?'<p><strong>Quality record:</strong> IPS Root-supervised release exception</p>':'')+
  '<div class="case-actions">'+b('← Back to jobs','close-case')+
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
async function supportDetail(t){
 if(!t)return '';
 const a=state.rootLens?.account||state.account;
 const company=['root','manager','staff'].includes(a.role);
 const canOwn=company&&(a.role==='root'||a.department==='client_relations');
 const owned=!!t.assignedTo&&t.assignedTo===a.id;
 let assignment='';
 if(t.status==='open'&&canOwn){
  const claim=!t.assignedTo?b('Take responsibility','support-claim',t.id,'primary'):'';
  let transfer='';
  if(a.role==='root'||a.role==='manager'&&a.department==='client_relations'){
   const r=await api('/administration/people?role=staff&pageSize=100',{operator:true});
   const people=r.people.filter(p=>p.department==='client_relations'&&p.status==='active');
   transfer=people.length?form('support-assign',
    '<input type="hidden" name="ticketId" value="'+e(t.id)+'">'+
    options('Responsible Client Relations employee','assigneeId',people.map(p=>[p.id,p.name||p.email]))+
    textarea('Reason for handoff','reason','Why is this person responsible now?'),
    'Assign support owner'):'';
  }
  assignment=panel('Support responsibility',
   'This support case has one accountable employee. Writing a reply never silently changes the owner.',
   '<p><strong>Responsible:</strong> '+e(t.assignedTo||'Unassigned · needs ownership')+'</p>'+
   claim+transfer);
 }
 const canRespond=t.status==='open'&&(!company||a.role==='root'||owned);
 return '<div class="mt"><div class="toolbar">'+b('← Back to support','close-case')+'</div>'+
  panel('Support case '+t.id,'Written assistance, case ownership and resolution history.',
  '<p><strong>Status:</strong> '+e(readableStatus(t.status))+
  ' · <strong>Responsible:</strong> '+e(t.assignedTo||'IPS Client Relations queue')+'</p>'+
  '<div class="messages">'+(t.replies||[]).map(r=>
    '<div class="message"><small>'+e(r.role)+' · '+date(r.at)+'</small><p>'+e(r.message)+'</p></div>').join('')+'</div>'+
  (canRespond?form('support-reply',
   '<input type="hidden" name="ticketId" value="'+e(t.id)+'">'+
   textarea('Private reply','message','Write the next helpful response'),'Send secure reply')+
   '<div class="action-row">'+b('Resolve support case','support-close',t.id)+'</div>':
   '<p>This case requires an assigned employee before a reply or resolution.</p>'))+
   assignment+'</div>';
}
function render(){
 if(!state.catalogue){root.textContent='IPS Academic Services is loading…';return}
 if(state.rootEntry&&state.account&&state.account.role!=='root')return rootForbidden();

 const params=new URLSearchParams(location.hash.slice(1));
 for(const k of ['verify','recover','invite','guestconfirm','contactverify'])if(params.has(k)){tokenForm(k);return}
 if(state.rootEntry&&!state.account&&!['recover','recovery'].includes(state.page))return rootLogin();
 if(state.account&&!['quote','services','service','how','privacy','contact','recover','resend'].includes(state.page))return work();
 switch(state.page){case 'services':services();break;case 'service':serviceDetail();break;
 case 'how':how();break;case 'privacy':privacy();break;case 'contact':contact();break;case 'quote':quote();break;
 case 'login':login();break;case 'recover':case 'recovery':recovery();break;case 'resend':resendVerification();break;
 case 'register':register(state.registerRole==='specialist'?'specialist':'student');break;
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
async function uploadAcademicReferenceBinary(endpoint,file,audience='student'){
 if(!file||file.size<12||file.size>20*1024*1024)
  throw Error('Choose a PDF, DOCX or TXT document no larger than 20 MB.');
 const ext=file.name.split('.').pop()?.toLowerCase()||'';
 const accepted={pdf:'application/pdf',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt:'text/plain'};
 if(!accepted[ext])throw Error('Academic reference documents must be PDF, DOCX or TXT.');
 const result=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/octet-stream',
   'X-IPS-File-Name':encodeURIComponent(file.name),
   'X-IPS-File-Type':accepted[ext],
   'X-IPS-File-Audience':audience,
   ...(state.rootLens&&state.isEvaluation?
    {'X-IPS-Root-Workspace-Target':state.rootLens.account.id}:{})},
  body:file});
 const response=await result.json().catch(()=>({}));
 if(!result.ok)throw Error(response.error||'IPS could not store the private reference.');
 return response;
}
async function uploadAcademicBinary(commissionId,file){
 if(!file||file.size<12||file.size>20*1024*1024)
  throw Error('Choose a genuine PDF, DOCX or TXT document under 20 MB.');
 const ext=file.name.split('.').pop()?.toLowerCase()||'';
 const types={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt:'text/plain'};
 if(!types[ext])throw Error('Use PDF, DOCX or TXT for academic deliverables.');
 const res=await fetch('/api/academic/commissions/'+encodeURIComponent(commissionId)+'/submission-binary',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/octet-stream',
   'X-IPS-File-Name':encodeURIComponent(file.name),
   'X-IPS-File-Type':types[ext],
   ...(state.rootLens?.account?.role==='specialist'&&state.isEvaluation?
    {'X-IPS-Root-Workspace-Target':state.rootLens.account.id}:{})},
  body:file
 });
 const result=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(result.error||'IPS could not safely store your academic document.');
 return result;
}
async function submit(name,formNode){
 const data={};new FormData(formNode).forEach((v,k)=>{if(k==='expertise'){if(!data.expertise)data.expertise=[];data.expertise.push(v)}else if(v instanceof File)data[k]=v;else data[k]=v});
 for(const c of ['privacyConsent','integrityAcknowledged','specialistAgreementAccepted'])if(formNode.querySelector('[name="'+c+'"]'))data[c]=!!formNode.querySelector('[name="'+c+'"]').checked;
 const id=formNode.dataset.id||data.commissionId||'';
 if(name==='login'){const r=await api('/auth/login',{method:'POST',body:data});if(state.rootEntry&&r.account.role!=='root'){await api('/auth/logout',{method:'POST'});throw Error('This address is restricted to Nyoro Root Administration. Use the standard IPS login for other accounts.')}state.account=r.account;state.rootLens=null;state.firstLogin=!!r.account.firstLogin;state.page='workspace';state.tab='overview';state.opened='';return 'Signed in securely.'}
 if(name==='register'){
  if(data.password!==data.confirmPassword)throw Error('Confirm password must match the password exactly.');
  const r=await api('/auth/register',{method:'POST',body:data});state.page='login';return 'IPS sent your verification link. Confirm your mailbox before signing in.';
 }
 if(name==='guest-quote'){const r=await api('/academic/guest-quote',{method:'POST',body:data});state.page='login';return 'Your private academic enquiry '+r.reference+' needs email confirmation. IPS has sent a one-use link.'}
 if(name==='public-contact'){
  const r=await api('/public/contact',{method:'POST',body:data});
  state.page='contact';return 'IPS sent a one-use email verification link for request '+r.reference+'. Verify before we review it.';
 }
 if(name==='contactverify'){
  const r=await api('/public/contact/verify',{method:'POST',body:data});
  history.replaceState(null,'',location.pathname+location.search);
  state.page='home';return r.message;
 }
 if(name==='student-quote'){const r=await api('/academic/quotes',{method:'POST',body:data});state.page='workspace';state.tab='quotes';return 'IPS received your academic enquiry '+r.quote.id+'. A qualified team member will review its scope.'}
 if(name==='guestconfirm'){const result=await api('/academic/guest-confirm',{method:'POST',body:data});history.replaceState(null,'',location.pathname+location.search);state.guestVerifiedEmail=data.email;state.page=result.linkedToAccount?'login':'register';state.registerRole='student';return result.message;}
 if(name==='verify'){const r=await api('/auth/verify',{method:'POST',body:data});history.replaceState(null,'',location.pathname+location.search);if(r.account){state.account=r.account;state.page='workspace';state.firstLogin=true;state.tab='overview'}else state.page='login';return r.reviewRequired?'Your specialist email is verified. IPS must approve your professional application.':'Your email is verified. Welcome to IPS.'}
 if(name==='recovery'){await api('/auth/recovery/request',{method:'POST',body:data});state.page=state.account?'workspace':'login';if(state.account)state.tab='profile';return 'If this account is verified, a one-use recovery link is being emailed now.'}
 if(name==='resend-verification'){await api('/auth/resend-verification',{method:'POST',body:data});state.page='login';return 'If verification is pending, IPS has emailed a new link.'}
 if(name==='recover'||name==='invite'){if(data.password!==data.confirmPassword)throw Error('Passwords do not match.');
  const r=await api(name==='recover'?'/auth/recovery/complete':'/auth/invitation/accept',{method:'POST',body:data});history.replaceState(null,'',location.pathname+location.search);if(r.account){state.account=r.account;state.page='workspace';state.tab='overview'}else state.page='login';return 'Your private IPS account credentials were updated successfully.'}
 if(name==='quote-upload'){
  const file=formNode.querySelector('input[name=upload]')?.files?.[0];
  if(file?.size>5*1024*1024){
   await uploadAcademicReferenceBinary('/api/academic/quotes/'+
    encodeURIComponent(data.quoteId)+'/files-binary',
    file,data.audience||'student');
   return 'Your large academic document is securely attached to this enquiry.';
  }
  const payload=await filePayload(formNode);
  await api('/academic/quotes/'+encodeURIComponent(data.quoteId)+'/files',
   {method:'POST',operator:state.account?.role==='root',body:{...payload,audience:data.audience||'student'}});
  return 'Supporting academic document attached to this enquiry.';
 }
 if(name==='quote-message'){
  await api('/academic/quotes/'+encodeURIComponent(data.quoteId)+'/messages',
   {method:'POST',operator:state.account?.role==='root',body:{body:data.body,audience:data.audience||'student'}});
  return 'Message added to the academic enquiry.';
 }
 if(name==='case-upload'){
  const chosen=formNode.querySelector('input[name=upload]')?.files?.[0];
  if(data.purpose==='reference'&&chosen?.size>5*1024*1024){
   await uploadAcademicReferenceBinary('/api/operations/'+
    encodeURIComponent(data.commissionId)+'/upload-reference-binary',chosen);
   return 'Your large academic reference is securely attached to this workroom.';
  }
  if(data.purpose==='deliverable'&&
   (state.account?.role==='specialist'||state.rootLens?.account?.role==='specialist')){
   const file=formNode.querySelector('input[name=upload]')?.files?.[0];
   await uploadAcademicBinary(data.commissionId,file);
   return 'Document securely submitted for independent IPS quality review.';
  }
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
 if(name==='root-outsourcing-authorize'){
  await api('/operations/'+encodeURIComponent(data.commissionId)+'/outsourcing/authorize',
   {method:'POST',operator:true,body:{
    agreementReference:data.agreementReference,
    clientDisclosureReference:data.clientDisclosureReference,
    confidentialityChecked:!!formNode.querySelector('[name=confidentialityChecked]:checked'),
    academicIntegrityChecked:!!formNode.querySelector('[name=academicIntegrityChecked]:checked'),
    minimumNecessaryDataOnly:!!formNode.querySelector('[name=minimumNecessaryDataOnly]:checked')}});
  return 'Root recorded confidentiality, academic-integrity and permission authorization for this supplier.';
 }
 if(name==='root-external-file'){
  const payload=await filePayload(formNode);
  await api('/operations/'+encodeURIComponent(data.commissionId)+'/external-files',
   {method:'POST',operator:true,body:{...payload,kind:data.kind}});
  return 'Supplier document saved into Nyoro’s separate, auditable private vault.';
 }
 if(name==='telegram-reply'){
  await api('/communications/telegram/threads/'+encodeURIComponent(data.accountId)+'/reply',
   {method:'POST',body:{body:data.body,
    privacyConfirmed:!!formNode.querySelector('[name=privacyConfirmed]:checked')}});
  return 'Telegram reply queued. Provider delivery and recipient reading are not yet confirmed.';
 }
 if(name==='work-log'){
  await api('/finance/work-logs',{method:'POST',body:{commissionId:data.commissionId,
   workDate:data.workDate,minutes:Number(data.minutes),summary:data.summary,requestId:data.requestId}});
  return 'Your genuine academic time record is submitted for Finance review. No payout has been issued.';
 }
 if(name==='compensation-propose'){
  await api('/finance/compensation/'+encodeURIComponent(data.commissionId)+'/propose',{
   method:'POST',body:{feeMinor:Math.round(Number(data.feePLN)*100),reason:data.reason}});
  return 'Specialist fee proposal recorded. The Specialist must acknowledge it; no payout has been issued.';
 }
 if(name==='worklog-decision'){
  await api('/finance/work-logs/'+encodeURIComponent(data.workLogId)+'/decision',
   {method:'POST',body:{decision:data.decision,note:data.note}});
  state.opened='';
  return 'Specialist work record reviewed with an auditable Finance decision. No payout was issued.';
 }
 if(name==='billing-review'){
  await api('/finance/disputes/'+encodeURIComponent(data.disputeId)+'/review',
   {method:'POST',body:{decision:data.decision,note:data.note}});
  state.opened='';
  return 'Billing concern reviewed without creating a financial settlement.';
 }
 if(name==='withdraw-unpaid'){
  await api('/academic/commissions/'+encodeURIComponent(data.commissionId)+'/withdraw',
   {method:'POST',body:{reason:data.reason}});
  state.opened='';
  return 'Your unpaid academic request was withdrawn. No payment or refund was involved.';
 }
 if(name==='billing-dispute'){
  await api('/finance/disputes',{method:'POST',body:{commissionId:data.commissionId,reason:data.reason}});
  return 'Your private billing concern was sent to IPS Finance.';
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
 if(name==='person-session-revoke'){
  await api('/administration/people/'+encodeURIComponent(data.personId)+'/revoke-sessions',
   {method:'POST',body:{reason:data.reason}});
  return 'Account sessions revoked. The account owner must sign in again.';
 }
 if(name==='people-offboard'){
  await api('/administration/people/'+encodeURIComponent(data.personId)+'/offboard',
   {method:'POST',body:{reason:data.reason}});
  state.opened='';
  return 'The employee was offboarded. Prior work, records and audit trails remain preserved.';
 }
 if(name==='people-reassign'){
  await api('/administration/people/'+encodeURIComponent(data.personId)+'/reassign-manager',
   {method:'POST',body:{managerId:data.managerId,reason:data.reason}});
  state.opened='';
  return 'The staff reporting manager was changed with old sessions revoked.';
 }
 if(name==='specialist-review'){
  await api('/administration/people/'+encodeURIComponent(data.personId)+'/decision',
   {method:'POST',body:{decision:data.decision,reviewNote:data.reviewNote,
    credentialEvidenceReviewed:!!formNode.querySelector('[name=credentialEvidenceReviewed]:checked')}});
  state.opened='';
  return 'The recorded Specialist Network decision was queued for written delivery.';
 }
 if(name==='quote-resubmit'){
  await api('/academic/quotes/'+encodeURIComponent(data.quoteId)+'/resubmit',
   {method:'POST',body:{clarification:data.clarification,requirements:data.requirements}});
  return 'Your clarification was received; the academic scope is back in Client Relations review.';
 }
 if(name==='quote-revise'){
  data.priceMinor=Math.round(Number(data.pricePLN)*100);delete data.pricePLN;
  await api('/academic/quotes/'+encodeURIComponent(data.quoteId)+'/revise-offer',
   {method:'POST',operator:state.account?.role==='root',
    body:{priceMinor:data.priceMinor,terms:data.terms,deliverables:data.deliverables,
     expires:data.expires,reason:data.reason}});
  return 'New quotation version issued and client notified according to contact preference.';
 }
 if(name==='quote-assign'){
  await api('/academic/quotes/'+encodeURIComponent(data.quoteId)+'/assign',
   {method:'POST',operator:state.account?.role==='root',
    body:{assigneeId:data.assigneeId,reason:data.reason}});
  return 'Client Relations ownership handoff recorded and responsible employee notified.';
 }
 if(name==='scope'){await api('/academic/quotes/'+encodeURIComponent(id)+'/scope',{method:'POST',operator:state.account?.role==='root',body:data});return 'Academic scope decision has been recorded.'}
 if(name==='offer'){data.priceMinor=Math.round(Number(data.pricePLN)*100);delete data.pricePLN;
  await api('/academic/quotes/'+encodeURIComponent(id)+'/offer',{method:'POST',operator:state.account?.role==='root',body:data});return 'Reviewed academic quotation issued in writing.'}
 if(name==='assignment-offer'){
  await api('/academic/commissions/'+encodeURIComponent(data.commissionId)+'/assignment-offer',
   {method:'POST',body:{specialistId:data.specialistId,
    feeMinor:Math.round(Number(data.feePLN)*100),terms:data.terms}});
  return 'A scoped offer was sent to the Specialist. No capacity is reserved until they accept.';
 }
 if(name==='assignment-decision'){
  await api('/academic/commissions/'+encodeURIComponent(data.commissionId)+'/assignment-decision',
   {method:'POST',body:{decision:data.decision,reason:data.reason||''}});
  return data.decision==='accept'?'You accepted the assignment and fee. IPS has reserved your available capacity.':
   'You declined this offer; IPS can select another Specialist.';
 }
 if(name==='assign'){await api('/academic/commissions/'+encodeURIComponent(id)+'/assign',{method:'POST',operator:state.account?.role==='root',body:{specialistId:data.specialistId}});return 'Approved academic Specialist assignment recorded.'}
 if(name==='submit-academic'){
  const file=formNode.querySelector('input[name=upload]')?.files?.[0];
  await uploadAcademicBinary(id,file);
  return 'Document securely submitted for independent IPS quality review.';
 }
 if(name==='quality'){await api('/academic/commissions/'+encodeURIComponent(id)+'/quality',{method:'POST',operator:state.account?.role==='root',body:data});return 'Academic QA decision recorded and responsible parties notified.'}
 if(name==='student-decision'){await api('/academic/commissions/'+encodeURIComponent(id)+'/student-decision',{method:'POST',body:data});return 'Your academic delivery decision is saved.'}
 if(name==='commission-message'){await api('/academic/commissions/'+encodeURIComponent(id)+'/messages',{method:'POST',body:data});return 'Message sent and attached to this academic job.'}
 if(name==='support'){await api('/support',{method:'POST',body:data});return 'Your written academic support case is in the IPS Client Relations queue.'}
 if(name==='support-reply'){await api('/support/'+encodeURIComponent(data.ticketId)+'/reply',{method:'POST',body:{message:data.message}});return 'Private support response recorded.'}
 if(name==='contact-reply'){
  await api('/administration/public-contacts/'+encodeURIComponent(data.contactId)+'/reply',
   {method:'POST',body:{message:data.message}});
  return 'IPS sent the response to the verified email address. Provider acceptance is not proof of reading.';
 }
 if(name==='support-assign'){
  await api('/support/'+encodeURIComponent(data.ticketId)+'/assign',{method:'POST',body:{
   assigneeId:data.assigneeId,reason:data.reason}});
  return 'Support responsibility transferred with an audit record.';
 }
 if(name==='specialist-agreement'){
  const r=await api('/specialist/agreement/accept',{method:'POST',body:data});
  state.account.specialistAgreementVersion=r.agreementVersion;
  return 'Your signed confidentiality agreement is recorded in your Specialist workspace.';
 }
 if(name==='specialist-availability'){
  await api('/specialist/availability',{method:'PATCH',body:data});
  return 'Your availability and assignment capacity are saved for IPS Academic Delivery.';
 }
 if(name==='contact-preference'){await api('/profile',{method:'PATCH',body:data});state.account.contactPreference=data.contactPreference;return 'Your preferred written contact channel was saved.'}
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
document.addEventListener('input',ev=>{if(ev.target.matches('[data-directory-search]'))filterDirectory();if(ev.target.matches('[data-work-search]'))filterWorklist(true)});
document.addEventListener('change',async ev=>{
 if(ev.target.matches('[data-directory-status]')){filterDirectory();return}
 if(ev.target.matches('[data-work-status]')){filterWorklist(true);return}
 const select=ev.target.closest('select[data-root-target]');
 if(!select||!state.rootLens||state.account?.role!=='root')return;
 try{await openRootLens(select.value)}catch(err){state.error=err.message;render()}
});
document.addEventListener('click',async ev=>{
 const route=ev.target.closest('[data-nav]'),tab=ev.target.closest('[data-tab]'),action=ev.target.closest('[data-action]'),category=ev.target.closest('[data-category]');
 if(category){remember();state.category=category.dataset.category;services();return}
 if(route){ev.preventDefault();const tokenParams=new URLSearchParams(location.hash.slice(1));
  if(['recover','verify','invite','guestconfirm','contactverify'].some(k=>tokenParams.has(k)))history.replaceState(null,'',location.pathname+location.search);
  remember();const dest=route.dataset.nav;state.error='';state.message='';state.opened='';
  if(state.account&&['home','services','quote','how','privacy','contact'].includes(dest)){if(state.rootLens&&dest==='quote'&&!state.isEvaluation){state.error='Real client quote authorization must come from the account holder.';render();return}state.page=dest==='home'?'services':dest;render();return}
  state.page=dest;state.registerRole=dest==='specialist'?'specialist':dest==='register'?'student':state.registerRole;render();return}
 if(tab){remember();state.workPage=0;state.tab=tab.dataset.tab;state.opened='';state.message='';state.error='';render();return}
 if(!action||state.busy)return;const act=action.dataset.action,id=action.dataset.id;
 if(['directory-prev','directory-next','directory-apply','directory-clear'].includes(act)){
  if(act==='directory-apply'){
   state.directoryQuery=(root.querySelector('[data-directory-search]')?.value||'').trim();
   state.directoryStatus=root.querySelector('[data-directory-status]')?.value||'all';
   state.directoryPage=1;
  }else if(act==='directory-clear'){
   state.directoryQuery='';state.directoryStatus='all';state.directoryPage=1;
  }else state.directoryPage=Math.max(1,state.directoryPage+(act==='directory-next'?1:-1));
  state.opened='';state.error='';render();return;
 }
 if(act==='work-prev'||act==='work-next'){
  state.workPage=Math.max(0,state.workPage+(act==='work-next'?1:-1));
  filterWorklist();return;
 }
 state.error='';state.message='';
 if(act==='back'){if(state.backStack.length)history.back();else goBack();return}
 if(act==='root-lens-exit'){remember();state.rootLens=null;state.rootDirectory=[];state.page='workspace';state.tab='overview';state.opened='';history.replaceState(null,'','/root');render();return}
 if(act==='root-lens-open'){remember();try{await openRootLens(id)}catch(err){state.error=err.message;render()}return}
 if(act==='close-case'){if(state.backStack.length)history.back();else{state.opened='';render()}return}
 if(['tab-inbox','tab-students','tab-specialists','tab-workforce'].includes(act)){
  remember();state.tab=act.slice(4);state.opened='';render();return}
 if(['contact-open','contact-close','contact-claim','contact-prev','contact-next','queue-contact'].includes(act)){
  try{
   if(act==='contact-claim'){
    await api('/administration/public-contacts/'+encodeURIComponent(id)+'/claim',
     {method:'POST'});
   }else if(act==='contact-open'||act==='queue-contact'){
    remember();state.tab='contacts';state.opened=id;
   }else if(act==='contact-close')state.opened='';
   else state.contactPage=Math.max(1,state.contactPage+(act==='contact-next'?1:-1));
   render();
  }catch(err){state.error=err.message;render()}
  return;
 }
 if(act==='queue-claim'){
  try{await api('/operations/'+encodeURIComponent(id)+'/claim',{method:'POST'});
   state.tab=state.account?.department==='quality_assurance'?'quality':'commissions';
   state.opened=id;state.message='You now own this academic responsibility.';render();
  }catch(err){state.error=err.message;render()}
  return;
 }
 if(act==='queue-specialist'){
  remember();state.tab='specialists';state.directoryTab='specialists';
  state.directoryPage=1;state.directoryQuery=id;state.directoryStatus='all';
  state.opened='PERSON:'+id;render();return;
 }
 if(act==='queue-telegram'){
  remember();state.tab='inbox';state.opened='TG:'+id;render();return;
 }
 if(act==='queue-notifications'){
  remember();state.tab='notifications';state.opened='';render();return;
 }
 if(act==='inbox-open'||act==='queue-open'){
  remember();
  const parts=act==='inbox-open'?id.split('::'): [id.startsWith('IPS-Q')?'quote':id.startsWith('IPS-S')?'support':'commission',id];
  const kind=parts[0];state.opened=kind==='telegram'?'TG:'+parts.slice(1).join('::'):parts.slice(1).join('::');
  state.tab=kind==='quote'?'quotes':kind==='support'?'support':kind==='direct'||kind==='telegram'?'inbox':kind==='alert'?'notifications':'commissions';
  render();return;
 }
 if(act==='telegram-link'||act==='telegram-unlink'||act==='telegram-refresh'){
  try{
   if(act==='telegram-link'){
    const result=await api('/contact/telegram/link',{method:'POST'});
    state.telegramLinkUrl=result.url;
    state.message='Open the one-use Telegram link to verify your private chat, then refresh the connection status.';
   }else if(act==='telegram-unlink'){
    await api('/contact/telegram/unlink',{method:'POST'});
    state.account.telegramLinked=false;
    state.account.contactPreference='workspace';
    state.telegramLinkUrl='';
    state.message='Telegram chat unlinked. IPS will retain written updates inside your private workspace.';
   }else{
    const result=await api('/contact/telegram/status');
    state.account.telegramLinked=result.linked;
    if(result.linked)state.telegramLinkUrl='';
    state.message=result.linked?'Telegram chat ownership verified.':'Telegram has not yet been linked by the IPS bot.';
   }
   render();
  }catch(err){state.error=err.message;render()}
  return;
 }
 if(act==='person-message'){remember();state.opened='DMTO:'+id;render();return}
if(act==='service'){remember();state.service=id;state.page='service';serviceDetail();return}
 if(act==='request-service'){remember();state.service=id;state.page='quote';quote();return}
 if(['tab-commissions','tab-queues','tab-root-students','tab-root-specialists'].includes(act)){remember();state.tab=act.slice(4);state.opened='';state.message='';state.error='';render();return}
 if(['quote-detail','commission-open','support-open','worklog-review','finance-dispute-open'].includes(act)){remember();state.opened=state.opened===id?'':id;render();return}
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
  else if(act==='external-qa'){
   const [commissionId,fileId]=id.split('::');
   if(!commissionId||!fileId)throw Error('Select a valid Root-only supplier file.');
   await api('/operations/'+encodeURIComponent(commissionId)+'/external-files/'+
    encodeURIComponent(fileId)+'/submit-qa',{method:'POST',operator:true});
   state.message='Private supplier return submitted to IPS quality assurance with a recorded checksum.';
  }
  else if(act==='quote-claim'){
   await api('/academic/quotes/'+encodeURIComponent(id)+'/claim',
    {method:'POST',operator:state.account?.role==='root',body:{}});
   state.message='You are now accountable for this academic enquiry.';
  }
  else if(act==='person-manage'){
   state.opened='PERSON:'+id;
   state.message='';
  }
  else if(['person-recover','person-suspend','person-reactivate'].includes(act)){
   if(act==='person-recover'){await api('/administration/people/'+encodeURIComponent(id)+'/send-recovery',{method:'POST'});state.message='IPS emailed a secure recovery link to the account owner.'}
   else{const decision=act==='person-reactivate'?'reactivate':'suspend';await api('/administration/people/'+encodeURIComponent(id)+'/decision',{method:'POST',body:{decision}});state.message='Governed account decision recorded.'}
  }
  else if(act==='support-claim'){await api('/support/'+encodeURIComponent(id)+'/claim',{method:'POST'});state.message='You are now responsible for this support request.'}
  else if(act==='support-close'){await api('/support/'+encodeURIComponent(id)+'/resolve',{method:'POST'});state.message='Written support case resolved.'}
  else if(act==='notification-read'){await api('/notifications/'+encodeURIComponent(id)+'/read',{method:'POST'});state.message='Notification marked read.'}
  else if(act==='telegram-read'){
   await api('/communications/telegram/threads/'+encodeURIComponent(id)+'/read',
    {method:'POST',body:{}});
   state.message='Telegram messages marked read for IPS Communications.';
  }
  else if(['compensation-accept','compensation-decline'].includes(act)){
   const decision=act==='compensation-accept'?'accept':'decline';
   await api('/finance/compensation/'+encodeURIComponent(id)+'/respond',
    {method:'POST',body:{decision}});
   state.message='Specialist compensation terms recorded. No payment has occurred.';
  }
  else if(act==='delivery-retry'){await api('/operations/delivery/'+encodeURIComponent(id)+'/retry',{method:'POST',operator:true});state.message='Failed notification queued for an automatic retry.'}
  else throw Error('This academic action needs an assigned workflow.');
 }catch(ex){state.error=ex.message}
 finally{state.busy=false}
 render();
});
(async()=>{
 try{
  state.catalogue=await api('/catalogue');
  const h=await api('/health');state.isEvaluation=h.environment==='ISOLATED_ACADEMIC_REVIEW';state.isStaging=h.environment==='STAGING_REAL_PROVIDER_VALIDATION';
  try{const s=await api('/session');state.account=s.account;state.page='workspace'}catch{state.page=state.rootEntry?'root-login':'home'}
  render();
 }catch(ex){root.innerHTML='<main class="page"><h1>IPS Academic Services</h1><div class="notice error">'+e(ex.message)+'</div></main>'}
})();
