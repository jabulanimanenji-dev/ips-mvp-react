import React, { useCallback, useEffect, useState } from 'react';

const formatTotal = quote => new Intl.NumberFormat('en', { style: 'currency', currency: String(quote?.currency || 'USD').toUpperCase() }).format(Number(quote?.total || 0));

export default function StudentCheckout({ job, onRefresh }) {
  const [state, setState] = useState({ working: false, error: '', status: job.payment_status || 'unpaid' });
  const paid = state.status === 'paid' || job.payment_status === 'paid';
  const eligible = job.quote?.accepted && Number(job.quote.total) > 0;
  const returned = new URLSearchParams(window.location.search).get('checkout') === 'returned';

  const refresh = useCallback(async () => {
    const response = await fetch('/api/student-payments/status/' + encodeURIComponent(job.request_id));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Payment status could not be verified.');
    setState(previous => ({ ...previous, status: data.payment_status, error: '' }));
    if (data.payment_status === 'paid') onRefresh?.();
    return data.payment_status;
  }, [job.request_id, onRefresh]);

  useEffect(() => {
    let active = true;
    let polls = 0;
    const check = async () => {
      try { if (active) await refresh(); } catch (error) { if (active) setState(previous => ({ ...previous, error: error.message })); }
    };
    check();
    if (!returned) return () => { active = false; };
    const timer = setInterval(async () => {
      polls += 1;
      try { if ((await refresh()) === 'paid' || polls >= 15) clearInterval(timer); }
      catch { if (polls >= 15) clearInterval(timer); }
    }, 4000);
    return () => { active = false; clearInterval(timer); };
  }, [job.request_id, returned]);

  const start = async () => {
    setState(previous => ({ ...previous, working: true, error: '' }));
    try {
      const response = await fetch('/api/student-payments/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: job.request_id })
      });
      const data = await response.json();
      if (!response.ok || !data.checkout_url) throw new Error(data.error || 'Unable to start checkout.');
      const url = new URL(data.checkout_url);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.stripe.com')) throw new Error('Unexpected checkout destination.');
      window.location.assign(url.toString());
    } catch (error) {
      setState(previous => ({ ...previous, working: false, error: error.message }));
    }
  };

  return <section className="card" style={{ marginTop: '1rem', borderLeft: '4px solid var(--primary)' }}>
    <h3>Secure payment</h3>
    <p>Payment is required only after you accept the final academic-support quotation.</p>
    <p><strong>Quotation: {eligible ? formatTotal(job.quote) : 'Awaiting your approval'}</strong></p>
    {paid ? <p role="status" style={{ color: 'var(--success, green)' }}>Payment verified. Your support request is eligible for fulfillment.</p>
      : !eligible ? <p>Review and accept your quotation from the Service Hub before paying.</p>
      : <>
        <p role="status">{state.status === 'processing' || returned ? 'Checking payment confirmation with the provider…' : 'Payment has not been confirmed.'}</p>
        <button className="btn btn-primary" disabled={state.working} onClick={start}>{state.working ? 'Preparing secure checkout…' : 'Pay ' + formatTotal(job.quote)}</button>
        <button type="button" className="btn btn-ghost" onClick={() => refresh().catch(error => setState(previous => ({ ...previous, error: error.message })))}>Refresh payment status</button>
      </>}
    {state.error && <p role="alert" style={{ color: 'var(--danger)' }}>{state.error}</p>}
    <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Payment details are handled by the payment provider. Returning from checkout never counts as payment confirmation.</p>
  </section>;
}
