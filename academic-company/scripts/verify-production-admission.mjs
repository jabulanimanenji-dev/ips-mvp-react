// Release-gate acceptance: synthetic attestations, not genuine production evidence.
import assert from 'node:assert/strict';
import {assertProductionAdmission,productionAdmissionRequirements} from '../src/release-admission.mjs';

const sourceCommit='a'.repeat(40);
const baseline={
 environment:'production',productionActivated:true,legacyDataMigrated:true,
 legacyDataReconciled:true,databaseRestoreVerified:true,privateFileRestoreVerified:true,
 emailProviderVerified:true,telegramProviderVerified:true,realMalwareScannerVerified:true,
 securityAcceptanceVerified:true,ownerAccepted:true,
 sourceCommit,acceptedBy:'Nyoro, Root Admin',acceptedAt:'2026-11-21T21:00:00.000Z'
};
let n=0;
const reject=(record,sha=sourceCommit)=>{
 assert.throws(()=>assertProductionAdmission(record,sha),/IPS production admission denied/);n++;
};
assert.ok(productionAdmissionRequirements().length>=12);
assert.equal(assertProductionAdmission(baseline,sourceCommit).admitted,true);n++;
reject(null);reject({});reject({...baseline,environment:'evaluation'});
reject({...baseline,productionActivated:false});
reject({...baseline,legacyDataMigrated:false});
reject({...baseline,sourceCommit:'b'.repeat(40)});
reject(baseline,'b'.repeat(40));
reject(baseline,'not-a-commit');
reject({...baseline,acceptedBy:''});
reject({...baseline,acceptedAt:'invalid'});
for(const field of ['legacyDataReconciled','databaseRestoreVerified','privateFileRestoreVerified',
 'emailProviderVerified','telegramProviderVerified','realMalwareScannerVerified',
 'securityAcceptanceVerified','ownerAccepted']){
 reject({...baseline,[field]:false});
 reject({...baseline,[field]:'true'});
}
console.log('IPS_ACADEMIC_PRODUCTION_ADMISSION_GATE_GREEN '+n+' verified positive and negative source-bound checks; no production credentials or records touched');
