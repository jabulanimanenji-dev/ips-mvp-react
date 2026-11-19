import React from 'react';
import QuoteRequestForm from './QuoteRequestForm.jsx';

// Legacy public-enquiry entry is kept as a compatibility wrapper. All entry
// points now use pseudonyms, the same verified written-contact policy and
// the secure, no-call quote workflow. Never resurrect old phone callbacks.
export default function PublicEnquiry(){
  return <section className="ipsa-section ipsa-enquiry" aria-labelledby="ips-enquiry-title">
    <div className="ipsa-wrap">
      <h2 id="ips-enquiry-title">Request written support from IPS</h2>
      <QuoteRequestForm/>
    </div>
  </section>;
}
