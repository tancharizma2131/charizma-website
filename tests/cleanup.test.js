import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupExpiredSubmissions } from '../server/notifications.js';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
process.env.SUPABASE_SECRET_KEY='test-secret';
process.env.APPLICATIONS_ENABLED='true';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const ticket=(id,completed=false)=>({id,completed_at:completed?'2026-01-01T00:00:00Z':null,expires_at:'2026-01-02T00:00:00Z',manifest:[{kind:'headshot',type:'image/png'}],cleaned_at:null});
test('cleanup preserves backlog manifests and prunes only cleaned old tickets',async()=>{
 const original=globalThis.fetch;const tickets=Array.from({length:23},(_,i)=>ticket(`ticket-${i}`,i===0));let pendingDeletes=0,finalDeletes=0;
 globalThis.fetch=async(url,options)=>{
  const u=new URL(url);
  if(options.method==='GET'){
   assert.equal(u.searchParams.get('order'),'expires_at.asc,id.asc');assert.equal(u.searchParams.get('cleaned_at'),'is.null');
   return reply(tickets.filter(t=>!t.cleaned_at).slice(0,Number(u.searchParams.get('limit'))));
  }
  if(u.pathname.includes('/storage/')){if(u.pathname.endsWith('application-uploads'))pendingDeletes++;else finalDeletes++;return reply([]);}
  if(options.method==='PATCH'){
   const record=tickets.find(t=>'eq.'+t.id===u.searchParams.get('id'));Object.assign(record,JSON.parse(options.body));return reply([]);
  }
  assert.equal(options.method,'DELETE');assert.equal(u.searchParams.get('cleaned_at'),'not.is.null');assert.ok(u.searchParams.get('created_at').startsWith('lt.'));
  for(let i=tickets.length-1;i>=0;i--)if(tickets[i].cleaned_at)tickets.splice(i,1);
  return reply([]);
 };
 try{
  await cleanupExpiredSubmissions();assert.equal(tickets.length,3);assert.ok(tickets.every(t=>t.manifest.length===1));assert.equal(pendingDeletes,20);assert.equal(finalDeletes,19);
  await cleanupExpiredSubmissions();assert.equal(tickets.length,0);assert.equal(pendingDeletes,23);
 }finally{globalThis.fetch=original;}
});
for(const failure of ['pending','normalized','record'])test(`cleanup retains the manifest when ${failure} cleanup fails`,async()=>{
 const original=globalThis.fetch;const t=ticket('failed-ticket');let marked=false,pruned=false;
 globalThis.fetch=async(url,options)=>{
  if(options.method==='GET')return reply([t]);
  if((failure==='pending'&&url.endsWith('application-uploads'))||(failure==='normalized'&&url.endsWith('application-digitals'))||(failure==='record'&&options.method==='PATCH'))return reply({},503);
  if(options.method==='PATCH')marked=true;
  if(options.method==='DELETE'&&url.includes('/rest/'))pruned=true;
  return reply([]);
 };
 try{await assert.rejects(()=>cleanupExpiredSubmissions());assert.equal(marked,false);assert.equal(pruned,false);assert.equal(t.manifest.length,1);}finally{globalThis.fetch=original;}
});
