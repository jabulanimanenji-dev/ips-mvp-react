// Version-controlled IPS Academic Specialist confidentiality and service agreement.
// Keep this text alongside the actual agreement acceptance record; new versions
// must use a new version ID and must not silently alter earlier acceptances.
import crypto from 'node:crypto';

export const SPECIALIST_AGREEMENT_VERSION='IPS-ACADEMIC-SPECIALIST-2026-11-v1';
export const SPECIALIST_AGREEMENT_TEXT=[
 'IPS ACADEMIC SERVICES — SPECIALIST CONFIDENTIALITY AND SERVICE AGREEMENT',
 '1. I will use genuine professional identity and accurate qualifications and accept only work within my verified competence and available capacity.',
 '2. I will safeguard Student/Researcher identities, files, enquiries, credentials and academic matters, use them solely for the assigned IPS service, and disclose them only to personnel expressly authorized for that work.',
 '3. I will not solicit, independently contact or disclose a Student/Researcher or their work outside approved IPS written channels. I will not subcontract or transfer private academic work without documented IPS authorization.',
 '4. I will preserve academic integrity. I will not invent data, references or results, impersonate student authorship, guarantee grades, or provide assistance forbidden by applicable institutional rules.',
 '5. I will use reasonable device, account and document security; promptly report suspected exposure or loss; and follow IPS instructions for secure return, deletion and legally required retention of private work.',
 '6. I will submit work and revisions through the authorized IPS case record, cooperate with quality review, and accurately describe any limitations, uncertainty and sources.',
 '7. IPS may maintain a tamper-evident record of this agreement, my verified identity, authorized assignments, communications and quality decisions for contractual, accountability and security purposes.',
 '8. Each commissioned job will have its own approved scope, deadline and applicable terms. This agreement by itself does not promise assignments or payments.',
 'By entering my full professional name and selecting acceptance, I confirm that I have read and agree to the terms above. IPS records the exact version and checksum accepted.'
].join('\n\n');

export const SPECIALIST_AGREEMENT=Object.freeze({
 version:SPECIALIST_AGREEMENT_VERSION,
 title:'Specialist Confidentiality and Service Agreement',
 text:SPECIALIST_AGREEMENT_TEXT,
 sha256:crypto.createHash('sha256').update(SPECIALIST_AGREEMENT_TEXT).digest('hex')
});
