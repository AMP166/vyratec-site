import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

export function createSecurityEnv(t, overrides = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/enquiry-protection.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/sms-alerts.sql', import.meta.url), 'utf8'));
  if (t?.after) t.after(() => sqlite.close());
  const calls = [];
  const database = {sqlite, calls, prepare(sql) {
    return {bind(...values) {
      return {
        async run() {
          calls.push({sql, values});
          const result = sqlite.prepare(sql).run(...values);
          return {success: true, meta: {changes: Number(result.changes)}};
        },
        async first() { calls.push({sql, values}); return sqlite.prepare(sql).get(...values) || null; },
        async all() {calls.push({sql, values}); return {success:true, results:sqlite.prepare(sql).all(...values)};}
      };
    }};
  }};
  return {
    RESEND_API_KEY: 'test-only-key', CONTACT_FROM: 'Vyratec <training@vyratec.com>', CONTACT_BCC: 'owner@example.com',
    ENQUIRY_HASH_KEY: 'test-only-hash-key-at-least-thirty-two-characters',
    TURNSTILE_SECRET_KEY: 'test-only-turnstile-key', TURNSTILE_HOSTNAMES: 'vyratec.com,www.vyratec.com,vyratec-site.pages.dev',
    SMS_ALERTS: database, ...overrides
  };
}
export function secureRequest(fields, headers = {}, options = {}) {
  const form = new FormData();
  const kind = fields.kind === 'callback' ? 'callback' : 'training';
  if (options.token !== null) form.set('cf-turnstile-response', options.token || `test-token-${kind}`);
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  return new Request(options.url || 'https://vyratec.com/api/enquire', {method:'POST', headers:{Accept:'application/json',Origin:new URL(options.url || 'https://vyratec.com').origin,'CF-Connecting-IP':'192.0.2.1',...headers},body:form});
}
export function withTurnstile(provider, validation = null) {
  return async (url, options) => {
    if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      const payload = JSON.parse(options.body);
      if (validation) return validation(payload, options);
      return Response.json({success:true, hostname:'vyratec.com',action:payload.response === 'test-token-callback' ? 'callback':'training'});
    }
    return provider(url, options);
  };
}
