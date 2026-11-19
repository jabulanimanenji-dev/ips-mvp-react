// Vercel serves a read-only IPS design preview, never the production Express API.
// Return a truthful unavailable status for *all* /api routes. Real IPS workspaces
// run on the separately secured backend after genuine readiness verification.
export default function handler(_req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(503).json({
    success:false,ready:false,backend:'not_connected',
    error:'This IPS website is a read-only design preview. Account sign-in, private quotations, messaging and payments require the verified IPS backend.'
  });
}
