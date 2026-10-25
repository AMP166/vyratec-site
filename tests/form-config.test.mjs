import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/form-config.js';

const configured = {
  SMS_ALERTS: {prepare() { throw new Error('Configuration must not query visitor records'); }},
  ENQUIRY_HASH_KEY: 'test-only-hmac-key-00000000000000000000',
  TURNSTILE_SECRET_KEY: 'test-only-private-verification-key',
  TURNSTILE_HOSTNAMES: 'vyratec.com,www.vyratec.com,vyratec-site.pages.dev',
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
};

test('form configuration exposes only the public widget sitekey with no caching', async () => {
  const response = onRequestGet({env: configured});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {sitekey: configured.TURNSTILE_SITE_KEY});
});

test('incomplete security configuration fails closed without leaking settings', async () => {
  for (const setting of ['SMS_ALERTS', 'ENQUIRY_HASH_KEY', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_HOSTNAMES', 'TURNSTILE_SITE_KEY']) {
    const env = {...configured}; delete env[setting];
    const response = onRequestGet({env});
    assert.equal(response.status, 503, setting);
    const payload = await response.text();
    assert.ok(!payload.includes(configured.ENQUIRY_HASH_KEY));
    assert.ok(!payload.includes(configured.TURNSTILE_SECRET_KEY));
    assert.ok(!payload.includes(configured.TURNSTILE_SITE_KEY));
  }
  assert.equal(onRequestGet({env: {...configured, TURNSTILE_SITE_KEY: '<invalid>'}}).status, 503);
});
