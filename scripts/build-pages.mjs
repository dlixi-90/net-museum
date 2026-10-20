import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pages} from '../web/pages.mjs';
import {layout} from '../web/layout.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const check=process.argv.includes('--check');
for(const page of pages){const target=path.join(root,page.path),html=layout(page)+'\n';if(check){if(await readFile(target,'utf8')!==html)throw new Error(`Page needs rebuild: ${page.path}`);}else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,html);}}
const redirect='<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Đang mở bộ sưu tập — Nét</title><script type="module" src="/search-redirect.js"></script><noscript><meta http-equiv="refresh" content="0;url=/bo-suu-tap/"></noscript></head><body><p><a href="/bo-suu-tap/">Mở bộ sưu tập</a></p></body></html>\n';
const legacySearch=path.join(root,'tim-kiem/index.html');
if(check){if(await readFile(legacySearch,'utf8')!==redirect)throw new Error('Search redirect needs rebuild.');}
else{await mkdir(path.dirname(legacySearch),{recursive:true});await writeFile(legacySearch,redirect);}
console.log(`${pages.length} museum pages and legacy search redirect ${check?'verified':'built'}.`);
