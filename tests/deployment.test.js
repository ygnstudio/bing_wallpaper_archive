import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Exercise the actual output for both hosts, including all metadata and local assets.
test('GitHub subpath and Cloudflare root deployments produce usable independent artifacts', () => {
  for (const [cloudflare, base, about] of [
    ['0', 'https://ygnstudio.github.io/bing_wallpaper_archive', 'about.html'],
    ['1', 'https://wallpapers.example.com', 'about'],
  ]) {
    execFileSync(process.execPath, ['scripts/build.js'], {
      cwd: root, env: { ...process.env, CF_PAGES: cloudflare, SITE_URL: base }, stdio: 'pipe',
    });
    const home = read('dist/index.html');
    const aboutHtml = read('dist/about.html');
    assert.ok(home.includes(`rel="canonical" href="${base}/"`));
    assert.ok(aboutHtml.includes(`rel="canonical" href="${base}/${about}"`));
    const jsonLd = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
    assert.equal(JSON.parse(jsonLd).url, `${base}/`);
    assert.ok(read('dist/robots.txt').includes(`${base}/sitemap.xml`));
    assert.ok(read('dist/sitemap.xml').includes(`<loc>${base}/${about}</loc>`));
    if (cloudflare === '1') assert.ok(!home.includes('https://ygnstudio.github.io/bing_wallpaper_archive'));
    for (const html of [home, aboutHtml]) {
      for (const [, path] of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[^\"]*)?"/g)) {
        assert.ok(existsSync(new URL(`../dist/${path}`, import.meta.url)), `Missing asset: ${path}`);
      }
    }
    const manifest = JSON.parse(read('dist/assets/asset-manifest.json'));
    for (const path of manifest.assets) {
      assert.ok(existsSync(new URL(`../dist/${path}`, import.meta.url)), `Missing precache file: ${path}`);
    }
    assert.ok(!read('dist/sw.js').includes('__BUILD_REVISION__'));
    assert.ok(existsSync(new URL('../dist/404.html', import.meta.url)));
    assert.equal(existsSync(new URL('../dist/_headers', import.meta.url)), cloudflare === '1');
    assert.equal(JSON.parse(read('dist/data/index.json')).length, JSON.parse(read('data/index.json')).length);
  }
});

test('service worker resolves precache from scope and only removes its own previous caches', async () => {
  for (const scope of ['https://example.com/', 'https://example.com/bing_wallpaper_archive/']) {
    const listeners = {}, requests = [], deleted = [], precached = [];
    const prefix = `bing-wallpaper:${scope}:`;
    const context = {
      URL, Response, console,
      self: {
        registration: { scope }, location: { origin: 'https://example.com' },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        skipWaiting: async () => {}, clients: { claim: async () => {} },
      },
      fetch: async url => { requests.push(typeof url === 'string' ? url : url.url); return {
        ok: true, json: async () => ({ assets: ['./assets/app.hash.js'] }), clone() { return this; },
      }; },
      caches: {
        keys: async () => [`${prefix}old`, `${prefix}test`, 'another-app', 'bing-wallpaper:https://example.com/other/:old'],
        delete: async name => deleted.push(name),
        open: async () => ({ addAll: async urls => precached.push(...urls), match: async () => null, put: async () => {} }),
      },
    };
    vm.runInNewContext(read('site/assets/sw.js').replace('__BUILD_REVISION__', 'test'), context);
    let pending;
    listeners.install({ waitUntil: promise => { pending = promise; } }); await pending;
    assert.equal(requests[0], `${scope}assets/asset-manifest.json`);
    assert.ok(precached.includes(`${scope}index.html`));
    assert.ok(precached.includes(`${scope}assets/app.hash.js`));
    listeners.activate({ waitUntil: promise => { pending = promise; } }); await pending;
    assert.deepEqual(deleted, [`${prefix}old`]);
    let intercepted = false;
    listeners.fetch({ request: { method: 'GET', url: 'https://www.bing.com/image.jpg' }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
    listeners.fetch({ request: { method: 'GET', url: scope, mode: 'navigate' }, respondWith: promise => { pending = promise; } }); await pending;
    assert.equal(requests.at(-1), scope);
  }
});

test('invalid site URLs fail before a deployment is built', () => {
  for (const site of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/?test=1']) {
    assert.throws(() => execFileSync(process.execPath, ['scripts/build.js'], {
      cwd: root, env: { ...process.env, SITE_URL: site }, stdio: 'pipe',
    }));
  }
});
