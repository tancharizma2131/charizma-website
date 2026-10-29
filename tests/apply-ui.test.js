import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile(new URL('../be-charizmatic.html',import.meta.url),'utf8');
const script=await readFile(new URL('../js/apply.js',import.meta.url),'utf8');
const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
async function fixture({enabled=true,failFinish=false}={}){
 const dom=new JSDOM(html,{url:'http://localhost:8052/be-charizmatic.html',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 await new Promise(resolve=>{if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',resolve,{once:true});else resolve();});
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.URL.createObjectURL=()=>`blob:test-${Math.random()}`;w.URL.revokeObjectURL=()=>{};
 w.Image=class {naturalWidth=1000;naturalHeight=1500;async decode(){}};
 w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
 w.HTMLCanvasElement.prototype.toBlob=function(callback,type){callback(new w.Blob(['webp-test'],{type}));};
 const calls=[];let failed=false;
 w.fetch=async(url,options={})=>{
  calls.push({url,options});if(!options.method||options.method==='GET')return {ok:true,status:200,json:async()=>({enabled})};
  if(url.startsWith('https://uploads.example'))return {ok:true,status:200,json:async()=>({})};
  const body=JSON.parse(options.body);
  if(body.action==='start')return {ok:true,status:200,json:async()=>({uploads:['headshot','angle','half','full'].map(kind=>({kind,url:`https://uploads.example/${kind}`}))})};
  if(failFinish&&!failed){failed=true;return {ok:false,status:503,json:async()=>({error:'Could not confirm. Please try again.'})};}
  return {ok:true,status:200,json:async()=>({reference:body.id})};
 };
 w.eval(script);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await wait();
 const form=w.document.querySelector('#application-form');
 const values={fullName:'Alex Test',birthDate:'2004-04-18',location:'Bangkok, Thailand',email:'alex@example.com',instagram:'@alex.test',height:'175',bust:'82',waist:'60',hips:'90',tattoos:'No',piercings:'Yes',source:'Instagram'};
 for(const [key,value] of Object.entries(values))form.elements.namedItem(key).value=value;
 const submit=()=>form.dispatchEvent(new w.Event('submit',{cancelable:true}));
 async function upload(){for(const kind of ['headshot','angle','half','full']){const input=w.document.querySelector(`#photo-${kind}`);Object.defineProperty(input,'files',{value:[new w.File(['jpeg'],'photo.jpg',{type:'image/jpeg'})],configurable:true});input.dispatchEvent(new w.Event('change'));}await wait();}
 return {dom,w,form,calls,submit,upload};
}
test('reference digitals cannot count as applicant uploads',async()=>{
 const f=await fixture();try{f.submit();await wait();f.submit();await wait();assert.match(f.w.document.querySelector('#photo-error').textContent,/own four digitals/);assert.equal(f.calls.filter(c=>c.options.method==='POST').length,0);}finally{f.dom.window.close();}
});
test('a retry after uncertain completion reuses the same ticket and does not upload again',async()=>{
 const f=await fixture({failFinish:true});try{
  f.submit();await f.upload();f.submit();await wait();assert.match(f.w.document.querySelector('#submission-feedback').textContent,/try again/);f.submit();await wait();
  const bodies=f.calls.filter(c=>c.url==='/api/submit'&&c.options.method==='POST').map(c=>JSON.parse(c.options.body));
  assert.equal(bodies.filter(b=>b.action==='start').length,1);assert.equal(bodies.filter(b=>b.action==='finish').length,2);assert.equal(new Set(bodies.map(b=>b.id)).size,1);assert.equal(f.calls.filter(c=>c.url.startsWith('https://uploads.example')).length,4);assert.equal(f.w.document.querySelector('#application-confirmation').hidden,false);
 }finally{f.dom.window.close();}
});
test('form remains disabled until private submission services are configured',async()=>{
 const f=await fixture({enabled:false});try{assert.equal(f.w.document.querySelector('#next-step').disabled,true);f.submit();assert.equal(f.calls.filter(c=>c.options.method==='POST').length,0);}finally{f.dom.window.close();}
});
for(const phase of ['start','upload','finish'])test(`${phase} timeout restores controls and retries without losing progress`,async()=>{
 const f=await fixture();try{
  f.submit();await f.upload();
  const nativeTimeout=f.w.setTimeout.bind(f.w);f.w.setTimeout=(callback,ms,...args)=>nativeTimeout(callback,ms>=15000?5:ms,...args);
  const original=f.w.fetch;const attempts=[];let stalled=false,abortedSignal;
  f.w.fetch=async(url,options={})=>{
   attempts.push({url,options});const body=url==='/api/submit'?JSON.parse(options.body):null;
   if(!stalled&&((phase==='start'&&body?.action==='start')||(phase==='finish'&&body?.action==='finish')||(phase==='upload'&&url.endsWith('/angle')))){
    stalled=true;abortedSignal=options.signal;
    // Finish deliberately stalls during response-body parsing, after headers arrive.
    if(phase==='finish')return {ok:true,status:200,json:()=>new Promise(()=>{})};
    return new Promise(()=>{});
   }
   return original(url,options);
  };
  f.submit();await wait();
  assert.equal(abortedSignal.aborted,true);assert.equal(f.w.document.querySelector('#next-step').disabled,false);
  assert.equal(f.w.document.querySelector('#next-step').textContent,'Retry application');
  assert.match(f.w.document.querySelector('#submission-feedback').textContent,/took too long/);
  assert.equal(f.form.elements.fullName.value,'Alex Test');assert.equal(f.w.document.querySelectorAll('.has-photo').length,4);
  f.submit();await wait();
  assert.equal(f.w.document.querySelector('#application-confirmation').hidden,false);
  const bodies=attempts.filter(c=>c.url==='/api/submit').map(c=>JSON.parse(c.options.body));
  assert.equal(new Set(bodies.map(b=>b.id)).size,1);assert.equal(new Set(bodies.map(b=>b.token)).size,1);
  if(phase==='upload'){
   assert.equal(bodies.filter(b=>b.action==='start').length,2);
   assert.equal(attempts.filter(c=>c.url.endsWith('/headshot')).length,1);
  }
  if(phase==='finish')assert.equal(attempts.filter(c=>c.url.startsWith('https://uploads.example')).length,4);
 }finally{f.dom.window.close();}
});
test('an expired upload URL is refreshed without repeating confirmed uploads',async()=>{
 const f=await fixture();try{
  f.submit();await f.upload();const original=f.w.fetch;let expired=false;const attempts=[];
  f.w.fetch=async(url,options)=>{
   attempts.push({url,options});
   if(!expired&&url.endsWith('/angle')){expired=true;return {ok:false,status:403,json:async()=>({error:'Expired token'})};}
   return original(url,options);
  };
  f.submit();await wait();assert.equal(f.w.document.querySelector('#next-step').disabled,false);
  f.submit();await wait();assert.equal(f.w.document.querySelector('#application-confirmation').hidden,false);
  const starts=attempts.filter(c=>c.url==='/api/submit'&&JSON.parse(c.options.body).action==='start').map(c=>JSON.parse(c.options.body));
  assert.equal(starts.length,2);assert.equal(starts[0].id,starts[1].id);assert.equal(starts[0].token,starts[1].token);
  assert.equal(attempts.filter(c=>c.url.endsWith('/headshot')).length,1);
 }finally{f.dom.window.close();}
});
test('invalid first-step fields stop progression and show linked errors that clear on editing',async()=>{
 const f=await fixture();try{
  const invalid={instagram:'https://example.com/person',email:'alex@localhost',birthDate:'1899-01-01',fullName:'   ',height:'175.2'};
  for(const [key,value] of Object.entries(invalid))f.form.elements.namedItem(key).value=value;
  f.submit();
  assert.equal(f.w.document.querySelector('[data-step="1"]').hidden,true);
  for(const key of Object.keys(invalid)){
   const el=f.form.elements.namedItem(key);assert.equal(el.getAttribute('aria-invalid'),'true');
   assert.ok(f.w.document.getElementById(`${el.id}-error`).textContent);assert.match(el.getAttribute('aria-describedby'),new RegExp(el.id+'-error'));
  }
  const corrections={instagram:'https://www.instagram.com/alex.test/?utm_source=qr',email:'alex@example.com',birthDate:'2004-04-18',fullName:'Alex Test',height:'175.5'};
  for(const [key,value] of Object.entries(corrections)){const el=f.form.elements.namedItem(key);el.value=value;el.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(el.hasAttribute('aria-invalid'),false);}
  f.submit();assert.equal(f.w.document.querySelector('[data-step="1"]').hidden,false);
 }finally{f.dom.window.close();}
});
test('server field errors return to the affected step without discarding photos',async()=>{
 const f=await fixture();try{
  f.submit();await f.upload();const original=f.w.fetch;
  f.w.fetch=async(url,options)=>url==='/api/submit'?{ok:false,status:400,json:async()=>({error:'Please check your email address.',field:'email'})}:original(url,options);
  f.submit();await wait();
  assert.equal(f.w.document.querySelector('[data-step="0"]').hidden,false);
  assert.equal(f.form.elements.email.getAttribute('aria-invalid'),'true');assert.equal(f.w.document.activeElement,f.form.elements.email);
  assert.equal(f.w.document.querySelectorAll('.has-photo').length,4);
 }finally{f.dom.window.close();}
});
test('portfolio validation rejects non-web links without attempting an upload',async()=>{
 const f=await fixture();try{
  f.submit();await f.upload();f.form.elements.portfolio.value='javascript:alert(1)';f.submit();
  assert.equal(f.form.elements.portfolio.getAttribute('aria-invalid'),'true');assert.equal(f.calls.filter(c=>c.options.method==='POST').length,0);
 }finally{f.dom.window.close();}
});
