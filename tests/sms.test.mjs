import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {alertCallbackOwner} from '../functions/_sms.mjs';
import {onRequestPost} from '../functions/api/enquire.js';
import {createSecurityEnv, secureRequest, withTurnstile} from './helpers/enquiry-env.mjs';

const caller = {receiptId: 'mail-receipt-1', reference: 'VYR-12345678', name: 'Example Caller', phone: '+61 2 5550 1234', company: 'Example Engineering'};
const queued = () => Response.json({http_code: 200, response_code: 'SUCCESS', data: {messages: [{status: 'SUCCESS', message_id: 'sms-receipt-1'}]}});
function database() {
  const rows = new Map(); const calls = [];
  return {rows, calls, prepare(sql) {
    return {bind(...values) {
      return {async run() {
      calls.push({sql, values});
      if (sql.startsWith('DELETE')) {
        let changes = 0;
        for (const [id, row] of rows) if (row.created_at < values[0]) {rows.delete(id); changes++;}
        return {success: true, meta: {changes}};
      }
      if (sql.startsWith('INSERT')) {
        if (rows.has(values[0])) return {success: true, meta: {changes: 0}};
        if ([...rows.values()].filter(row => row.created_at >= values[2]).length >= values[3]) return {success: true, meta: {changes: 0}};
        // Models the database's unique constraint, before yielding to competitors.
        rows.set(values[0], {receipt_id: values[0], status: 'claimed', created_at: values[1]});
        return {success: true, meta: {changes: 1}};
      }
      if (sql.startsWith('UPDATE')) {
        const row = rows.get(values[1]);
        if (row) row.status = values[0];
        return {success: true, meta: {changes: row ? 1 : 0}};
      }
      throw new Error('Unexpected SQL');
      }};
    }};
  }};
}
const configured = db => ({CALLBACK_SMS_ENABLED: 'true', CLICKSEND_USERNAME: 'test-api-user', CLICKSEND_API_KEY: 'test-only-key', CALLBACK_SMS_TO: '+61411111111', SMS_ALERTS: db});

test('owner SMS is disabled unless every explicit configuration setting is present', async () => {
  const original = globalThis.fetch; const db = database(); let sends = 0;
  globalThis.fetch = async () => {sends++; return queued();};
  try {
    const ready = configured(db);
    for (const settings of [
      {}, {...ready, CALLBACK_SMS_ENABLED: undefined}, {...ready, CALLBACK_SMS_ENABLED: 'false'}, {...ready, CALLBACK_SMS_ENABLED: true},
      {...ready, CLICKSEND_USERNAME: ''}, {...ready, CLICKSEND_API_KEY: ''}, {...ready, CALLBACK_SMS_TO: ''},
      {...ready, CALLBACK_SMS_TO: '04 invalid'}, {...ready, SMS_ALERTS: undefined}
    ]) assert.equal((await alertCallbackOwner(settings, caller)).status, 'disabled');
    assert.equal(sends, 0);
    assert.equal(db.calls.length, 0);
  } finally {globalThis.fetch = original;}
});

test('configured alert sends a short message only to the configured owner using Basic auth and account sender defaults', async () => {
  const original = globalThis.fetch; const db = database(); const settings = configured(db); let payload, headers, signal;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://rest.clicksend.com/v3/sms/send');
    assert.equal(options.method, 'POST');
    payload = JSON.parse(options.body); headers = options.headers; signal = options.signal;
    return queued();
  };
  try {
    assert.equal((await alertCallbackOwner(settings, caller)).status, 'queued');
    assert.equal(headers.Authorization, `Basic ${btoa(`${settings.CLICKSEND_USERNAME}:${settings.CLICKSEND_API_KEY}`)}`);
    assert.equal(headers['Content-Type'], 'application/json');
    assert.ok(signal instanceof AbortSignal);
    assert.deepEqual(Object.keys(payload), ['messages']);
    assert.equal(payload.messages.length, 1);
    assert.equal(payload.messages[0].to, settings.CALLBACK_SMS_TO);
    assert.notEqual(payload.messages[0].to, caller.phone);
    assert.equal(payload.messages[0].source, 'vyratec');
    assert.equal(payload.messages[0].from, undefined);
    for (const value of [caller.reference, caller.name, caller.company, caller.phone.replace(/[^+\d]/g, '')]) assert.ok(payload.messages[0].body.includes(value));
    assert.match(payload.messages[0].body, /See email for preferred time/);
    assert.ok(payload.messages[0].body.length <= 160);
    assert.deepEqual(Object.keys(db.rows.get(caller.receiptId)), ['receipt_id', 'status', 'created_at']);
    assert.equal(db.rows.get(caller.receiptId).status, 'queued');
    const stored = JSON.stringify(db.calls);
    for (const value of [caller.name, caller.company, caller.phone, settings.CALLBACK_SMS_TO, settings.CLICKSEND_USERNAME, settings.CLICKSEND_API_KEY]) assert.ok(!stored.includes(value));
  } finally {globalThis.fetch = original;}
});

test('an atomic receipt claim skips sequential and concurrent callback retries before paid sends', async () => {
  const original = globalThis.fetch; const db = database(); let sends = 0;
  globalThis.fetch = async () => {sends++; return queued();};
  try {
    const settings = configured(db);
    const results = await Promise.all(Array.from({length: 8}, () => alertCallbackOwner(settings, caller)));
    assert.equal(results.filter(result => result.status === 'queued').length, 1);
    assert.equal(results.filter(result => result.status === 'skipped').length, 7);
    assert.equal((await alertCallbackOwner(settings, caller)).status, 'skipped');
    assert.equal(sends, 1);
    assert.ok(db.calls.some(call => call.sql.includes('ON CONFLICT(receipt_id) DO NOTHING')));
  } finally {globalThis.fetch = original;}
});

test('the default global cap allows ten distinct daily claims across concurrent requests and duplicates consume no capacity', async () => {
  const original = globalThis.fetch; const db = database(); let sends = 0;
  globalThis.fetch = async () => {sends++; return queued();};
  try {
    const settings = configured(db);
    await alertCallbackOwner(settings, caller);
    await alertCallbackOwner(settings, caller);
    const outcomes = await Promise.all(Array.from({length: 20}, (_, index) => alertCallbackOwner(settings, {...caller, receiptId: `distinct-receipt-${index}`})));
    assert.equal(outcomes.filter(result => result.status === 'queued').length, 9);
    assert.equal(outcomes.filter(result => result.status === 'skipped').length, 11);
    assert.equal(db.rows.size, 10);
    assert.equal(sends, 10);
    assert.equal((await alertCallbackOwner(settings, caller)).status, 'skipped');
    assert.equal(db.rows.size, 10);
    assert.equal(sends, 10);
    const claim = db.calls.find(call => call.sql.startsWith('INSERT'));
    assert.match(claim.sql, /SELECT COUNT\(\*\) FROM callback_sms_alerts WHERE created_at >= \?/);
    assert.equal(claim.values[2] % 86400, 0);
    assert.equal(claim.values[3], 10);
  } finally {globalThis.fetch = original;}
});

test('a configured cap counts failed and unknown claims, excludes previous UTC days and rejects invalid limits without I/O', async () => {
  const original = globalThis.fetch; const db = database(); let sends = 0;
  const now = Math.floor(Date.now() / 1000);
  const dayStart = now - (now % 86400);
  db.rows.set('yesterday', {receipt_id: 'yesterday', status: 'queued', created_at: dayStart - 1});
  db.rows.set('today-rejected', {receipt_id: 'today-rejected', status: 'rejected', created_at: dayStart});
  db.rows.set('today-unknown', {receipt_id: 'today-unknown', status: 'unknown', created_at: dayStart});
  globalThis.fetch = async () => {sends++; return queued();};
  try {
    const settings = {...configured(db), CALLBACK_SMS_DAILY_LIMIT: '3'};
    assert.equal((await alertCallbackOwner(settings, caller)).status, 'queued');
    assert.equal((await alertCallbackOwner(settings, {...caller, receiptId: 'over-limit'})).status, 'skipped');
    assert.equal(sends, 1);
    const writes = db.calls.length;
    for (const limit of ['', '0', '26', '-1', '1.5', 'NaN', '3 items', ' 3 ', null]) {
      assert.equal((await alertCallbackOwner({...settings, CALLBACK_SMS_DAILY_LIMIT: limit}, {...caller, receiptId: 'invalid-limit'})).status, 'disabled');
    }
    assert.equal(db.calls.length, writes);
    assert.equal(sends, 1);
  } finally {globalThis.fetch = original;}
});

test('the actual claim SQL enforces the daily cap and receipt uniqueness in SQLite', async () => {
  const {DatabaseSync} = await import('node:sqlite');
  const sqlDatabase = new DatabaseSync(':memory:');
  const original = globalThis.fetch; const db = database();
  globalThis.fetch = async () => queued();
  try {
    sqlDatabase.exec(await readFile(new URL('../migrations/sms-alerts.sql', import.meta.url), 'utf8'));
    await alertCallbackOwner({...configured(db), CALLBACK_SMS_DAILY_LIMIT: '2'}, caller);
    const claim = db.calls.find(call => call.sql.startsWith('INSERT'));
    const statement = sqlDatabase.prepare(claim.sql);
    const [, now, dayStart, limit] = claim.values;
    assert.equal(statement.run('first', now, dayStart, limit).changes, 1);
    assert.equal(statement.run('first', now, dayStart, limit).changes, 0);
    sqlDatabase.prepare('UPDATE callback_sms_alerts SET status = ? WHERE receipt_id = ?').run('unknown', 'first');
    assert.equal(statement.run('second', now, dayStart, limit).changes, 1);
    assert.equal(statement.run('third', now, dayStart, limit).changes, 0);
    assert.equal(statement.run('next-day', dayStart + 86401, dayStart + 86400, limit).changes, 1);
    assert.equal(sqlDatabase.prepare('SELECT COUNT(*) AS total FROM callback_sms_alerts').get().total, 3);
  } finally {globalThis.fetch = original; sqlDatabase.close();}
});

test('HTTP and top-level success cannot conceal an individual SMS failure or a missing message ID', async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [
      () => Response.json({error: 'unavailable'}, {status: 503}),
      () => Response.json({http_code: 200, response_code: 'SUCCESS', data: {messages: [{status: 'INSUFFICIENT_CREDIT', message_id: 'sms-receipt'}]}}),
      () => Response.json({http_code: 200, response_code: 'SUCCESS', data: {messages: [{status: 'SUCCESS'}]}}),
      () => Response.json({http_code: 200, response_code: 'SUCCESS', data: {messages: []}}),
      () => Response.json({http_code: 200, response_code: 'INVALID_CREDENTIALS', data: {messages: [{status: 'SUCCESS', message_id: 'sms-receipt'}]}})
    ]) {
      const db = database(); let sends = 0;
      globalThis.fetch = async () => {sends++; return response();};
      assert.equal((await alertCallbackOwner(configured(db), caller)).status, 'rejected');
      assert.equal(db.rows.get(caller.receiptId).status, 'rejected');
      assert.equal((await alertCallbackOwner(configured(db), caller)).status, 'skipped');
      assert.equal(sends, 1);
    }
  } finally {globalThis.fetch = original;}
});

test('timeouts and unreadable provider responses retain their claim without automatic resend', async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [() => {throw new DOMException('Timed out', 'TimeoutError');}, () => new Response('invalid json')]) {
      const db = database(); let sends = 0;
      globalThis.fetch = async () => {sends++; return response();};
      assert.equal((await alertCallbackOwner(configured(db), caller)).status, 'unknown');
      assert.equal(db.rows.get(caller.receiptId).status, 'unknown');
      assert.equal((await alertCallbackOwner(configured(db), caller)).status, 'skipped');
      assert.equal(sends, 1);
    }
  } finally {globalThis.fetch = original;}
});

test('an unavailable or unconfirmed D1 claim prevents provider sends', async () => {
  const original = globalThis.fetch; let sends = 0;
  globalThis.fetch = async () => {sends++; return queued();};
  try {
    const unavailable = {prepare() {throw new Error('D1 unavailable');}};
    assert.equal((await alertCallbackOwner(configured(unavailable), caller)).status, 'unknown');
    const unconfirmed = {prepare() {return {bind() {return {async run() {return {success: false, meta: {changes: 1}};}};}};}};
    assert.equal((await alertCallbackOwner(configured(unconfirmed), caller)).status, 'skipped');
    assert.equal((await alertCallbackOwner(configured(database()), {...caller, receiptId: 'unexpected@example.com'})).status, 'skipped');
    assert.equal(sends, 0);
  } finally {globalThis.fetch = original;}
});

test('retention cleanup removes claims older than 30 days and schema stores no form fields or credentials', async () => {
  const original = globalThis.fetch; const db = database();
  const now = Math.floor(Date.now() / 1000);
  db.rows.set('old-receipt', {receipt_id: 'old-receipt', status: 'queued', created_at: now - 31 * 86400});
  db.rows.set('recent-receipt', {receipt_id: 'recent-receipt', status: 'queued', created_at: now - 29 * 86400});
  globalThis.fetch = async () => queued();
  try {
    await alertCallbackOwner(configured(db), caller);
    assert.equal(db.rows.has('old-receipt'), false);
    assert.equal(db.rows.has('recent-receipt'), true);
    const sql = await readFile(new URL('../migrations/sms-alerts.sql', import.meta.url), 'utf8');
    const source = await readFile(new URL('../functions/_sms.mjs', import.meta.url), 'utf8');
    assert.match(sql, /receipt_id TEXT PRIMARY KEY NOT NULL/);
    assert.doesNotMatch(sql, /\b(name|phone|company|body|email|api_key|recipient)\s+(TEXT|INTEGER)/i);
    assert.doesNotMatch(source + sql, /\+\d{8,}/);
  } finally {globalThis.fetch = original;}
});

const mailEnv = {RESEND_API_KEY: 'test-mail-key', CONTACT_FROM: 'Vyratec <training@example.com>', CONTACT_BCC: 'owner@example.com'};
function enquiryRequest(kind = 'callback') {
  const fields = {name: caller.name, email: 'caller@example.com', company: caller.company, message: 'Discuss training', requestId: '12345678-1234-4234-8234-123456789012'};
  if (kind === 'callback') Object.assign(fields, {kind, phone: caller.phone, preferredTime: 'Tuesday afternoon, Sydney time'});
  else fields.interest = 'Applied AI Training';
  return secureRequest(fields);
}

test('accepted callback email schedules its optional owner alert through waitUntil without exposing SMS status', async t => {
  const original = globalThis.fetch; const tasks = []; const destinations = [];
  const ready = createSecurityEnv(t); const db = ready.SMS_ALERTS;
  const settings = {...ready, ...mailEnv, ...configured(db)};
  globalThis.fetch = withTurnstile(async url => {destinations.push(url); return url.includes('resend.com') ? Response.json({id: caller.receiptId}) : queued();});
  try {
    const response = await onRequestPost({request: enquiryRequest(), env: settings, waitUntil(task) {tasks.push(task);}});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {ok: true, reference: caller.reference, kind: 'callback'});
    assert.equal(tasks.length, 1);
    await Promise.all(tasks);
    assert.deepEqual(destinations, ['https://api.resend.com/emails', 'https://rest.clicksend.com/v3/sms/send']);
    assert.equal(db.sqlite.prepare('SELECT status FROM callback_sms_alerts WHERE receipt_id = ?').get(caller.receiptId).status, 'queued');
  } finally {globalThis.fetch = original;}
});

test('failed email and normal training enquiries never send SMS; SMS failure never reverses accepted callback email', async t => {
  const original = globalThis.fetch; let smsSends = 0;
  const ready = createSecurityEnv(t); const db = ready.SMS_ALERTS;
  const settings = {...ready, ...mailEnv, ...configured(db)};
  try {
    globalThis.fetch = withTurnstile(async url => {assert.ok(url.includes('resend.com')); return Response.json({error: 'rejected'}, {status: 429});});
    assert.equal((await onRequestPost({request: enquiryRequest(), env: settings})).status, 502);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS total FROM callback_sms_alerts').get().total, 0);
    globalThis.fetch = withTurnstile(async url => {assert.ok(url.includes('resend.com')); return Response.json({id: 'training-mail-receipt'});});
    assert.equal((await onRequestPost({request: enquiryRequest('training'), env: settings})).status, 200);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS total FROM callback_sms_alerts').get().total, 0);
    globalThis.fetch = withTurnstile(async url => {
      if (url.includes('resend.com')) return Response.json({id: caller.receiptId});
      smsSends++;
      throw new DOMException('Timed out', 'TimeoutError');
    });
    const response = await onRequestPost({request: enquiryRequest(), env: settings});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {ok: true, reference: caller.reference, kind: 'callback'});
    assert.equal(smsSends, 1);
    assert.equal(db.sqlite.prepare('SELECT status FROM callback_sms_alerts WHERE receipt_id = ?').get(caller.receiptId).status, 'unknown');
  } finally {globalThis.fetch = original;}
});
