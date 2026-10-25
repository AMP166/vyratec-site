// Shared rolling limits and delivery receipts, persisted through the SMS_ALERTS D1 binding.
const encoder = new TextEncoder();
const ipWindow = 600;
const emailWindow = 3600;
const receiptRetention = 7 * 86400;
const providerRetryWindow = 23 * 3600;
const leaseSeconds = 45;
const hex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
export class ProtectionError extends Error {
  constructor(message, status = 503, code = 'security_unavailable', retryAfter = 0) {
    super(message); Object.assign(this, {status, code, retryAfter});
  }
}
const unavailable = () => new ProtectionError('The enquiry security check is temporarily unavailable. Please try again shortly or contact us directly.');
function checked(result) { if (result?.success !== true) throw unavailable(); return result; }
export function protectionConfig(env) {
  const database = env.SMS_ALERTS;
  const hostnames = typeof env.TURNSTILE_HOSTNAMES === 'string' ? env.TURNSTILE_HOSTNAMES.split(',').map(value => value.trim().toLowerCase()).filter(Boolean) : [];
  if (typeof database?.prepare !== 'function' || typeof env.ENQUIRY_HASH_KEY !== 'string' || env.ENQUIRY_HASH_KEY.length < 32 || !env.TURNSTILE_SECRET_KEY?.trim() || !hostnames.length) throw unavailable();
  return {database, hostnames, secret: env.TURNSTILE_SECRET_KEY, hashSecret: env.ENQUIRY_HASH_KEY};
}
async function keyed(secret, purpose, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${purpose}\0${value}`)));
}
export async function countIpAttempt(env, request, now = Math.floor(Date.now() / 1000)) {
  const config = protectionConfig(env);
  const ip = request.headers.get('CF-Connecting-IP');
  // Cloudflare supplies this header. Do not fall back to a visitor-controlled forwarding chain.
  if (!ip || ip.length > 64 || !/^[a-f0-9:.]+$/i.test(ip)) throw unavailable();
  const key = await keyed(config.hashSecret, 'ip', ip.toLowerCase());
  const db = config.database;
  checked(await db.prepare('DELETE FROM enquiry_ip_attempts WHERE created_at <= ?').bind(now - ipWindow).run());
  checked(await db.prepare('DELETE FROM enquiry_receipts WHERE created_at <= ?').bind(now - receiptRetention).run());
  const inserted = checked(await db.prepare('INSERT INTO enquiry_ip_attempts (attempt_id, ip_key, created_at) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM enquiry_ip_attempts WHERE ip_key = ? AND created_at > ?) < 10').bind(crypto.randomUUID(), key, now, key, now - ipWindow).run());
  if (inserted.meta?.changes !== 1) {
    const oldest = await db.prepare('SELECT MIN(created_at) AS oldest FROM enquiry_ip_attempts WHERE ip_key = ? AND created_at > ?').bind(key, now - ipWindow).first();
    const retryAfter = Math.max(1, Number(oldest?.oldest || now) + ipWindow - now);
    throw new ProtectionError(`Too many enquiry attempts from this connection. Please try again in ${Math.ceil(retryAfter / 60)} minute${retryAfter > 60 ? 's' : ''}. Your details have been kept.`, 429, 'rate_limited', retryAfter);
  }
  return {...config, now};
}
export async function identifySubmission(config, requestId, fields) {
  const content = JSON.stringify(fields);
  return {
    key: await keyed(config.hashSecret, 'submission', `${requestId}\0${content}`),
    emailKey: await keyed(config.hashSecret, 'email', fields.email.toLowerCase()),
    // Preserve the existing provider key independently of HMAC-secret rotation.
    contentHash: hex(await crypto.subtle.digest('SHA-256', encoder.encode(content)))
  };
}
export async function findReceipt(config, key) {
  return config.database.prepare('SELECT * FROM enquiry_receipts WHERE request_key = ?').bind(key).first();
}
export async function verifyVisitor(config, request, token, kind) {
  const invalid = () => new ProtectionError('Please complete the security check and try again. If JavaScript is unavailable, contact us directly.', 400, 'verification_required');
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) throw invalid();
  let response, result;
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', signal: AbortSignal.timeout(8000), headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({secret: config.secret, response: token, remoteip: request.headers.get('CF-Connecting-IP')})
    });
    if (!response.ok) throw unavailable();
    result = await response.json();
  } catch { throw unavailable(); }
  if (result?.success !== true) {
    if (result?.['error-codes']?.some(code => ['internal-error', 'missing-input-secret', 'invalid-input-secret'].includes(code))) throw unavailable();
    throw invalid();
  }
  const hostname = String(result.hostname || '').toLowerCase();
  if (!config.hostnames.includes(hostname) || hostname !== new URL(request.url).hostname.toLowerCase() || result.action !== kind) throw invalid();
}
export async function admitSubmission(config, identity) {
  const db = config.database;
  const result = checked(await db.prepare("INSERT INTO enquiry_receipts (request_key, email_key, status, created_at, updated_at) SELECT ?, ?, 'ready', ?, ? WHERE (SELECT COUNT(*) FROM enquiry_receipts WHERE email_key = ? AND created_at > ?) < 3 ON CONFLICT(request_key) DO NOTHING").bind(identity.key, identity.emailKey, config.now, config.now, identity.emailKey, config.now - emailWindow).run());
  const receipt = await findReceipt(config, identity.key);
  if (receipt) return receipt;
  if (result.meta?.changes === 0) {
    const oldest = await db.prepare('SELECT MIN(created_at) AS oldest FROM enquiry_receipts WHERE email_key = ? AND created_at > ?').bind(identity.emailKey, config.now - emailWindow).first();
    const retryAfter = Math.max(1, Number(oldest?.oldest || config.now) + emailWindow - config.now);
    throw new ProtectionError(`We have already received several requests using this email address. Please try again in ${Math.ceil(retryAfter / 60)} minutes, or contact us directly. Your details have been kept.`, 429, 'rate_limited', retryAfter);
  }
  throw unavailable();
}
export async function claimDelivery(config, key) {
  const owner = crypto.randomUUID();
  const result = checked(await config.database.prepare("UPDATE enquiry_receipts SET status = 'sending', lease_until = ?, lease_owner = ?, updated_at = ?, first_attempt_at = COALESCE(first_attempt_at, ?) WHERE request_key = ? AND status != 'accepted' AND lease_until <= ? AND (first_attempt_at IS NULL OR first_attempt_at > ?)").bind(config.now + leaseSeconds, owner, config.now, config.now, key, config.now, config.now - providerRetryWindow).run());
  if (result.meta?.changes === 1) return {owner};
  const receipt = await findReceipt(config, key);
  if (receipt?.status === 'accepted') return {accepted: true};
  if (receipt?.first_attempt_at !== null && receipt?.first_attempt_at <= config.now - providerRetryWindow) throw new ProtectionError('This earlier request cannot be retried safely. Please contact us directly and include your request reference.', 409, 'retry_expired');
  throw new ProtectionError('Your request is still being processed. Please wait a few seconds before retrying with the same details.', 409, 'submission_pending', 3);
}
export async function finishDelivery(config, key, owner, status, receiptId = null) {
  const result = checked(await config.database.prepare("UPDATE enquiry_receipts SET status = ?, receipt_id = ?, lease_until = 0, lease_owner = NULL, updated_at = ? WHERE request_key = ? AND status = 'sending' AND lease_owner = ?").bind(status, receiptId, Math.floor(Date.now() / 1000), key, owner).run());
  return result.meta?.changes === 1;
}
