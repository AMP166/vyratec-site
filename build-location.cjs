const fs = require('node:fs');
const path = require('node:path');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg>';

module.exports = function buildLocation(root, output, header, footer, programmes) {
  const page = JSON.parse(fs.readFileSync(path.join(root, 'content/sydney.json'), 'utf8'));
  if (page.slug !== 'ai-training-sydney') throw new Error('Unexpected location page slug');
  const url = `https://vyratec.com/${page.slug}`;
  const schema = {'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':'https://vyratec.com/#organisation',name:'Vyratec',url:'https://vyratec.com/',logo:'https://vyratec.com/assets/vyratec-wordmark-transparent.png',email:'shop@vyratec.com',location:{'@type':'Place',name:'North Sydney, NSW, Australia'},areaServed:{'@type':'Country',name:'Australia'}},
    {'@type':'Service','@id':`${url}#service`,name:page.heading,description:page.description,url,serviceType:'Corporate AI training',provider:{'@id':'https://vyratec.com/#organisation'},areaServed:[{'@type':'City',name:'Sydney'},{'@type':'Country',name:'Australia'}]},
    {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:'https://vyratec.com/'},{'@type':'ListItem',position:2,name:'AI training in Sydney',item:url}]}
  ]};
  const sections = page.sections.map(section => `<section class="programme-section"><h2>${escape(section.heading)}</h2>${(section.paragraphs || []).map(paragraph=>`<p>${escape(paragraph)}</p>`).join('')}${section.items ? `<ul>${section.items.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>` : ''}</section>`).join('\n');
  const programmeMarks = {'executive-ai-briefing':'executive','applied-ai-training':'applied','ai-workflow-automation':'automation','custom-corporate-workshops':'custom'};
  const programmeOptions = page.programmes.map(option => {
    const programme = programmes.find(programme=>programme.slug === option.slug);
    const mark = programmeMarks[option.slug];
    if (!programme || !mark) throw new Error(`Unknown Sydney programme: ${option.slug}`);
    return `<article class="programme-row"><img class="programme-mark" src="/assets/training-${mark}.svg" width="88" height="72" alt=""><div class="programme-content"><div class="programme-overview"><p class="micro">${escape(programme.audience)}</p><h3><a href="/training/${programme.slug}">${escape(programme.name)}</a></h3><span class="programme-duration">${escape(programme.duration)}</span></div><p>${escape(option.summary)}</p><div class="programme-links"><a class="text-link" href="/training/${programme.slug}" aria-label="Explore ${escape(programme.name)}">Explore programme ${arrow}</a></div></div></article>`;
  }).join('');
  const html = `<!doctype html>
<html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}">
<meta name="theme-color" content="#102744"><link rel="canonical" href="${url}">
<meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:locale" content="en_AU"><meta property="og:site_name" content="Vyratec"><meta property="og:image" content="https://vyratec.com/assets/vyratec-og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(page.title)}"><meta name="twitter:description" content="${escape(page.description)}"><meta name="twitter:image" content="https://vyratec.com/assets/vyratec-og.png">
<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><link rel="preload" href="/assets/fonts/dm-sans-latin-variable.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/styles.css"><script defer src="/main.js"></script>
<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>
</head><body id="top"><a class="skip-link" href="#main">Skip to content</a>${header}
<main id="main" class="wrap training-page sydney-page">
<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>AI training in Sydney</span></nav>
<div class="training-intro"><div><h1>${escape(page.heading)}</h1><p class="training-lead">${escape(page.intro)}</p><a class="button" href="/#contact" data-cta="programme-custom">Discuss your training needs ${arrow}</a></div>
<dl class="training-facts"><div><dt>Based in</dt><dd>North Sydney, NSW</dd></div><div><dt>Delivery</dt><dd>At your Sydney workplace or online</dd></div><div><dt>Audience</dt><dd>Business, manufacturing, engineering and operations teams</dd></div></dl></div>
<section class="sydney-programmes" aria-labelledby="sydney-programmes-heading"><div class="programme-layout"><div class="programme-intro"><p class="eyebrow">Training programmes</p><h2 id="sydney-programmes-heading">${escape(page.programmeHeading)}</h2><p>${escape(page.programmeIntro)}</p><div class="programme-format"><span>On site or online</span><span>Tailored to your team</span></div></div><div class="programme-index">${programmeOptions}</div></div></section>
<div class="training-content"><article>${sections}</article>
<aside class="training-aside"><h2>Plan a session for your team</h2><p>Tell us your team’s roles, approximate group size, preferred delivery format and the work you want to improve. We’ll discuss a suitable scope.</p><a class="text-link" href="/#contact" data-cta="programme-custom">Discuss your training needs ${arrow}</a><h3>Explore our programmes</h3><ul>${programmes.map(programme=>`<li><a href="/training/${programme.slug}">${escape(programme.name)}</a></li>`).join('')}</ul><a class="text-link" href="/#experience">Our AI systems and training experience</a></aside></div>
</main>${footer}</body></html>`;
  fs.writeFileSync(path.join(output, `${page.slug}.html`), html);
  return {url,lastmod:page.lastmod};
};
