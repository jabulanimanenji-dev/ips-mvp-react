import assert from 'node:assert/strict';
const url='http://127.0.0.1:18089';
const request=async(route,body,cookie)=>{
 const r=await fetch(url+'/api'+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json','Origin':url}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 let value;try{value=await r.json()}catch{value={}};
 return {status:r.status,value,cookie:(r.headers.get('set-cookie')||'').split(';')[0]};
};
const root=await request('/auth/login',{email:'nyoro.review@example.org',password:'ReviewRootLocal2026!'});
assert.equal(root.status,200);assert.equal(root.value.account.name,'Nyoro');
const roles=[
 ['client.review@example.org','ReviewClientLocal2026!','client'],
 ['specialist.review@example.org','ReviewSpecialistLocal2026!','specialist'],
 ['manager.review@example.org','ReviewManagerLocal2026!','manager'],
 ['staff.review@example.org','ReviewStaffLocal2026!','staff']
];
for(const [email,password,role] of roles){
 const r=await request('/auth/login',{email,password});
 assert.equal(r.status,200,'Failed '+role+': '+JSON.stringify(r.value));
 assert.equal(r.value.account.role,role);
 const authenticated=await request('/me',undefined,r.cookie);
 assert.equal(authenticated.status,200);
 if(role==='client'||role==='specialist'){
   const p=await request('/projects',undefined,r.cookie);
   assert.equal(p.status,200);
   assert.ok(p.value.projects.some(x=>x.id==='PR-REVIEW-COMPLETE'));
 }
 console.log('PASS REVIEW_CONTAINER_SIGNED_IDENTITY '+role);
}
const owner=await request('/people',undefined,root.cookie);
assert.equal(owner.status,200);assert.equal(owner.value.people.length,4);
assert.ok(!owner.value.people.some(x=>x.role==='root'));
const staff=await request('/people',undefined,(await request('/auth/login',{email:'staff.review@example.org',password:'ReviewStaffLocal2026!'})).cookie);
assert.equal(staff.status,200);assert.ok(!staff.value.people.some(x=>x.role==='manager'));
const foreign=await fetch(url+'/api/quotes',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({})});
assert.equal(foreign.status,403);
const config=await request('/health');
assert.equal(config.value.environment,'ISOLATED_EVALUATION');
assert.equal(config.value.payments,'disabled');
console.log('IPS_NEW_COMPANY_DOCKER_EVALUATION_GREEN all five signed roles, role boundaries and disposable private MongoDB');
