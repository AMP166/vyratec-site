import {json, isSameOrigin, readBody, recordEvent, interests} from '../_lib.mjs';

const mailError = 'We couldn’t send your enquiry. Please try again or contact us directly.';
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
function reply(request, payload, status = 200) {
  if (request.headers.get('accept')?.includes('application/json')) return json(payload, status);
  const title = payload.ok ? 'Your enquiry has been sent.' : 'Your enquiry could not be sent.';
  const detail = payload.ok ? `Thank you. We’ll reply to your work email. Enquiry reference: ${payload.reference}` : payload.error;
  return new Response(`<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Training enquiry | Vyratec</title><meta name="robots" content="noindex">
  <link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="preload" href="/assets/fonts/dm-sans-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
</head>
<body id="top">
  <a class="skip-link" href="#enquiry-result">Skip to content</a>
  <header class="site-header"><div class="wrap header-inner">
    <a class="brand" href="/" aria-label="Vyratec home"><img src="/assets/vyratec-wordmark-transparent.png" width="182" height="41" alt="Vyratec"></a>
    <a class="text-link error-header-link" href="/">Home</a>
  </div></header>
  <main id="enquiry-result" class="wrap privacy-page" tabindex="-1">
    <p class="eyebrow">Training enquiry</p>
    <h1>${title}</h1>
    <p>${escapeHtml(detail)}</p>
    <p>For any questions, <a href="mailto:shop@vyratec.com">contact us</a>.</p>
    <div class="error-actions"><a class="text-link" href="/#contact">Return to the enquiry form <svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></a></div>
  </main>
  <footer class="site-footer"><div class="wrap footer-top">
    <div class="footer-brand"><a class="brand" href="/" aria-label="Vyratec home"><img src="/assets/vyratec-wordmark-light.png" width="182" height="41" alt="Vyratec"></a><p>Practical AI training for Australian workplaces.</p></div>
    <nav aria-label="Contact and navigation"><a href="/">Home</a><a href="/#contact">Training enquiries</a><a href="mailto:shop@vyratec.com">Contact us</a></nav>
    <nav aria-label="Website information"><a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a><a href="/cookies">Cookie notice</a><a href="/accessibility">Accessibility</a></nav>
  </div><div class="wrap footer-bottom"><p>© ${new Date().getUTCFullYear()} Vyratec</p><a href="#top">Back to top</a></div></footer>
</body></html>`, {status, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
}

export async function onRequestPost({request, env}) {
  const fail = (error, status) => reply(request, {ok: false, error}, status);
  if (!isSameOrigin(request)) return fail('Please submit your enquiry from the Vyratec website.', 403);
  const type = request.headers.get('content-type') || '';
  if (!type.startsWith('multipart/form-data') && !type.startsWith('application/x-www-form-urlencoded')) return fail('Unsupported form format.', 415);
  let form;
  try {
    const body = await readBody(request, 20000);
    form = await new Request(request.url, {method: 'POST', headers: {'Content-Type': type}, body}).formData();
  } catch (error) { return fail(error instanceof RangeError ? 'Your enquiry is too long. Please shorten the requirements.' : 'Please check your enquiry and try again.', error instanceof RangeError ? 413 : 400); }
  if (String(form.get('website') || '').trim()) return fail('Please check your enquiry and try again.', 400);
  const limits = {name: 140, email: 200, company: 200, interest: 160, message: 4000};
  const fields = {};
  for (const [key, max] of Object.entries(limits)) {
    const value = form.get(key);
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) return fail('Please complete all five fields within the displayed limits.', 400);
    fields[key] = value.trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) || /[\r\n\x00-\x1f]/.test(fields.name + fields.company + fields.email) || !interests.includes(fields.interest)) return fail('Please check your email address and selected programme.', 400);
  if (!env.RESEND_API_KEY || !env.CONTACT_FROM || !env.CONTACT_BCC) return fail(mailError, 503);
  const rawId = form.get('requestId');
  const requestId = typeof rawId === 'string' && /^[a-f0-9-]{36}$/i.test(rawId) ? rawId : crypto.randomUUID();
  // Stable per submission and content: retries do not send duplicate notifications;
  // editing a rejected submission creates a different provider idempotency key.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fields)));
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const reference = `VYR-${requestId.slice(0, 8).toUpperCase()}`;
  const text = [`Corporate training enquiry: ${reference}`, '', `Name: ${fields.name}`, `Work email: ${fields.email}`, `Organisation: ${fields.company}`, `Training interest: ${fields.interest}`, '', 'Requirements:', fields.message].join('\n');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `vyratec/${requestId}/${hash}`},
      body: JSON.stringify({
        from: env.CONTACT_FROM, to: [env.CONTACT_TO || 'shop@vyratec.com'],
        bcc: [env.CONTACT_BCC], reply_to: fields.email,
        subject: `Training enquiry | ${fields.company} | ${reference}`, text
      })
    });
    if (!response.ok) {
      console.error('Enquiry mail provider rejected delivery', response.status);
      return fail(mailError, 502);
    }
    const result = await response.json();
    if (!result.id) return fail(mailError, 502);
    // Stable provider receipt supports deduplicating accepted retries in analytics.
    recordEvent(env, 'enquiry_success', 'contact-form', request, result.id);
    return reply(request, {ok: true, reference});
  } catch { console.error('Enquiry mail delivery unavailable'); return fail(mailError, 502); }
}
export function onRequestGet() { return new Response('Method not allowed', {status: 405, headers: {Allow: 'POST'}}); }
