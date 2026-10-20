import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pages} from '../web/pages.mjs';
import {layout} from '../web/layout.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const check=process.argv.includes('--check');
for(const page of pages){const target=path.join(root,page.path),html=layout(page)+'\n';if(check){if(await readFile(target,'utf8')!==html)throw new Error(`Page needs rebuild: ${page.path}`);}else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,html);}}
console.log(`${pages.length} separate museum pages ${check?'verified':'built'}.`);
