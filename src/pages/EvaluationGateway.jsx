import React from 'react';
import {Link} from 'react-router-dom';

const accounts=[
  {id:'01',name:'Client / Researcher',role:'CLIENT',route:'/login',
   email:'client.evaluation@example.org',password:'EvalClient2026!',
   steps:'Review confidential quotations, request written support, follow managed projects, documents, revisions and transaction history.'},
  {id:'02',name:'Approved IPS Specialist',role:'SPECIALIST',route:'/writer/login',
   email:'specialist.evaluation@example.org',password:'EvalSpecialist2026!',
   steps:'Inspect assigned professional work, management communication, private deliverables, deadlines and payout records.'},
  {id:'03',name:'IPS Administration',role:'OPERATIONS',route:'/ips-evaluation-ops',
   email:'admin.evaluation@example.org',password:'EvalAdmin2026!',
   steps:'Inspect Mission Control, claim enquiries, supervise quotations, approve work, monitor service quality and reconcile finances.'}
];
export default function EvaluationGateway(){
  if(import.meta.env.VITE_IPS_EVALUATION!=='true')return null;
  return <main className="ips-eval-guide">
    <div className="ips-eval-guide-inner">
      <div className="ips-eval-guide-breadcrumb"><Link to="/">IPS Academic Services</Link><span>/</span><span>Secure workspace evaluation</span></div>
      <div className="ips-eval-disclosure" role="status">
        <span className="ips-eval-disclosure-mark" aria-hidden="true">!</span>
        <div><strong>ISOLATED DEMONSTRATION — NOT PRODUCTION</strong>
          <p>Test users, quotations and payment records are synthetic. The application has a real isolated Express API and MongoDB, but does not send actual messages, charge cards, or store customer documents permanently. Never enter real confidential or personal data here.</p>
        </div>
      </div>
      <header className="ips-eval-hero">
        <p className="ips-eval-overline">IPS SECURE PLATFORM / LIVE TEST ENVIRONMENT</p>
        <h1>Evaluate the complete working interface.</h1>
        <p>Explore the three IPS workspaces using independent demonstration accounts. Each role has its own permissions, but every workspace operates through the same managed business application.</p>
      </header>
      <div className="ips-eval-role-grid">
        {accounts.map(account=><section key={account.id} className="ips-eval-role">
          <div className="ips-eval-role-head"><span>{account.id}</span><span>{account.role}</span></div>
          <h2>{account.name}</h2>
          <p>{account.steps}</p>
          <dl className="ips-eval-credentials">
            <dt>Evaluation email</dt><dd>{account.email}</dd>
            <dt>Test password</dt><dd><code>{account.password}</code></dd>
          </dl>
          <Link className="ips-eval-open-link" to={account.route}>Open {account.name} Login <span aria-hidden="true">↗</span></Link>
        </section>)}
      </div>
      <div className="ips-eval-bottom">
        <section className="ips-eval-instructions">
          <p className="ips-eval-overline">TEST THE REAL WORKFLOW</p>
          <h2>One company. Three roles.</h2>
          <ol>
            <li>Sign in as the client. Read the sample private quotation, associated project and financial history.</li>
            <li>Open IPS Mission Control in a separate private browser session. Inspect the human review queue and supervised service operations.</li>
            <li>Sign in as the specialist in another session. View assignments, private work communication and payment records.</li>
            <li>Compare the consistent navigation, forms, access boundaries and mobile layouts across each role.</li>
          </ol>
        </section>
        <aside className="ips-eval-disclosure-small">
          <h3>Evaluation boundaries</h3>
          <p>The sample paid engagements are fictional fixtures, not real settlements. Live Stripe payments, delivery through email or messenger platforms, external file storage and persistent data require separate secured production integrations.</p>
          <p>Evaluation data may reset when this isolated service restarts. Use the supplied test identities only.</p>
        </aside>
      </div>
    </div>
  </main>;
}
