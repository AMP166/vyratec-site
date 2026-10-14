export const interests = ['Executive AI Briefing', 'Applied AI Training', 'AI Workflows & Automation', 'Custom Corporate Workshop', 'Help me choose'];
export const ctaLocations = ['website', 'header', 'hero', 'mobile-navigation', 'use-case', 'programme-executive', 'programme-applied', 'programme-automation', 'programme-custom', 'contact-email', 'footer', 'contact-form'];
export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
}
export function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  return !['cross-site'].includes(request.headers.get('sec-fetch-site'));
}
export async function readBody(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw new RangeError('Body too large');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new RangeError('Body too large'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size); let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.byteLength; }
  return body;
}
// Anonymous totals, never visitor identifiers, form content, IPs or query strings.
// An optional Cloudflare Analytics Engine binding provides queryable retention.
export function recordEvent(env, event, location = 'contact-form', request = null, receipt = '') {
  if (request && (request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1')) return;
  try {
    if (env.ANALYTICS?.writeDataPoint) {
      env.ANALYTICS.writeDataPoint({blobs: [event, location, receipt], doubles: [1], indexes: ['vyratec']});
    } else {
      console.log(JSON.stringify({type: 'vyratec_conversion', event, location, ...(receipt ? {receipt} : {})}));
    }
  } catch { console.warn('Conversion recording unavailable'); }
}
