import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as handleRequest, onRequestGet} from '../functions/api/enquire.js';
import {createSecurityEnv, secureRequest, withTurnstile} from './helpers/enquiry-env.mjs';
async function onRequestPost(context) {
  const original = globalThis.fetch; globalThis.fetch = withTurnstile(original);
  try {return await handleRequest(context);} finally {globalThis.fetch = original;}
}
import {onRequestPost as track} from '../functions/api/events.js';
const valid = {name: 'Test User', email: 'test@example.com', company: 'Example Engineering', interest: 'Applied AI Training', message: 'Training for an operations team of 20.', requestId: '3f7c44cb-9cb1-4200-a5d5-56e85df12b12'};
let env; let requestNumber = 0;
beforeEach(t => {env = createSecurityEnv(t); requestNumber = 0;});
function request(fields = valid, headers = {}) {
  return secureRequest(fields, {'CF-Connecting-IP': `192.0.2.${++requestNumber}`, ...headers});
}
test('accepted email routes to business inbox, BCCs operator, sets reply-to and records success', async () => {
  const original = globalThis.fetch; const points = []; let payload, key;
  globalThis.fetch = async (url, options) => {assert.equal(url, 'https://api.resend.com/emails'); payload = JSON.parse(options.body); key = options.headers['Idempotency-Key']; return Response.json({id: 'test-delivery-1'});};
  try {
    const configured = {...env, ANALYTICS: {writeDataPoint: value => points.push(value)}};
    const response = await onRequestPost({request: request(), env: configured});
    assert.equal(response.status, 200); assert.equal((await response.json()).reference, 'VYR-3F7C44CB');
    assert.deepEqual(payload.to, ['shop@vyratec.com']); assert.deepEqual(payload.bcc, [env.CONTACT_BCC]);
    assert.equal(payload.reply_to, valid.email); assert.match(payload.text, /operations team of 20/);
    assert.match(key, /^vyratec\/3f7c44cb.*\/[a-f0-9]{64}$/);
    assert.equal(points[0].blobs[0], 'enquiry_success');
    const firstKey = key;
    await onRequestPost({request: request(), env: configured}); assert.equal(key, firstKey);
    await onRequestPost({request: request({...valid, message: 'A revised training requirement'}), env: configured}); assert.notEqual(key, firstKey);
    assert.ok(!JSON.stringify(points).includes(valid.email));
  } finally { globalThis.fetch = original; }
});
test('local AI enquiries preserve the selected interest in the business email and record only the accepted receipt', async () => {
  const original = globalThis.fetch; const points = []; let payload; let sends = 0;
  const fields = {...valid, interest: 'Local AI systems & training', message: 'Assess an on-premises AI system for internal engineering documents.'};
  globalThis.fetch = async (url, options) => {
    sends++;
    assert.equal(url, 'https://api.resend.com/emails');
    payload = JSON.parse(options.body);
    return Response.json({id: 'local-ai-delivery'});
  };
  try {
    const response = await onRequestPost({request: request(fields), env: {...env, ANALYTICS: {writeDataPoint: point => points.push(point)}}});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {ok: true, reference: 'VYR-3F7C44CB'});
    assert.equal(sends, 1);
    assert.deepEqual(payload.to, ['shop@vyratec.com']);
    assert.deepEqual(payload.bcc, [env.CONTACT_BCC]);
    assert.equal(payload.reply_to, fields.email);
    assert.ok(payload.text.includes(`Training interest: ${fields.interest}`));
    assert.ok(payload.text.includes(fields.message));
    assert.deepEqual(points, [{blobs: ['enquiry_success', 'contact-form', 'local-ai-delivery'], doubles: [1], indexes: ['vyratec']}]);
    for (const value of [fields.name, fields.email, fields.company, fields.interest, fields.message]) assert.ok(!JSON.stringify(points).includes(value));
  } finally { globalThis.fetch = original; }
});
test('missing mail configuration returns 503 and never reports success', async () => {
  const response = await onRequestPost({request: request(), env: {}});
  assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
});
test('provider rejection and missing delivery ID never record a conversion', async () => {
  const original = globalThis.fetch; const points = [];
  try {
    for (const mock of [() => Response.json({error: 'rejected'}, {status: 429}), () => Response.json({}), () => {throw new Error('network');}]) {
      globalThis.fetch = async () => mock();
      const response = await onRequestPost({request: request(), env: {...env, ANALYTICS: {writeDataPoint: p => points.push(p)}}});
      assert.equal(response.status, 502); assert.equal((await response.json()).ok, false);
    }
    assert.equal(points.length, 0);
  } finally {globalThis.fetch = original;}
});
test('invalid fields, missing requirements, unknown interests and honeypot are rejected', async () => {
  for (const fields of [{...valid, email: 'invalid'}, {...valid, message: ''}, {...valid, company: 'x'.repeat(201)}, {...valid, interest: 'fake'}, {...valid, website: 'spam'}, {...valid, company: 'Injected\r\nHeader'}]) {
    assert.equal((await onRequestPost({request: request(fields), env})).status, 400);
  }
});
test('rejects cross-origin submissions, oversized streams and unsupported content', async () => {
  assert.equal((await onRequestPost({request: request(valid, {Origin: 'https://other.example'}), env})).status, 403);
  const large = new Request('https://vyratec.com/api/enquire', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'CF-Connecting-IP': '192.0.2.1'}, body: 'a'.repeat(20001)});
  assert.equal((await onRequestPost({request: large, env})).status, 413);
  const wrong = new Request('https://vyratec.com/api/enquire', {method: 'POST', headers: {'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.2'}, body: '{}'});
  assert.equal((await onRequestPost({request: wrong, env})).status, 415);
  assert.equal(onRequestGet().status, 405);
});
test('verified native-form response returns an accessible confirmation after acceptance', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({id: 'test-delivery'});
  try {
    const userHtml = '<img src=x onerror="alert(1)">';
    const response = await onRequestPost({request: request({...valid, message: userHtml}, {Accept: 'text/html'}), env});
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(html, /Your enquiry has been sent/);
    assert.match(html, /href="#enquiry-result">Skip to content/);
    assert.match(html, /<main id="enquiry-result"[^>]*tabindex="-1"/);
    assert.match(html, /<body id="top">/);
    assert.match(html, /href="\/assets\/fonts\/dm-sans-latin-variable\.woff2"[^>]*as="font"/);
    assert.match(html, /<meta name="robots" content="noindex">/);
    for (const path of ['privacy', 'terms', 'cookies', 'accessibility']) assert.ok(html.includes(`href="/${path}"`));
    assert.ok(!html.includes(userHtml));
    const failure = await onRequestPost({request: request(valid, {Accept: 'text/html'}), env: {}});
    const failureHtml = await failure.text();
    assert.equal(failure.status, 503);
    assert.match(failureHtml, /Your enquiry could not be sent/);
    assert.doesNotMatch(failureHtml, /Your enquiry has been sent/);
    assert.match(failureHtml, /href="\/#contact"/);
    assert.match(failureHtml, /href="\/privacy"/);
  } finally {globalThis.fetch = original;}
});
test('analytics are restricted to fixed labels and respect privacy signals', async () => {
  const points = []; const configured = {ANALYTICS: {writeDataPoint: point => points.push(point)}};
  const eventRequest = (body, headers = {}) => new Request('https://vyratec.com/api/events', {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
  assert.equal((await track({request: eventRequest({event: 'cta_click', location: 'hero'}), env: configured})).status, 204);
  assert.equal(points.length, 1);
  assert.equal((await track({request: eventRequest({event: 'enquiry_success', location: 'contact-form'}), env: configured})).status, 400);
  assert.equal((await track({request: eventRequest({event: 'cta_click', location: 'test@example.com'}), env: configured})).status, 400);
  await track({request: eventRequest({event: 'page_view', location: 'website'}, {DNT: '1'}), env: configured});
  await track({request: eventRequest({event: 'page_view', location: 'website'}, {'Sec-GPC': '1'}), env: configured});
  assert.equal(points.length, 1);
});
test('local AI CTA accepts its fixed analytics label without recording visitor fields', async () => {
  const points = [];
  const eventRequest = body => new Request('https://vyratec.com/api/events', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const configured = {ANALYTICS: {writeDataPoint: point => points.push(point)}};
  const response = await track({request: eventRequest({event: 'cta_click', location: 'local-ai', email: valid.email, company: valid.company, message: valid.message}), env: configured});
  assert.equal(response.status, 204);
  assert.deepEqual(points, [{blobs: ['cta_click', 'local-ai', ''], doubles: [1], indexes: ['vyratec']}]);
  assert.equal((await track({request: eventRequest({event: 'cta_click', location: `local-ai:${valid.email}`}), env: configured})).status, 400);
  assert.equal(points.length, 1);
});

const callback = {kind: 'callback', name: 'Callback Requester', email: 'callback@example.com', company: 'Example Operations', phone: '+61 2 5550 1234', preferredTime: 'Tuesday afternoon, Sydney time', message: 'Discuss document workflows.', requestId: '8f81700e-f0c1-46c9-bd7b-d11bab104b17'};

test('callback requests deliver contact details privately and record only the fixed callback conversion label', async () => {
  const original = globalThis.fetch; const points = []; let payload;
  globalThis.fetch = async (url, options) => {assert.equal(url, 'https://api.resend.com/emails'); payload = JSON.parse(options.body); return Response.json({id: 'callback-receipt'});};
  try {
    const response = await onRequestPost({request: request(callback), env: {...env, CONTACT_TO: 'business@example.com', ANALYTICS: {writeDataPoint: point => points.push(point)}}});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {ok: true, reference: 'VYR-8F81700E', kind: 'callback'});
    assert.deepEqual(payload.to, ['business@example.com']);
    assert.deepEqual(payload.bcc, [env.CONTACT_BCC]);
    assert.equal(payload.reply_to, callback.email);
    assert.equal(payload.subject, 'Callback request | Example Operations | VYR-8F81700E');
    for (const value of [callback.name, callback.email, callback.company, callback.phone, callback.preferredTime, callback.message]) assert.ok(payload.text.includes(value));
    assert.match(payload.text, /No appointment has been confirmed/);
    assert.deepEqual(points[0].blobs, ['enquiry_success', 'callback-form', 'callback-receipt']);
    for (const value of [callback.name, callback.email, callback.company, callback.phone, callback.preferredTime, callback.message]) assert.ok(!JSON.stringify(points).includes(value));
  } finally {globalThis.fetch = original;}
});

test('callback retries recover their existing confirmation and changed fields create separately limited submissions', async t => {
  const original = globalThis.fetch; const keys = []; let payload;
  globalThis.fetch = async (url, options) => {keys.push(options.headers['Idempotency-Key']); payload = JSON.parse(options.body); return Response.json({id: 'callback-receipt'});};
  try {
    for (const fields of [callback, callback, {...callback, phone: '02 5550 6789'}, {...callback, preferredTime: 'Friday morning, Sydney time'}]) {
      assert.equal((await onRequestPost({request: request(fields), env})).status, 200);
    }
    assert.equal(keys.length, 3); // The unchanged retry never called Resend again.
    assert.equal(new Set(keys).size, 3);
    assert.equal((await onRequestPost({request: request({...callback, message: 'A different topic'}), env})).status, 429);
    env = createSecurityEnv(t);
    const noTopic = {...callback}; delete noTopic.message;
    assert.equal((await onRequestPost({request: request(noTopic), env})).status, 200);
    assert.match(payload.text, /Topic:\nNot provided/);
    const sends = keys.length;
    assert.equal((await onRequestPost({request: request({...callback, message: ''}), env})).status, 200);
    assert.equal(keys.length, sends);
    assert.equal((await onRequestPost({request: request(valid), env})).status, 200);
    const legacyKey = keys.at(-1);
    for (const kind of ['', 'training']) {
      assert.equal((await onRequestPost({request: request({...valid, kind}), env})).status, 200);
      assert.equal(keys.at(-1), legacyKey);
    }
  } finally {globalThis.fetch = original;}
});

test('callback fields reject malformed phones, missing timing, excessive content, controls and unsupported modes before provider delivery', async () => {
  const original = globalThis.fetch; let sends = 0;
  globalThis.fetch = async () => {sends++; return Response.json({id: 'unexpected'});};
  try {
    for (const fields of [
      {...callback, kind: 'booking'}, {...callback, kind: 'Callback'},
      {...callback, phone: ''}, {...callback, phone: '123'}, {...callback, phone: '1234567890123456'},
      {...callback, phone: '02 ABCD 1234'}, {...callback, phone: '02 +5550 1234'}, {...callback, phone: '0'.repeat(41)},
      {...callback, phone: '02\n5550 1234'}, {...callback, preferredTime: ''},
      {...callback, preferredTime: 'x'.repeat(201)}, {...callback, preferredTime: 'Tuesday\nHeader'},
      {...callback, name: 'Injected\x7fName'}, {...callback, company: 'Injected\r\nHeader'},
      {...callback, email: 'invalid'}, {...callback, message: 'x'.repeat(4001)}, {...callback, message: 'Topic\x00bad'},
      {...callback, website: 'spam'}
    ]) assert.equal((await onRequestPost({request: request(fields), env})).status, 400);
    assert.equal(sends, 0);
    assert.equal((await onRequestPost({request: request(callback, {Origin: 'https://other.example'}), env})).status, 403);
    assert.equal((await onRequestPost({request: request(callback), env: {}})).status, 503);
    assert.equal(sends, 0);
  } finally {globalThis.fetch = original;}
});

test('a rejected callback notification never reports success or records a conversion', async () => {
  const original = globalThis.fetch; const points = [];
  try {
    for (const mock of [() => Response.json({error: 'rejected'}, {status: 429}), () => Response.json({}), () => {throw new Error('network');}]) {
      globalThis.fetch = async () => mock();
      const response = await onRequestPost({request: request(callback), env: {...env, ANALYTICS: {writeDataPoint: point => points.push(point)}}});
      assert.equal(response.status, 502);
      const payload = await response.json();
      assert.equal(payload.ok, false);
      assert.equal(payload.kind, 'callback');
    }
    assert.equal(points.length, 0);
  } finally {globalThis.fetch = original;}
});

test('verified native-form callback confirmation describes a request and agreed timing rather than a booked appointment', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({id: 'callback-receipt'});
  try {
    const userHtml = '<img src=x onerror="alert(1)">';
    const response = await onRequestPost({request: request({...callback, message: userHtml}, {Accept: 'text/html'}), env});
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Your callback request has been received/);
    assert.match(html, /We’ll contact you to agree a time for a 15-minute call/);
    assert.match(html, /<title>Callback request \| Vyratec<\/title>/);
    assert.match(html, /href="\/#callback"/);
    assert.doesNotMatch(html, /has been booked|SMS|text message/i);
    assert.ok(!html.includes(userHtml));
    const failure = await onRequestPost({request: request(callback, {Accept: 'text/html'}), env: {...env, RESEND_API_KEY: ''}});
    assert.equal(failure.status, 503);
    const failureHtml = await failure.text();
    assert.match(failureHtml, /Your callback request could not be sent/);
    assert.doesNotMatch(failureHtml, /Your callback request has been received/);
    assert.match(failureHtml, /href="\/#callback"/);
  } finally {globalThis.fetch = original;}
});

test('callback start uses a fixed analytics label and accepted callbacks honour privacy signals', async () => {
  const original = globalThis.fetch; const points = [];
  const configured = {...env, ANALYTICS: {writeDataPoint: point => points.push(point)}};
  globalThis.fetch = async () => Response.json({id: 'callback-receipt'});
  try {
    const eventRequest = new Request('https://vyratec.com/api/events', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({event: 'enquiry_start', location: 'callback-form'})});
    assert.equal((await track({request: eventRequest, env: configured})).status, 204);
    assert.deepEqual(points[0].blobs, ['enquiry_start', 'callback-form', '']);
    const ctaRequest = new Request('https://vyratec.com/api/events', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({event: 'cta_click', location: 'callback'})});
    assert.equal((await track({request: ctaRequest, env: configured})).status, 204);
    assert.deepEqual(points[1].blobs, ['cta_click', 'callback', '']);
    for (const headers of [{DNT: '1'}, {'Sec-GPC': '1'}]) {
      assert.equal((await onRequestPost({request: request(callback, headers), env: configured})).status, 200);
    }
    assert.equal(points.length, 2);
  } finally {globalThis.fetch = original;}
});
