// Fail-closed release gate for authentic IPS Academic Services production.
// A CI success, a green health endpoint, or a Render deployment does not equal admission.
const EXPECTED_KEYS=[
 'legacyDataReconciled','databaseRestoreVerified','privateFileRestoreVerified',
 'emailProviderVerified','telegramProviderVerified','realMalwareScannerVerified',
 'securityAcceptanceVerified','ownerAccepted'
];
const validSha=s=>typeof s==='string'&&/^[0-9a-f]{40}$/.test(s);
export function assertProductionAdmission(control,sourceSha){
 if(!validSha(sourceSha))throw Error('IPS production admission denied: deploy source revision is not pinned.');
 if(!control||typeof control!=='object'||
  control.environment!=='production'||control.productionActivated!==true||
  control.legacyDataMigrated!==true)
  throw Error('IPS production admission denied: governed migration and production activation have not been accepted.');
 if(control.sourceCommit!==sourceSha)
  throw Error('IPS production admission denied: accepted source revision differs from deployed revision.');
 for(const field of EXPECTED_KEYS)if(control[field]!==true)
  throw Error('IPS production admission denied: release verification missing for '+field+'.');
 if(typeof control.acceptedBy!=='string'||control.acceptedBy.trim().length<3||
  typeof control.acceptedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(control.acceptedAt)||
  !Number.isFinite(Date.parse(control.acceptedAt)))
  throw Error('IPS production admission denied: signed owner release acceptance is missing.');
 return {admitted:true,sourceCommit:sourceSha,verifiedGates:EXPECTED_KEYS.length};
}
export function productionAdmissionRequirements(){
 return ['environment=production','productionActivated=true','legacyDataMigrated=true',
  'sourceCommit matches source revision','acceptedBy and acceptedAt',...EXPECTED_KEYS];
}
