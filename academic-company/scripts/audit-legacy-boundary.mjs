// Read-only historical IPS audit. No individual record, email, password, token,
// financial reference, message text or private document is exported.
// The API connection MUST have only read privileges on legacy "ips".
import mongoose from 'mongoose';
import {summarizeLegacyBoundary} from '../src/legacy-reconciliation.mjs';

const uri=process.env.IPS_LEGACY_READONLY_MONGODB_URI;
if(!uri||String(uri).includes('ips_academic_services_2026')||
 String(uri).includes('ips-academic-prod')){
 console.error('IPS legacy audit requires a dedicated read-only legacy connection, not a production or new academic database.');
 process.exit(2);
}
const specs={
 clients:['status'],writers:['application_status'],admins:['status'],
 orders:['market_id','service_type','status'],
 servicerequests:['family','category','status'],
 invoices:['status','payment_status'],
 supporttickets:['status'],platformfiles:['state','visibility'],
 channelmessages:['direction','status']
};
const links={
 orderClient:['orders','clients','client_id','client_id'],
 serviceRequestClient:['servicerequests','clients','client_id','client_id'],
 invoiceOrder:['invoices','orders','order_id','order_id'],
 fileOrder:['platformfiles','orders','order_id','order_id'],
 messageContact:['channelmessages','channelcontacts','contact_id','_id']
};
let connection;
try{
 connection=await mongoose.createConnection(uri,{
  dbName:'ips',serverSelectionTimeoutMS:10000,maxPoolSize:2,readPreference:'secondaryPreferred'
 }).asPromise();
 const db=connection.db;
 const input={joins:{}};
 for(const [name,fields] of Object.entries(specs)){
  const key=Object.fromEntries(fields.map(x=>[x,'$'+x]));
  const rows=await db.collection(name).aggregate([
   {$group:{_id:key,count:{$sum:1}}},{$sort:{count:-1}},{$limit:300}
  ],{maxTimeMS:10000}).toArray();
  input[name]=rows.map(r=>({...r._id,count:r.count}));
 }
 for(const [name,[from,to,localField,foreignField]] of Object.entries(links)){
  const rows=await db.collection(from).aggregate([
   {$lookup:{from:to,localField,foreignField,as:'links'}},
   {$group:{_id:{$gt:[{$size:'$links'},0]},count:{$sum:1}}}
  ],{maxTimeMS:15000}).toArray();
  input.joins[name]={
   matched:rows.find(r=>r._id===true)?.count||0,
   unmatched:rows.find(r=>r._id===false)?.count||0
  };
 }
 const report=summarizeLegacyBoundary(input);
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}catch{
 console.error('IPS legacy read-only aggregate audit failed. No migration or database write was attempted.');
 process.exitCode=1;
}finally{
 await connection?.close().catch(()=>{});
}
