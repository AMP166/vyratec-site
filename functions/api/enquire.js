import {json, isSameOrigin, readBody, recordEvent, interests} from '../_lib.mjs';
import {alertCallbackOwner} from '../_sms.mjs';
import {ProtectionError, countIpAttempt, identifySubmission, findReceipt, verifyVisitor, admitSubmission, claimDelivery, finishDelivery} from '../_abuse.mjs';

const mailError = 'We couldn’t send your enquiry. Please try again or contact us directly.';
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
function reply(request, payload, status = 200) {
  if (request.headers.get('accept')?.includes('application/json')) {
    const response = json(payload, status);
    if (payload.retryAfter) response.headers.set('Retry-After', String(payload.retryAfter));
    return response;
  }
  const callback = payload.kind === 'callback';
  const label = callback ? 'Callback request' : 'Training enquiry';
  const formPath = callback ? '/#callback' : '/#contact';
  const title = callback
    ? (payload.ok ? 'Your callback request has been received.' : 'Your callback request could not be sent.')
    : (payload.ok ? 'Your enquiry has been sent.' : 'Your enquiry could not be sent.');
  const detail = payload.ok
    ? (callback ? `Thank you. We’ll contact you to agree a time for a 15-minute call. Callback reference: ${payload.reference}` : `Thank you. We’ll reply to your work email. Enquiry reference: ${payload.reference}`)
    : payload.error;
  return new Response(`<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${label} | Vyratec</title><meta name="robots" content="noindex">
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
    <p class="eyebrow">${label}</p>
    <h1>${title}</h1>
    <p>${escapeHtml(detail)}</p>
    <p>For any questions, <a href="mailto:shop@vyratec.com">contact us</a>.</p>
    <div class="error-actions"><a class="text-link" href="${formPath}">Return to the ${callback ? 'callback request' : 'enquiry'} form <svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></a></div>
  </main>
  <footer class="site-footer"><div class="wrap footer-top">
    <div class="footer-brand"><a class="brand" href="/" aria-label="Vyratec home"><img src="/assets/vyratec-wordmark-light.png" width="182" height="41" alt="Vyratec"></a><p>Practical AI training for Australian workplaces.</p></div>
    <nav aria-label="Contact and navigation"><a href="/">Home</a><a href="/#contact">Training enquiries</a><a href="mailto:shop@vyratec.com">Contact us</a></nav>
    <nav aria-label="Website information"><a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a><a href="/cookies">Cookie notice</a><a href="/accessibility">Accessibility</a></nav>
  </div><div class="wrap footer-bottom"><p>© ${new Date().getUTCFullYear()} Vyratec</p><a href="#top">Back to top</a></div></footer>
</body></html>`, {status, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(payload.retryAfter ? {'Retry-After': String(payload.retryAfter)} : {})}});
}

export async function onRequestPost(context) {
  const {request, env} = context;
  let kind = 'training';
  const fail = (error, status, extra = {}) => reply(request, {ok: false, error, ...(kind === 'callback' ? {kind} : {}), ...extra}, status);
  const success = reference => reply(request, {ok: true, reference, ...(kind === 'callback' ? {kind} : {})});
  try {
  // All attempts share a rolling allowance, including malformed form bodies.
  const protection = await countIpAttempt(env, request);
  if (!isSameOrigin(request)) return fail('Please submit your enquiry from the Vyratec website.', 403);
  const type = request.headers.get('content-type') || '';
  if (!type.startsWith('multipart/form-data') && !type.startsWith('application/x-www-form-urlencoded')) return fail('Unsupported form format.', 415);
  let form;
  try {
    const body = await readBody(request, 20000);
    form = await new Request(request.url, {method: 'POST', headers: {'Content-Type': type}, body}).formData();
  } catch (error) { return fail(error instanceof RangeError ? 'Your enquiry is too long. Please shorten the requirements.' : 'Please check your enquiry and try again.', error instanceof RangeError ? 413 : 400); }
  const submittedKind = form.get('kind');
  if (submittedKind !== null && typeof submittedKind !== 'string') return fail('Please choose a supported enquiry form.', 400);
  const normalisedKind = submittedKind?.trim() || 'training';
  if (!['training', 'callback'].includes(normalisedKind)) return fail('Please choose a supported enquiry form.', 400);
  kind = normalisedKind;
  if (String(form.get('website') || '').trim()) return fail('Please check your enquiry and try again.', 400);
  const callback = kind === 'callback';
  const limits = callback
    ? {name: 140, email: 200, company: 200, phone: 40, preferredTime: 200, message: 4000}
    : {name: 140, email: 200, company: 200, interest: 160, message: 4000};
  const fields = callback ? {kind} : {};
  for (const [key, max] of Object.entries(limits)) {
    const value = form.get(key);
    if (callback && key === 'message' && value === null) { fields[key] = ''; continue; }
    if (typeof value !== 'string' || (!value.trim() && !(callback && key === 'message')) || value.trim().length > max) return fail(callback ? 'Please complete your name, work email, organisation, phone number and preferred callback time within the displayed limits.' : 'Please complete all five fields within the displayed limits.', 400);
    fields[key] = value.trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) || /[\x00-\x1f\x7f]/.test(fields.name + fields.company + fields.email)) return fail(callback ? 'Please check your name, work email and organisation.' : 'Please check your email address and selected programme.', 400);
  if (callback) {
    const digits = fields.phone.replace(/\D/g, '');
    if (!/^\+?[\d ()-]+$/.test(fields.phone) || digits.length < 7 || digits.length > 15 || /[\x00-\x1f\x7f]/.test(fields.phone + fields.preferredTime) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(fields.message)) return fail('Please check your phone number, preferred callback time and topic.', 400);
  } else if (!interests.includes(fields.interest)) return fail('Please check your email address and selected programme.', 400);
  if (!env.RESEND_API_KEY || !env.CONTACT_FROM || !env.CONTACT_BCC) return fail(mailError, 503);
  const rawId = form.get('requestId');
  const requestId = typeof rawId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(rawId) ? rawId.toLowerCase() : crypto.randomUUID();
  // Stable per submission and content: retries do not send duplicate notifications;
  // editing a rejected submission creates a different provider idempotency key.
  const identity = await identifySubmission(protection, requestId, fields);
  const hash = identity.contentHash;
  const reference = `VYR-${requestId.slice(0, 8).toUpperCase()}`;
  let receipt = await findReceipt(protection, identity.key);
  if (receipt?.status === 'accepted') return success(reference);
  if (!receipt) {
    await verifyVisitor(protection, request, form.get('cf-turnstile-response'), kind, requestId);
    receipt = await admitSubmission(protection, identity);
  }
  if (receipt.status === 'accepted') return success(reference);
  const claim = await claimDelivery(protection, identity.key);
  if (claim.accepted) return success(reference);
  const text = callback
    ? [`15-minute callback request: ${reference}`, 'Please contact the requester to agree a time. No appointment has been confirmed.', '', `Name: ${fields.name}`, `Work email: ${fields.email}`, `Organisation: ${fields.company}`, `Callback phone: ${fields.phone}`, `Preferred callback time: ${fields.preferredTime}`, '', 'Topic:', fields.message || 'Not provided'].join('\n')
    : [`Corporate training enquiry: ${reference}`, '', `Name: ${fields.name}`, `Work email: ${fields.email}`, `Organisation: ${fields.company}`, `Training interest: ${fields.interest}`, '', 'Requirements:', fields.message].join('\n');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `vyratec/${requestId}/${hash}`},
      body: JSON.stringify({
        from: env.CONTACT_FROM, to: [env.CONTACT_TO || 'shop@vyratec.com'],
        bcc: [env.CONTACT_BCC], reply_to: fields.email,
        subject: `${callback ? 'Callback request' : 'Training enquiry'} | ${fields.company} | ${reference}`, text
      })
    });
    if (!response.ok) {
      await finishDelivery(protection, identity.key, claim.owner, 'rejected');
      console.error('Enquiry mail provider rejected delivery', response.status);
      return fail(mailError, 502);
    }
    const result = await response.json();
    if (typeof result.id !== 'string' || !result.id.trim() || result.id.length > 200) {
      await finishDelivery(protection, identity.key, claim.owner, 'unknown');
      return fail(mailError, 502);
    }
    // Only the current lease owner can finish and trigger notification side effects.
    const completed = await finishDelivery(protection, identity.key, claim.owner, 'accepted', result.id);
    if (!completed) {
      const latest = await findReceipt(protection, identity.key);
      if (latest?.status === 'accepted') return success(reference);
      throw new ProtectionError('Your request is still being processed. Please wait a few seconds before retrying with the same details.', 409, 'submission_pending', 3);
    }
    recordEvent(env, 'enquiry_success', callback ? 'callback-form' : 'contact-form', request, result.id);
    if (callback) {
      // Owner alerts are optional and must never alter an accepted email result.
      try {
        const alert = alertCallbackOwner(env, {receiptId: result.id, reference, name: fields.name, phone: fields.phone, company: fields.company});
        if (typeof context.waitUntil === 'function') context.waitUntil(alert);
        else await alert;
      } catch { console.warn('Callback SMS alert unavailable; use the email notification'); }
    }
    return success(reference);
  } catch (error) {
    if (error instanceof ProtectionError) throw error;
    try { await finishDelivery(protection, identity.key, claim.owner, 'unknown'); }
    catch { throw new ProtectionError('Your request status is temporarily unavailable. Please retry with the same details or contact us directly.'); }
    console.error('Enquiry mail delivery unavailable'); return fail(mailError, 502);
  }
  } catch (error) {
    if (error instanceof ProtectionError) return fail(error.message, error.status, {code: error.code, ...(error.retryAfter ? {retryAfter: error.retryAfter} : {})});
    console.warn('Enquiry protection unavailable');
    return fail('The enquiry security check is temporarily unavailable. Please try again shortly or contact us directly.', 503, {code: 'security_unavailable'});
  }
}
export function onRequestGet() { return new Response('Method not allowed', {status: 405, headers: {Allow: 'POST'}}); }
