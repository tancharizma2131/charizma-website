import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { validateApplication,normalizePhoto,startSubmission,finishSubmission,tokenHash,MAX_UPLOAD,clientIP } from '../server/submissions.js';
import { deliverNotifications } from '../server/notifications.js';
import handler from '../api/submit.js';
const fields={fullName:'Alex Test',birthDate:'2004-04-18',location:'Bangkok, Thailand',email:'alex@example.com',instagram:'@alex.test',height:'175',bust:'82',waist:'60',hips:'90',tattoos:'No',piercings:'Yes',source:'Instagram',portfolio:''};
const kinds=['headshot','angle','half','full'];const manifest=kinds.map(kind=>({kind,type:'image/png',size:100}));
const id='fa2ee240-caed-42ab-a2be-62ce3bc60306',token='a'.repeat(64);
const originalFetch=globalThis.fetch;
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='test-public';process.env.SUPABASE_SECRET_KEY='sb_secret_test_only';process.env.APPLICATIONS_ENABLED='true';process.env.RESEND_ALERTS_KEY='test-alerts';process.env.APP_ORIGIN='http://127.0.0.1:8052';
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const req={socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:8052',origin:'http://127.0.0.1:8052','content-type':'application/json'}};
test('validates every required field, real calendar dates, Instagram, measurements and four photo types',()=>{
 const result=validateApplication(fields,manifest);assert.equal(result.data.tattoos,false);assert.equal(result.data.piercings,true);assert.equal(result.data.height,175);
 for(const replacement of [{birthDate:'2004-02-31'},{birthDate:'2999-01-01'},{height:''},{height:'Infinity'},{height:'175.2'},{instagram:'javascript:alert(1)'},{portfolio:'data:text/html,hello'},{tattoos:'Maybe'},{email:'not-an-email'}])assert.throws(()=>validateApplication({...fields,...replacement},manifest));
 assert.throws(()=>validateApplication(fields,[manifest[0],manifest[0],manifest[2],manifest[3]]));assert.throws(()=>validateApplication(fields,manifest.map(f=>({...f,size:MAX_UPLOAD+1}))));
});
test('image processing decodes and strips metadata, and rejects fake or mismatched image formats',async()=>{
 const png=await sharp({create:{width:80,height:120,channels:3,background:'#bbb'}}).png().toBuffer();
 const normalized=await normalizePhoto(png,'image/png');const metadata=await sharp(normalized).metadata();assert.equal(metadata.format,'webp');assert.equal(metadata.width,80);assert.equal(metadata.height,120);assert.equal(metadata.exif,undefined);
 await assert.rejects(()=>normalizePhoto(Buffer.from('<script>bad()</script>'),'image/png'));
 await assert.rejects(()=>normalizePhoto(png,'image/jpeg'));
});
test('production rate limits use Vercel-provided IP, not a browser-supplied forwarding header',()=>{
 process.env.VERCEL='1';try{assert.equal(clientIP({headers:{'x-vercel-forwarded-for':'203.0.113.1','x-forwarded-for':'other'}}),'203.0.113.1');assert.throws(()=>clientIP({headers:{'x-forwarded-for':'203.0.113.1'}}));}finally{delete process.env.VERCEL;}
});
test('start tickets hash identifiers and allow only the four specific pending uploads',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/rpc/start_application_submission'))return response({id,completed_at:null});
  return response({url:`/object/upload/sign/application-uploads/pending/${id}/file.png?token=one-time`});
 };
 try{
  const result=await startSubmission(req,{id,token,fields,files:manifest,website:''});assert.equal(result.uploads.length,4);
  const body=JSON.parse(calls[0].options.body);assert.equal(body.p_token_hash,tokenHash(token));assert.equal(body.p_ip_hash.includes('127.0.0.1'),false);assert.equal(body.p_email_hash.includes('@'),false);
  for(const call of calls){assert.equal(call.options.headers.apikey,'sb_secret_test_only');assert.equal('Authorization' in call.options.headers,false);}
  for(const upload of result.uploads)assert.equal(new URL(upload.url).origin,'https://example.supabase.co');
 }finally{globalThis.fetch=originalFetch;}
});
test('completion retry returns the existing receipt without new uploads or applications',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return response([{id,completed_at:'2026-10-28T00:00:00Z',application_id:id}]);};
 try{assert.deepEqual(await finishSubmission({id,token}),{reference:id});assert.equal(calls,1);}finally{globalThis.fetch=originalFetch;}
});
test('invalid and expired tickets cannot create records',async()=>{
 globalThis.fetch=async()=>response([{id,completed_at:null,expires_at:'2000-01-01T00:00:00Z',manifest}]);
 try{await assert.rejects(()=>finishSubmission({id,token}),/expired/);await assert.rejects(()=>finishSubmission({id,token:'bad'}),/check/);}finally{globalThis.fetch=originalFetch;}
});
test('completion validates all photos and saves application only after normalized private uploads',async()=>{
 const png=await sharp({create:{width:80,height:120,channels:3,background:'#bbb'}}).png().toBuffer();
 let uploads=0,completed=0;const actual=manifest.map(f=>({...f,size:png.length}));
 globalThis.fetch=async(url,options)=>{
  if(url.includes('/rest/v1/application_submissions?'))return response([{id,manifest:actual,completed_at:null,expires_at:'2999-01-01T00:00:00Z'}]);
  if(url.includes('/object/authenticated/application-uploads/'))return new Response(png,{headers:{'Content-Length':String(png.length)}});
  if(url.includes('/object/application-digitals/')&&options.method==='POST'){uploads++;assert.equal(options.headers['Content-Type'],'image/webp');return response({ok:true});}
  if(url.endsWith('/rpc/complete_application_submission')){completed++;assert.equal(uploads,4);const body=JSON.parse(options.body);assert.equal(body.p_photos.length,4);return response(id);}
  if(url.endsWith('/object/application-uploads')&&options.method==='DELETE')return response([]);
  throw new Error('Unexpected request');
 };
 try{assert.deepEqual(await finishSubmission({id,token}),{reference:id});assert.equal(completed,1);}finally{globalThis.fetch=originalFetch;}
});
test('email failures remain retryable with the same idempotency key, without applicant PII in the email',async()=>{
 const patches=[];let emailBody;globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/rpc/claim_application_notifications'))return response([{id,application_id:id,attempts:1}]);
  if(url==='https://api.resend.com/emails'){assert.equal(options.headers['Idempotency-Key'],`charizma-application-${id}`);emailBody=JSON.parse(options.body);return response({error:'unavailable'},503);}
  patches.push(JSON.parse(options.body));return response([]);
 };
 try{const result=await deliverNotifications();assert.equal(result.sent,0);assert.equal(result.pending,true);assert.equal(patches[0].state,'failed');assert.deepEqual(emailBody.to,['info@charizma-mgmt.com']);assert.equal(emailBody.text.includes('2004-04-18'),false);assert.equal(emailBody.text.includes('headshot'),false);}finally{globalThis.fetch=originalFetch;}
});
test('public endpoint rejects cross-origin requests and does not expose secrets in readiness data',async()=>{
 const makeRes=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}});
 let res=makeRes();await handler({...req,method:'POST',headers:{...req.headers,origin:'https://other.example'},body:{action:'start'}},res);assert.equal(res.statusCode,403);
 res=makeRes();await handler({...req,method:'GET'},res);assert.deepEqual(res.body,{enabled:true});assert.equal(JSON.stringify(res.body).includes('sb_secret'),false);
});
