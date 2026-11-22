// Regression: only the current MongoDB delivery lease holder may settle a job.
// Runs against a disposable local MongoDB 7 database; never connects to IPS production.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {claimNotificationDelivery,settleNotificationDelivery} from '../src/routes-support.mjs';

if(process.env.CI!=='true')throw Error('Lease regression may only run in isolated CI.');
const connection=await mongoose.createConnection('mongodb://127.0.0.1:27017',{
 dbName:'ips_academic_delivery_lease_ci_'+crypto.randomBytes(6).toString('hex'),
 serverSelectionTimeoutMS:10000
}).asPromise();
const db=connection.db,collection=db.collection('delivery_jobs');
let checks=0;
const lease=()=> 'LEASE-'+crypto.randomBytes(9).toString('hex').toUpperCase();
const virtualNow=new Date(Date.now()+12*60000);
const before=new Date(virtualNow.getTime()-5000);
const makeJob=async id=>collection.insertOne({
 id,status:'pending',createdAt:before,nextAttemptAt:before,attempts:0
});
try{
 await makeJob('test-stale-success');
 const first=await claimNotificationDelivery(collection,{now:virtualNow,leaseId:lease()});
 assert.equal(first.id,'test-stale-success');checks++;
 assert.equal(await claimNotificationDelivery(collection,{now:virtualNow,leaseId:lease()}),null);
 checks++;
 await collection.updateOne({id:first.id},{$set:{lockedAt:new Date(virtualNow.getTime()-90000)}});
 const newer=await claimNotificationDelivery(collection,{now:virtualNow,leaseId:lease()});
 assert.equal(newer.id,first.id);assert.notEqual(newer.leaseId,first.leaseId);checks++;
 const staleSuccess=await settleNotificationDelivery(collection,first,{
  $set:{status:'provider_accepted',providerMessageId:'invalid-old-receipt'}});
 assert.equal(staleSuccess.matchedCount,0);checks++;
 const staleFailure=await settleNotificationDelivery(collection,first,{
  $set:{status:'failed',lastError:'old-worker-timeout'}});
 assert.equal(staleFailure.matchedCount,0);checks++;
 const current=await settleNotificationDelivery(collection,newer,{
  $set:{status:'provider_accepted',providerMessageId:'actual-new-receipt'},
  $unset:{lockedAt:'',leaseId:''}});
 assert.equal(current.modifiedCount,1);
 const final=await collection.findOne({id:first.id});
 assert.equal(final.status,'provider_accepted');
 assert.equal(final.providerMessageId,'actual-new-receipt');
 assert.equal(final.leaseId,undefined);checks++;

 await makeJob('test-parallel');
 const claims=await Promise.all(Array.from({length:12},()=>
  claimNotificationDelivery(collection,{now:virtualNow,leaseId:lease()})));
 const winners=claims.filter(Boolean);
 assert.equal(winners.length,1);assert.equal(winners[0].id,'test-parallel');checks++;
 const won=await settleNotificationDelivery(collection,winners[0],{
  $set:{status:'provider_accepted'},$unset:{lockedAt:'',leaseId:''}});
 assert.equal(won.modifiedCount,1);
 assert.equal((await collection.findOne({id:'test-parallel'})).status,'provider_accepted');checks++;
 await assert.rejects(()=>claimNotificationDelivery(collection,{now:virtualNow,leaseId:'not-a-valid-lease'}),
  /fresh IPS delivery lease/);checks++;
 console.log('IPS_ACADEMIC_MONGO_DELIVERY_LEASE_GREEN '+checks+
  ' stale-success, stale-failure, atomic parallel claims and owner-only settlements');
}finally{
 await db.dropDatabase();
 await connection.close();
}
