import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pages} from '../web/pages.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),publicRoot=path.join(root,'dist');
const failures=[];
let checked=0;
async function checkReference(owner,reference,{publicPath=false}={}){
  if(!reference||/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference))return;
  const pathname=decodeURIComponent(reference.split(/[?#]/)[0]);
  if(!pathname||pathname.startsWith('/api/'))return;
  const target=publicPath&&pathname.startsWith('/')?path.join(publicRoot,pathname):path.resolve(path.dirname(owner),pathname);
  try{
    const info=await stat(target);
    if(info.isDirectory()&&publicPath)await stat(path.join(target,'index.html'));
    checked++;
  }catch{failures.push(`${path.relative(root,owner)} → ${reference}`);}
}
async function walk(directory){
  const entries=await readdir(directory,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    const target=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await walk(target));else files.push(target);
  }
  return files;
}
const htmlFiles=(await walk(publicRoot)).filter(file=>file.endsWith('.html'));
const expectedPages=new Set(pages.map(page=>path.normalize(page.path)));
for(const file of htmlFiles){
  if(!expectedPages.has(path.relative(publicRoot,file)))failures.push(`Unused generated page: ${path.relative(root,file)}`);
  const source=await readFile(file,'utf8');
  for(const match of source.matchAll(/\b(?:href|src|action)="([^"]*)"/g))await checkReference(file,match[1],{publicPath:true});
}
for(const directory of ['dist','web','server','scripts','database','tests']){
  for(const file of (await walk(path.join(root,directory))).filter(file=>/\.(?:mjs|js|css)$/.test(file))){
    const source=await readFile(file,'utf8');
    if(file.endsWith('.css')){
      for(const match of source.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))await checkReference(file,match[1],{publicPath:true});
    }else{
      for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)){
        if(match[1].startsWith('.'))await checkReference(file,match[1]);
      }
    }
  }
}
for(const file of [path.join(root,'README.md'),...(await walk(path.join(root,'docs'))).filter(file=>file.endsWith('.md'))]){
  const source=await readFile(file,'utf8');
  for(const match of source.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g))await checkReference(file,match[1]);
}
const manifest=JSON.parse(await readFile(path.join(publicRoot,'assets/samples/manifest.json'),'utf8'));
for(const resource of manifest.resources)await checkReference(path.join(publicRoot,'index.html'),resource.url,{publicPath:true});
if(failures.length)throw new Error(`Broken or unused references:\n${failures.join('\n')}`);
console.log(`${htmlFiles.length} active pages and ${checked} local references verified.`);
