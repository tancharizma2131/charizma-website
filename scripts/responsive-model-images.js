import sharp from 'sharp';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sizes='(max-width: 899px) calc((100vw - 50px) / 2), (max-width: 1200px) calc((100vw - 520px) / 2), (min-width: 1800px) 300px, calc((100vw - 600px) / 4)';
let originals=0,small=0,count=0;
for(const model of ['kaia','ksenia','polly','uli','nik']){
 const path=join(root,`${model}.html`);let html=await readFile(path,'utf8');
 const document=new JSDOM(html).window.document;
 for(const img of document.querySelectorAll('.model-feed img')){
  const src=img.getAttribute('src');const source=join(root,src);const metadata=await sharp(source).metadata();
  const candidates=[];
  for(const width of [400,800]){
   if(width>=metadata.width)continue;
   const relative=src.replace(/^image\//,'image/responsive/').replace(/\.webp$/,`-${width}.webp`);
   const target=join(root,relative);await mkdir(dirname(target),{recursive:true});
   let fresh=false;try{fresh=(await stat(target)).mtimeMs>=(await stat(source)).mtimeMs;}catch{}
   if(!fresh)await sharp(source).resize({width,withoutEnlargement:true}).webp({quality:84}).toFile(target);
   candidates.push(`${relative} ${width}w`);
  }
  candidates.push(`${src} ${metadata.width}w`);
  if(process.argv.includes('--update-markup')){
   const old=img.outerHTML;
   img.setAttribute('width',metadata.width);img.setAttribute('height',metadata.height);
   img.setAttribute('srcset',candidates.join(', '));img.setAttribute('sizes',sizes);
   // Preserve existing source formatting outside the individual image tags.
   html=html.replace(old,img.outerHTML);
  }
  originals+=(await stat(source)).size;
  small+=(await stat(join(root,candidates[0].split(' ')[0]))).size;count++;
 }
 if(process.argv.includes('--update-markup'))await writeFile(path,html);
}
console.log(`Prepared ${count} profile images; full set ${(originals/1048576).toFixed(2)} MiB, smallest variants ${(small/1048576).toFixed(2)} MiB (${Math.round((1-small/originals)*100)}% less asset weight).`);
