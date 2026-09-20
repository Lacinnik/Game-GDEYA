import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../public-web/public/', import.meta.url);
const registry = JSON.parse(await readFile(new URL('platform/products.registry.json', root)));
const urls = [...new Set(registry.entities.flatMap(e => e.entrypoints.map(p => p.url.split('#')[0])).filter(url => url.startsWith('https://lacinnik.github.io/')))];
const results = await Promise.all(urls.map(async url => {
  try {
    const response = await fetch(url, {signal:AbortSignal.timeout(25000)});
    const html = await response.text();
    return {url, status:response.status, title:html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || null};
  } catch(error) { return {url, status:null, error:error.message}; }
}));
await mkdir(new URL('platform/revision/', root), {recursive:true});
await writeFile(new URL('platform/revision/links.json', root), JSON.stringify({checked_at:new Date().toISOString(), boundary:'HTTP availability only; not functional acceptance', results},null,2)+'\n');
console.log(JSON.stringify(results));
