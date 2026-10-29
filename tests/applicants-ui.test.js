import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const id='fa2ee240-caed-42ab-a2be-62ce3bc60306';
const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
const html=await readFile(new URL('../applicants.html',import.meta.url),'utf8');
const script=await readFile(new URL('../js/applicants.js',import.meta.url),'utf8');
async function fixture(empty=false){
 let record={id,full_name:'<img src=x onerror=alert(1)>',location:'Bangkok',email:'alex@example.com',height:175,status:'New',source:'Website',submitted_at:'2026-10-28T10:00:00Z',birth_date:'2004-04-18',photos:[],notes:[],events:[],legacy_photo_urls:['javascript:alert(1)'],portfolio_url:'javascript:alert(2)'};
 const dom=new JSDOM(html,{url:'http://localhost:8052/applicants.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window; w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(url,options={})=>{
  if(options.method==='POST'){
   const body=JSON.parse(options.body);
   if(body.action==='status'){record.status=body.status;record.events.unshift({id:'event',event_type:'status_changed',details:{from:'New',to:body.status},occurred_at:'2026-10-28T10:01:00Z'});}
   if(body.action==='note'){record.notes.unshift({id:'note',body:body.text,created_at:'2026-10-28T10:02:00Z'});}
   return {ok:true,status:200,json:async()=>({ok:true})};
  }
  const p=new URL(url,'http://localhost:8052').searchParams;
  return {ok:true,status:200,json:async()=>structuredClone(p.has('id')?record:{records:empty?[]:[record],total:empty?0:1,page:0})};
 };
 w.eval(script);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await wait();
 return {dom,w,record};
}
test('real dashboard empty state contains no fictional applicants',async()=>{
 const {dom,w}=await fixture(true);try{assert.equal(w.document.querySelector('#empty-results').hidden,false);assert.equal(w.document.querySelectorAll('.applicant-row').length,0);assert.equal(w.document.querySelector('#result-count').textContent,'0 applicants');}finally{dom.window.close();}
});
test('applicant text and historical links cannot inject markup or scripts',async()=>{
 const {dom,w}=await fixture();try{assert.equal(w.document.querySelector('.row-name').textContent,'<img src=x onerror=alert(1)>');assert.equal(w.document.querySelector('#applicant-review h2').textContent,'<img src=x onerror=alert(1)>');assert.equal(w.document.querySelectorAll('[onerror], a[href^="javascript:"]').length,0);}finally{dom.window.close();}
});
test('status and notes render the saved response after revisiting a record',async()=>{
 const {dom,w,record}=await fixture();try{
  let select=w.document.querySelector('#review-status-select');select.value='Reviewing';select.dispatchEvent(new w.Event('change'));await wait();
  assert.equal(record.status,'Reviewing');assert.equal(w.document.querySelector('#review-status-select').value,'Reviewing');assert.match(w.document.querySelector('.activity-list').textContent,/New to Reviewing/);
  let input=w.document.querySelector('#review-note');input.value='A clear portrait';input.dispatchEvent(new w.Event('input'));w.document.querySelector('.note-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait();
  assert.equal(record.notes[0].body,'A clear portrait');
  w.document.querySelector('#refresh-records').click();await wait();assert.match(w.document.querySelector('.note-list').textContent,/A clear portrait/);
 }finally{dom.window.close();}
});
test('pagination replaces rows, handles the last page, and filters reset to page one',async()=>{
 const {dom,w,record}=await fixture(true);
 try{
  w.fetch=async url=>{
   const p=new URL(url,'http://localhost').searchParams;
   if(p.has('id'))return {ok:true,status:200,json:async()=>structuredClone({...record,id:p.get('id')})};
   const page=Number(p.get('page'));const count=page===2?10:25;
   return {ok:true,status:200,json:async()=>({records:Array.from({length:count},(_,i)=>({...record,id:`page-${page}-${i}`})),total:60})};
  };
  w.document.querySelector('#refresh-records').click();await wait();
  assert.equal(w.document.querySelectorAll('.applicant-row').length,25);
  assert.equal(w.document.querySelector('#previous-page').disabled,true);
  w.document.querySelector('#next-page').click();await wait();
  assert.equal(w.document.querySelectorAll('.applicant-row').length,25);
  assert.equal(w.document.querySelector('#page-count').textContent,'26–50 of 60');
  w.document.querySelector('#next-page').click();await wait();
  assert.equal(w.document.querySelectorAll('.applicant-row').length,10);
  assert.equal(w.document.querySelector('#next-page').disabled,true);
  w.document.querySelector('#source-filter').dispatchEvent(new w.Event('change'));await wait();
  assert.equal(w.document.querySelector('#page-count').textContent,'1–25 of 60');
 }finally{dom.window.close();}
});
for(const outcome of ['success','failure'])test(`delayed note save protects the draft and recovers after ${outcome}`,async()=>{
 const {dom,w,record}=await fixture();
 try{
  const original=w.fetch;let release;let posts=0;
  w.fetch=async(url,options={})=>{
   if(options.method!=='POST')return original(url,options);
   posts++;await new Promise(resolve=>{release=resolve;});
   if(outcome==='failure')return {ok:false,status:503,json:async()=>({error:'Temporary failure'})};
   return original(url,options);
  };
  const input=w.document.querySelector('#review-note');const form=w.document.querySelector('.note-form');const button=form.querySelector('button');
  input.value='  Keep this note  ';input.dispatchEvent(new w.Event('input'));
  form.dispatchEvent(new w.Event('submit',{cancelable:true}));
  assert.equal(input.readOnly,true);assert.equal(button.disabled,true);assert.equal(button.textContent,'Saving…');
  form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(posts,1);
  release();await wait();
  const current=w.document.querySelector('#review-note');
  assert.equal(current.readOnly,false);assert.equal(w.document.querySelector('.note-form button').disabled,false);
  if(outcome==='failure'){
   assert.equal(current.value,'  Keep this note  ');assert.equal(record.notes.length,0);
   w.document.querySelector('#refresh-records').click();await wait();
   assert.equal(w.document.querySelector('#review-note').value,'  Keep this note  ');
  }else{assert.equal(current.value,'');assert.equal(record.notes[0].body,'Keep this note');}
 }finally{dom.window.close();}
});
test('a newer draft survives completion of an older pending save',async()=>{
 const {dom,w,record}=await fixture();try{
  const original=w.fetch;let release;
  w.fetch=async(url,options={})=>{if(options.method==='POST')await new Promise(resolve=>{release=resolve;});return original(url,options);};
  const input=w.document.querySelector('#review-note');input.value='First note';input.dispatchEvent(new w.Event('input'));
  w.document.querySelector('.note-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  // A newer editor instance or programmatic draft update must also be preserved.
  input.value='Newer draft';input.dispatchEvent(new w.Event('input'));release();await wait();
  assert.equal(record.notes[0].body,'First note');assert.equal(w.document.querySelector('#review-note').value,'Newer draft');
 }finally{dom.window.close();}
});
