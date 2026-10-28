import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/applicants.js';
import { listQuery, photoUrl } from '../server/applicants.js';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='test-public-key';
const id='fa2ee240-caed-42ab-a2be-62ce3bc60306';
const photo='aa2ee240-caed-42ab-a2be-62ce3bc60306';
const originalFetch=globalThis.fetch;
const user={id,email:'info@charizma-mgmt.com',email_confirmed_at:'2026-01-01'};
const result=(data,status=200,range=null)=>({ok:status<400,status,json:async()=>data,headers:new Headers(range?{'content-range':range}:{})});
async function call({method='GET',body,url='/api/applicants',cookie='charizma_access=valid'}={}){
 const req={method,body,url,headers:{host:'localhost:8052',origin:'http://localhost:8052','content-type':'application/json',cookie}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}};await handler(req,res);return res;
}
test('anonymous requests cannot read or mutate applicant records',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw new Error();};
 try{for(const method of ['GET','POST'])assert.equal((await call({method,cookie:'',body:{action:'status',id,status:'Archived'}})).statusCode,401);assert.equal(calls,0);}finally{globalThis.fetch=originalFetch;}
});
test('list pagination and filter queries cannot alter the selected fields',()=>{
 const q=listQuery(new URLSearchParams({search:'a\",status.eq.Archived)',page:'2',source:'Google Form',status:'Reviewing'}));
 const parsed=new URL(q.path,'https://example.com').searchParams;
 assert.equal(parsed.get('offset'),'100');assert.equal(parsed.get('source'),'eq.Google Form');assert.equal(parsed.get('status'),'eq.Reviewing');assert.match(parsed.get('or'),/\\"/);
 assert.equal(parsed.get('select').includes('legacy_response'),false);
 assert.throws(()=>listQuery(new URLSearchParams({status:'Other'})),/INVALID_FILTER/);
 assert.throws(()=>listQuery(new URLSearchParams({page:'-1'})),/INVALID_FILTER/);
});
test('status changes send only the allowed field under the staff session',async()=>{
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return result(user);
  assert.equal(options.method,'PATCH');assert.deepEqual(JSON.parse(options.body),{status:'Reviewing'});assert.equal(options.headers.Authorization,'Bearer valid');
  return result([{id,status:'Reviewing'}]);
 };
 try{const res=await call({method:'POST',body:{action:'status',id,status:'Reviewing',email:'injected@example.com'}});assert.equal(res.statusCode,200);assert.equal(res.headers['Cache-Control'],'no-store');}finally{globalThis.fetch=originalFetch;}
});
test('note author comes from the verified user and blank notes are rejected',async()=>{
 let writes=0;globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return result(user);
  writes++;assert.deepEqual(JSON.parse(options.body),{application_id:id,author_id:id,body:'Review this portfolio'});return result([{id:photo}]);
 };
 try{
  assert.equal((await call({method:'POST',body:{action:'note',id,text:'  ',author_id:'other'}})).statusCode,400);
  assert.equal((await call({method:'POST',body:{action:'note',id,text:'  Review this portfolio  ',author_id:'other'}})).statusCode,200);assert.equal(writes,1);
 }finally{globalThis.fetch=originalFetch;}
});
test('forged or unapproved sessions do not reach database operations',async()=>{
 let db=0;globalThis.fetch=async(url)=>{if(url.endsWith('/auth/v1/user'))return result({...user,email:'other@example.com'});db++;return result([]);};
 try{assert.equal((await call()).statusCode,401);assert.equal(db,0);}finally{globalThis.fetch=originalFetch;}
});
test('database permission failures never appear as a successful empty list',async()=>{
 globalThis.fetch=async(url)=>url.endsWith('/auth/v1/user')?result(user):result({message:'private database details'},403);
 try{const res=await call();assert.equal(res.statusCode,503);assert.equal('records' in res.body,false);assert.equal(JSON.stringify(res.body).includes('private database details'),false);}finally{globalThis.fetch=originalFetch;}
});
test('signed photos require matching application and photo IDs, and expire after five minutes',async()=>{
 let requests=0;globalThis.fetch=async(url,options)=>{
  requests++;
  if(url.includes('/rest/v1/')){const q=new URL(url).searchParams;assert.equal(q.get('application_id'),`eq.${id}`);assert.equal(q.get('id'),`eq.${photo}`);return result([{storage_path:`${id}/headshot.jpg`}]);}
  assert.deepEqual(JSON.parse(options.body),{expiresIn:300});return result({signedURL:'/object/sign/application-digitals/one?token=temporary'});
 };
 try{assert.match(await photoUrl({token:'valid'},id,photo),/^https:\/\/example.supabase.co\/storage\/v1\/object\/sign\//);assert.equal(requests,2);}finally{globalThis.fetch=originalFetch;}
});
