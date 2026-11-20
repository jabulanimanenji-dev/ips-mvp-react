// Publication payment policy: the new IPS can accept private requests,
// manage quotes, vet specialists and communicate before a payment provider
// is selected. Never create a payment link solely because old Stripe keys
// happen to exist in a recycled Render environment.
export const paymentLaunchState=(env=process.env)=>{
  const requested=String(env.IPS_PAYMENTS_ENABLED||'').trim().toLowerCase()==='true';
  const stripeKey=String(env.STRIPE_SECRET_KEY||'').trim();
  const webhook=String(env.STRIPE_WEBHOOK_SECRET||'').trim();
  let urlOk=false;
  try{
    const appUrl=new URL(String(env.PUBLIC_APP_URL||''));
    urlOk=appUrl.protocol==='https:'&&appUrl.hostname.length>3&&!appUrl.username&&!appUrl.password;
  }catch{}
  const staging=String(env.IPS_STAGING_MODE||'').toLowerCase()==='true';
  const evaluation=String(env.IPS_EVALUATION_MODE||'').toLowerCase()==='true';
  const keyModeValid=staging?/^sk_test_[A-Za-z0-9_]{12,}$/.test(stripeKey):
    env.NODE_ENV==='production'?/^sk_live_[A-Za-z0-9_]{12,}$/.test(stripeKey):
    /^sk_(?:test|live)_[A-Za-z0-9_]{12,}$/.test(stripeKey);
  const configured=keyModeValid&&/^whsec_[A-Za-z0-9_=-]{12,}$/.test(webhook)&&urlOk;
  return Object.freeze({
    enabled:Boolean(requested&&configured&&!evaluation),
    pending:!requested||!configured||evaluation,
    label:'Payment integration pending',
    notice:'IPS can review your request and provide a written quotation. Payment collection is not enabled; do not transfer money or share card details until IPS announces a verified payment method.'
  });
};
