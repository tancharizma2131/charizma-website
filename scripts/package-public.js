import { readdir, lstat, mkdir, copyFile, rm } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const publicFiles = [
 'index.html','women.html','men.html','kaia.html','ksenia.html','polly.html','uli.html','nik.html','about.html','be-charizmatic.html','apply.html','staff.html','applicants.html',
 'style.min.css','home.css','roster.css','model.css','about.css','application-preview.css','apply.css','applicants-preview.css','applicants.css','staff.css',
 'js/main.min.js','js/footer.js','js/apply.js','js/applicants.js','js/staff.js'
];
const mediaExtensions = new Set(['.webp','.jpg','.jpeg','.png','.svg','.gif','.ico','.woff','.woff2','.ttf','.otf']);
export async function packagePublic(root, output = join(root,'dist')) {
 await rm(output,{recursive:true,force:true});
 async function copy(relative) {
  const source=join(root,relative), stat=await lstat(source);
  if(!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Public asset must be a regular file: ${relative}`);
  const target=join(output,relative);await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
 }
 for(const path of publicFiles) await copy(path);
 async function media(relative) {
  for(const entry of await readdir(join(root,relative),{withFileTypes:true})) {
   if(entry.name.startsWith('.')) continue;
   const path=join(relative,entry.name);
   if(entry.isSymbolicLink()) throw new Error(`Symbolic links are not permitted in public assets: ${path}`);
   if(entry.isDirectory()) await media(path);
   else if(mediaExtensions.has(extname(entry.name).toLowerCase())) await copy(path);
  }
 }
 await media('image');await media('fonts');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 await packagePublic(root);console.log('✓ Packaged public pages and assets in dist/');
}
