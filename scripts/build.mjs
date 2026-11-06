import {cp, mkdir, readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await mkdir(output, {recursive:true});
// Explicit public assets: never publish diagnostic files, source MP4s or credentials.
const assets = ['index.html','script.js','style.css','favicon.svg','portfolio-player.js','r2-fallback.js','_headers','fonts','photo'];
for (const name of assets) await cp(path.join(root,name), path.join(output,name), {recursive:true});
const html = await readFile(path.join(output,'index.html'),'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
  const ref = match[1];
  if (/^(?:https?:|data:|mailto:|tel:|#)/.test(ref)) continue;
  await stat(path.join(output,ref));
}
console.log(`Built ${output}`);
