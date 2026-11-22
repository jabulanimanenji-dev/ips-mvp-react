// Fail-closed external persistence for FICTIONAL academic review data only.
// Never point the review service at the company's historical or production DB.
export const REVIEW_ATLAS_HOST='ips-academic-review-fre.1w7baaf.mongodb.net';
export const REVIEW_DATABASE='ips_academic_sandbox';
export function assertSyntheticReviewAtlas(uri){
 let parsed;
 try{parsed=new URL(String(uri||''))}
 catch{throw Error('IPS review persistence URL is invalid.')}
 if(parsed.protocol!=='mongodb+srv:'||
    parsed.hostname!==REVIEW_ATLAS_HOST||
    parsed.pathname!=='/'+REVIEW_DATABASE||
    !parsed.username||!parsed.password||
    decodeURIComponent(parsed.password).length<20||
    parsed.hash||
    parsed.searchParams.get('tls')==='false'||
    parsed.searchParams.get('ssl')==='false')
  throw Error('IPS review persistence must use only the dedicated synthetic free Atlas cluster and database, with a strong private database password.');
 return {hostname:REVIEW_ATLAS_HOST,database:REVIEW_DATABASE,syntheticOnly:true};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 assertSyntheticReviewAtlas(process.env.MONGODB_URI);
 console.log('IPS_REVIEW_ATLAS_BOUNDARY_PASS synthetic data, dedicated cluster and TLS required');
}
