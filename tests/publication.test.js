import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'dist');
async function files(dir,prefix='') {
 let result=[];for(const entry of await readdir(dir,{withFileTypes:true})) {
  const path=prefix+entry.name;
  if(entry.isDirectory())result.push(...await files(join(dir,entry.name),path+'/'));else result.push(path);
 }return result;
}
test('deployment publishes generated output and retains separate function entrypoints',async()=>{
 const config=JSON.parse(await readFile(join(root,'vercel.json'),'utf8'));
 assert.equal(config.outputDirectory,'dist');assert.equal(config.buildCommand,'npm run build');
 for(const name of ['staff','applicants','submit','notifications']) await access(join(root,'api',name+'.js'));
});
test('public output excludes credentials, backend source, imports, SQL, tests and demos',async()=>{
 const published=await files(output);
 assert.ok(published.includes('index.html'));assert.ok(published.includes('staff.html'));assert.ok(published.includes('applicants.html'));
 assert.ok(published.includes('js/applicants.js'));assert.ok(published.includes('image/models/women/kaia/Digitals/02.webp'));
 for(const path of published)assert.doesNotMatch(path,/(^|\/)(api|server|supabase|scripts|tests|node_modules|\.git)(\/|$)|(^|\/)\.|\.(md|sql|csv|zip|py|json|log)$|preview\.html$|js\/(application|applicants)-preview\.js$/i,path);
});
test('all local HTML and CSS asset references resolve inside the public output',async()=>{
 const published=await files(output);
 async function check(value,source) {
  if(!value||/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(value))return;
  const url=new URL(value,new URL(source,'https://public.invalid/'));
  const path=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
  assert.ok(published.includes(path),`${source} references missing public asset ${path}`);
 }
 for(const path of published.filter(p=>p.endsWith('.html'))) {
  const document=new JSDOM(await readFile(join(output,path),'utf8')).window.document;
  for(const el of document.querySelectorAll('[src],link[href],a[href]'))await check(el.getAttribute('src')||el.getAttribute('href'),path);
 }
 for(const path of published.filter(p=>p.endsWith('.css'))) {
  const css=await readFile(join(output,path),'utf8');
  for(const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))await check(match[1],path);
 }
});
