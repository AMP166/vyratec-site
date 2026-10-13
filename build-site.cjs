const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const output = path.join(root, 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'privacy.html', 'styles.css', 'main.js',
                    'favicon.ico', 'site.webmanifest', 'robots.txt', 'sitemap.xml', 'assets']) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(output, name), { recursive: true });
}
console.log('Vyratec static site built in dist/');