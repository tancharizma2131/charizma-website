import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
const root=new URL('../',import.meta.url);
test('all 120 profile photos have accurate dimensions and lightweight uncropped candidates',async()=>{
 let count=0;
 for(const model of ['kaia','ksenia','polly','uli','nik']){
  const doc=new JSDOM(await readFile(new URL(model+'.html',root),'utf8')).window.document;
  for(const img of doc.querySelectorAll('.model-feed img')){
   const source=img.getAttribute('src'),original=new URL(source,root);const metadata=await sharp(await readFile(original)).metadata();
   assert.equal(Number(img.width),metadata.width);assert.equal(Number(img.height),metadata.height);
   const candidates=img.getAttribute('srcset').split(',').map(s=>s.trim().split(/\s+/));
   assert.ok(candidates.length<=3);assert.equal(candidates.at(-1)[0],source);
   for(const [path,descriptor] of candidates){
    const url=new URL(path,root);const m=await sharp(await readFile(url)).metadata();
    assert.equal(m.width,parseInt(descriptor));assert.ok(Math.abs(m.height/m.width-metadata.height/metadata.width)<.01);
    if(path!==source)assert.ok((await stat(url)).size<(await stat(original)).size);
   }
   count++;
  }
 }
 assert.equal(count,120);
});
