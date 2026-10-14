const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unexpected build output path');
fs.rmSync(output, {recursive: true, force: true});
fs.mkdirSync(output, {recursive: true});
for (const name of ['index.html', 'privacy.html', 'styles.css', 'main.js', 'favicon.ico',
  'site.webmanifest', 'robots.txt', 'sitemap.xml', 'assets', '_headers', '_routes.json']) {
  fs.cpSync(path.join(root, name), path.join(output, name), {recursive: true});
}
console.log('Vyratec built in dist/. Cloudflare bundles root functions/ separately.');
