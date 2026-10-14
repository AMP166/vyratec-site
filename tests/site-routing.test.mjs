import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
let preview, base;
before(async () => {
  preview = spawn(process.execPath, ['dev-server.mjs'], {cwd:new URL('../', import.meta.url), env:{...process.env, PORT:'0'}, stdio:['ignore','pipe','pipe']});
  base = await new Promise((resolve,reject) => {
    const timeout = setTimeout(()=>reject(new Error('Preview did not start')), 15000);
    let output='';
    preview.stdout.on('data',data=>{output+=data;const url=output.match(/Local: (http:\/\/127\.0\.0\.1:\d+)/);if(url){clearTimeout(timeout);resolve(url[1]);}});
    preview.on('error',reject);
    preview.on('exit',code=>{if(code){clearTimeout(timeout);reject(new Error('Preview failed: '+code));}});
  });
});
after(()=>preview?.kill());

test('missing and nested URLs return the branded page with a genuine 404 status', async()=>{
  for(const route of ['/page-that-does-not-exist','/training/unknown/deep-page']) {
    const response=await fetch(base+route);
    assert.equal(response.status,404);
    const html=await response.text();
    assert.match(html,/This page couldn’t be found/);
    assert.match(html,/<meta name="robots" content="noindex,follow">/);
    assert.match(html,/href="\/#programmes"/);
  }
});

test('legacy crawler/privacy URLs redirect to the authoritative resources',async()=>{
  for(const [oldPath,newPath] of [['/robots.xml','/robots.txt'],['/privacy.html','/privacy'],['/index.html','/']]) {
    const response=await fetch(base+oldPath,{redirect:'manual'});
    assert.equal(response.status,301);
    assert.equal(response.headers.get('location'),newPath);
    assert.equal((await fetch(base+newPath)).status,200);
  }
  const robots=await (await fetch(base+'/robots.txt')).text();
  assert.match(robots,/Disallow: \/api\//);
  assert.match(robots,/Sitemap: https:\/\/vyratec.com\/sitemap.xml/);
  assert.doesNotMatch(robots,/Disallow: \/(?:assets|$)/m);
});

test('the sitemap lists real, unique canonical pages with distinct search metadata',async()=>{
  const sitemapResponse=await fetch(base+'/sitemap.xml');
  assert.equal(sitemapResponse.status,200);
  assert.match(sitemapResponse.headers.get('content-type'),/xml/);
  const sitemap=await sitemapResponse.text();
  assert.match(sitemap,/<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
  assert.equal(urls.length,6);
  assert.equal(new Set(urls).size,6);
  const titles=new Set(), descriptions=new Set();
  for(const url of urls) {
    const response=await fetch(base+new URL(url).pathname,{redirect:'manual'});
    assert.equal(response.status,200,url);
    const html=await response.text();
    assert.equal((html.match(/<h1\b/g)||[]).length,1,url);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`),url);
    const title=html.match(/<title>(.*?)<\/title>/)[1];
    const description=html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(title),'duplicate title'); titles.add(title);
    assert.ok(!descriptions.has(description),'duplicate description'); descriptions.add(description);
    if(url.includes('/training/')) {
      const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      assert.ok(schema['@graph'].some(item=>item['@type']==='Service'&&item.url===url));
      assert.match(html,/href="\/\?programme=[a-z-]+#contact"/);
    }
  }
});
