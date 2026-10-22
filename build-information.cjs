const fs = require('node:fs');
const path = require('node:path');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg>';
module.exports = function buildInformation(root, output, header, footer) {
  const pages = JSON.parse(fs.readFileSync(path.join(root, 'content/information.json'), 'utf8'));
  const head = (title, description, slug) => `<!doctype html><html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} | Vyratec</title><meta name="description" content="${escape(description)}">
<meta name="theme-color" content="#102744"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
${slug ? `<link rel="canonical" href="https://vyratec.com/${slug}"><meta property="og:title" content="${escape(title)} | Vyratec"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><meta property="og:url" content="https://vyratec.com/${slug}"><meta property="og:image" content="https://vyratec.com/assets/vyratec-og.png">` : '<meta name="robots" content="noindex,follow">'}
<link rel="preload" href="/assets/fonts/dm-sans-latin-variable.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/styles.css"><script defer src="/main.js"></script>
</head><body id="top"><a class="skip-link" href="#main">Skip to content</a>${header}`;
  for (const page of pages) {
    if (!/^[a-z-]+$/.test(page.slug)) throw new Error('Invalid information page slug');
    const date = new Date(`${page.updated}T12:00:00Z`).toLocaleDateString('en-AU', {day:'numeric',month:'long',year:'numeric',timeZone:'Australia/Sydney'});
    const html = `${head(page.title, page.description, page.slug)}
<main id="main" class="wrap information-page">
<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>${escape(page.title)}</span></nav>
<div class="information-heading"><p class="eyebrow">Website information</p><h1>${escape(page.title)}</h1><p class="information-lead">${escape(page.intro)}</p><p class="updated">Last updated <time datetime="${page.updated}">${date}</time></p></div>
<div class="information-layout"><aside class="information-index"><nav aria-label="On this page"><p>On this page</p><ol>${page.sections.map(s=>`<li><a href="#${s.id}">${escape(s.heading)}</a></li>`).join('')}</ol></nav><div class="information-related"><p>Related information</p>${pages.filter(p=>p.slug!==page.slug).map(p=>`<a href="/${p.slug}">${escape(p.title)}</a>`).join('')}</div></aside>
<article class="information-content" aria-label="${escape(page.title)}">${page.sections.map(s=>`<section id="${s.id}"><h2>${escape(s.heading)}</h2>${s.html}</section>`).join('\n')}<div class="information-contact"><h2>A question about this page?</h2><p>Please <a href="mailto:shop@vyratec.com">contact us</a>.</p></div></article></div>
</main>${footer}</body></html>`;
    fs.writeFileSync(path.join(output, `${page.slug}.html`), html);
  }
  fs.writeFileSync(path.join(output, '404.html'), `${head('Page not found', 'Find corporate AI training programmes or contact Vyratec.', null)}
<main id="main" class="wrap not-found"><div class="error-code" aria-hidden="true">404</div><div class="error-copy"><p class="eyebrow">Page not found</p><h1>This page couldn’t be found.</h1><p>The link may be out of date, or the address may have been entered incorrectly.</p><div class="error-actions"><a class="button" href="/">Return to Vyratec ${arrow}</a><a class="text-link" href="/#programmes">View training programmes</a></div><div class="error-contact"><p>Looking for corporate AI training?</p><p><a href="/#contact">Discuss your training needs</a> or <a href="mailto:shop@vyratec.com">contact us</a>.</p></div></div></main>${footer}</body></html>`);
  return pages;
};
