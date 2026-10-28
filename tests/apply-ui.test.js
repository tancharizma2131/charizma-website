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
  if(url.startsWith('https://uploads.example'))return {ok:true,status:200};
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
