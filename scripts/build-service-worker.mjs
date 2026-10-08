import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const files = (await readdir(dist, { recursive: true }))
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => /\.(html|js|css)$/.test(file) && file !== 'sw.js')
  .sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(new URL(file, dist)));
const cache = `balance-shell-${hash.digest('hex').slice(0, 12)}`;
const urls = ['/', ...files.map((file) => `/${file}`)];
await writeFile(
  new URL('sw.js', dist),
  `
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(urls)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('balance-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !FILES.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
`,
);
console.log(`Offline shell: ${urls.length} files, ${cache}`);
