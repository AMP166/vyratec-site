const fs = require('node:fs');
const path = require('node:path');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg>';
module.exports = function buildPages(root, output) {
  const programmes = JSON.parse(fs.readFileSync(path.join(root, 'content/programmes.json'), 'utf8'));
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const header = home.match(/<header\b[\s\S]*?<\/header>/)[0].replaceAll('href="#', 'href="/#');
  const footer = home.match(/<footer\b[\s\S]*?<\/footer>/)[0].replace(/href="#(?!top)/g, 'href="/#').replace('href="#top" aria-label="Vyratec home"', 'href="/" aria-label="Vyratec home"');
  fs.mkdirSync(path.join(output, 'training'), {recursive:true});
  for (const programme of programmes) {
    if (!/^[a-z-]+$/.test(programme.slug)) throw new Error('Invalid programme slug');
    const url = `https://vyratec.com/training/${programme.slug}`;
    const contact = `/?programme=${programme.slug}#contact`;
    const programmeHeader = header.replaceAll('href="/#contact"', `href="${contact}"`);
    const programmeFooter = footer.replaceAll('href="/#contact"', `href="${contact}"`);
    const schema = {'@context':'https://schema.org','@graph':[
      {'@type':'Organization','@id':'https://vyratec.com/#organisation',name:'Vyratec',url:'https://vyratec.com/',logo:'https://vyratec.com/assets/vyratec-wordmark-transparent.png',email:'shop@vyratec.com'},
      {'@type':'Service','@id':`${url}#service`,name:programme.name,description:programme.description,url,serviceType:'Corporate AI training',provider:{'@id':'https://vyratec.com/#organisation'},areaServed:{'@type':'Country',name:'Australia'}},
      {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:'https://vyratec.com/'},{'@type':'ListItem',position:2,name:programme.name,item:url}]}
    ]};
    const sections = programme.sections.map(section => `<section class="programme-section"><h2>${escape(section.heading)}</h2>${(section.paragraphs||[]).map(p=>`<p>${escape(p)}</p>`).join('')}${section.items?`<ul>${section.items.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>`:''}</section>`).join('\n');
    const html = `<!doctype html>
<html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(programme.title)}</title><meta name="description" content="${escape(programme.description)}">
<meta name="theme-color" content="#102744"><link rel="canonical" href="${url}">
<meta property="og:title" content="${escape(programme.title)}"><meta property="og:description" content="${escape(programme.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:locale" content="en_AU"><meta property="og:site_name" content="Vyratec"><meta property="og:image" content="https://vyratec.com/assets/vyratec-og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(programme.title)}"><meta name="twitter:description" content="${escape(programme.description)}"><meta name="twitter:image" content="https://vyratec.com/assets/vyratec-og.png">
<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"><script defer src="/main.js"></script>
<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>
</head><body id="top"><a class="skip-link" href="#main">Skip to content</a>${programmeHeader}
<main id="main" class="wrap training-page">
<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>${escape(programme.name)}</span></nav>
<div class="training-intro"><div><h1>${escape(programme.heading)}</h1><p class="training-lead">${escape(programme.intro)}</p><a class="button" href="${contact}" data-cta="${programme.cta}">Discuss your training needs ${arrow}</a></div>
<dl class="training-facts"><div><dt>Who it’s for</dt><dd>${escape(programme.audience)}</dd></div><div><dt>Programme length</dt><dd>${escape(programme.duration)}</dd></div><div><dt>Delivery</dt><dd>On site or online, scoped with your organisation</dd></div></dl></div>
<div class="training-content"><article>${sections}<section class="programme-section"><h2>Questions about this programme</h2><div class="faq-list">${programme.questions.map(q=>`<details><summary>${escape(q.question)}<span aria-hidden="true">+</span></summary><p>${escape(q.answer)}</p></details>`).join('')}</div></section></article>
<aside class="training-aside"><h2>Plan training for your team</h2><p>Tell us the roles involved, approximate group size, current tools and the work you want to improve. We’ll discuss the right scope and delivery format.</p><a class="text-link" href="${contact}" data-cta="${programme.cta}">Enquire about this programme ${arrow}</a><h3>Other programmes</h3><ul>${programmes.filter(p=>p.slug!==programme.slug).map(p=>`<li><a href="/training/${p.slug}">${escape(p.name)}</a></li>`).join('')}</ul><a class="text-link" href="/#experience">Our manufacturing and supply chain experience</a></aside></div>
</main>${programmeFooter}</body></html>`;
    fs.writeFileSync(path.join(output, 'training', `${programme.slug}.html`), html);
  }
  const urls = [{url:'https://vyratec.com/',lastmod:'2026-10-14'},...programmes.map(p=>({url:`https://vyratec.com/training/${p.slug}`,lastmod:p.lastmod})),{url:'https://vyratec.com/privacy',lastmod:'2026-10-14'}];
  fs.writeFileSync(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item=>`  <url><loc>${item.url}</loc><lastmod>${item.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
};
