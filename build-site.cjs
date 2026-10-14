const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = __dirname;
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unexpected build output path');
fs.rmSync(output, {recursive: true, force: true});
fs.mkdirSync(output, {recursive: true});
for (const name of ['index.html', 'privacy.html', 'styles.css', 'main.js', 'favicon.ico',
  'site.webmanifest', 'robots.txt', 'sitemap.xml', 'assets', '_headers', '_routes.json']) {
  fs.cpSync(path.join(root, name), path.join(output, name), {recursive: true});
}
// A new URL for changed assets prevents browser or zone caches from mixing releases.
const assetNames = {};
for (const name of ['styles.css', 'main.js']) {
  const content = fs.readFileSync(path.join(root, name));
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 10);
  const parsed = path.parse(name);
  assetNames[name] = `${parsed.name}.${hash}${parsed.ext}`;
  fs.writeFileSync(path.join(output, assetNames[name]), content);
}
for (const name of ['index.html', 'privacy.html']) {
  const html = fs.readFileSync(path.join(root, name), 'utf8')
    .replaceAll('href="/styles.css"', `href="/${assetNames['styles.css']}"`)
    .replaceAll('src="/main.js"', `src="/${assetNames['main.js']}"`);
  fs.writeFileSync(path.join(output, name), html);
}
console.log('Vyratec built in dist/. Cloudflare bundles root functions/ separately.');
