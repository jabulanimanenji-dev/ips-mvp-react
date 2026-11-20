import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {IPS_COMPANY_ADMIN_NAV} from '../shared/ipsCompanyScope.js';

const source=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('premium IPS design is light-first and strictly scoped to company administration',async()=>{
  const css=await source('src/styles/ips-premium-admin.css');
  const layout=await source('src/pages/AdminLayout.jsx');
  assert.match(css,/\.ips-premium-admin\{/);
  assert.match(css,/color-scheme:light/);
  assert.match(css,/#f7f7f3/);
  assert.match(css,/#142b3d/);
  assert.match(css,/\.ips-premium-admin \.admin-main-content/);
  assert.match(layout,/className="admin-layout ips-premium-admin"/);
  assert.match(layout,/ips-premium-admin\.css/);
  assert.doesNotMatch(css,/\.client-layout\{|\.writer-layout\{|\.ipsa-site-header\{/);
  assert.doesNotMatch(layout,/AdminCMS|ServiceEngine|OpenMarketplace/);
});
test('premium nav groups are case-first and permission gated',async()=>{
  const paths=IPS_COMPANY_ADMIN_NAV.map(x=>x.target);
  assert.equal(paths[0],'/admin/dashboard');
  assert.ok(paths.includes('/admin/enquiries'));
  assert.ok(paths.includes('/admin/external-chats'));
  assert.ok(paths.includes('/admin/services'));
  assert.equal(new Set(paths).size,paths.length);
  assert.deepEqual([...new Set(IPS_COMPANY_ADMIN_NAV.map(x=>x.group))],
    ['Workspace','Delivery','Company']);
  assert.ok(IPS_COMPANY_ADMIN_NAV.every(x=>x.permission&&x.icon));
  const nav=await source('src/components/admin/AdminSidebar.jsx');
  const layout=await source('src/pages/AdminLayout.jsx');
  assert.match(nav,/hasAdminPermission\(item\.permission\)/);
  assert.match(layout,/hasAdminPermission\(item\.permission\)/);
  assert.match(nav,/aria-label="Logout"/);
  assert.match(layout,/role="dialog"/);
  assert.match(layout,/aria-label="Search IPS workspaces"/);
});
test('command center uses actual authenticated feeds and marks unknown data unavailable',async()=>{
  const s=await source('src/components/admin/AdminDashboard.jsx');
  for(const endpoint of ['/api/contact-enquiries/admin','/api/contact-channels/admin/threads','/api/services','/api/support-tickets'])
    assert.ok(s.includes(endpoint),endpoint);
  assert.match(s,/isIpsAcademicProject/);
  assert.match(s,/isIpsQaFixtureEmail/);
  assert.match(s,/IPS Academic Services|academic services/i);
  assert.match(s,/value===null\?'—'/);
  assert.match(s,/\/admin\/enquiries\?case=/);
  assert.match(s,/\['general','quote'\]/);
  assert.doesNotMatch(s,/random\(|Math\.random\(|fakeRevenue|DEMO_/);
  assert.ok(s.includes('Payments not activated'));
});
test('case desk retains verified-contact workflows and adds one case-centered journey',async()=>{
  const s=await source('src/components/admin/AdminEnquiries.jsx');
  for(const token of ['ips-case-grid','ips-case-detail','ips-case-list','ips-case-stage-grid',
    'next.set(\'case\',id)','Open managed IPS project','Take review ownership','Record manual contact confirmation','Send Verified Email']){
    assert.ok(s.includes(token),token);
  }
  assert.match(s,/useSearchParams/);
  assert.match(s,/isIpsQaFixtureEmail/);
  assert.match(s,/contact_consent/);
  assert.doesNotMatch(s,/window\.alert\(/);
});
test('premium project board preserves managed academic-source gates, professional review and disabled payments',async()=>{
  const s=await source('src/components/admin/AdminServices.jsx');
  assert.match(s,/isCompanyAcademicProject/);
  assert.match(s,/ips-case-overview/);
  assert.match(s,/Submitted for Review/);
  assert.match(s,/Approved specialist/);
  assert.match(s,/Payment collection is disabled/);
  assert.ok(s.includes('/api/services/'));
});
