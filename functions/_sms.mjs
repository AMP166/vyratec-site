// Optional owner alerts. Email remains the authoritative callback notification.
// API: https://developers.clicksend.com/docs/messaging/sms
// D1: https://developers.cloudflare.com/d1/worker-api/prepared-statements/
const retentionSeconds = 30 * 24 * 60 * 60;
const short = (value, length) => Array.from(String(value).replace(/\s+/g, ' ').trim()).slice(0, length).join('');

export async function alertCallbackOwner(env, {receiptId, reference, name, phone, company}) {
  let claimed = false;
  const database = env.SMS_ALERTS;
  // Requiring every setting makes the checked-in integration inert by default.
  if (env.CALLBACK_SMS_ENABLED !== 'true' || !env.CLICKSEND_USERNAME?.trim() || !env.CLICKSEND_API_KEY?.trim() || !/^\+[1-9]\d{7,14}$/.test(env.CALLBACK_SMS_TO || '') || typeof database?.prepare !== 'function') return {status: 'disabled'};
  const suppliedLimit = env.CALLBACK_SMS_DAILY_LIMIT;
  if (suppliedLimit !== undefined && !/^(?:[1-9]|1\d|2[0-5])$/.test(suppliedLimit)) return {status: 'disabled'};
  const dailyLimit = suppliedLimit === undefined ? 10 : Number(suppliedLimit);
  if (typeof receiptId !== 'string' || !/^[a-z0-9_-]{1,200}$/i.test(receiptId)) return {status: 'skipped'};

  const mark = async status => {
    try {
      await database.prepare('UPDATE callback_sms_alerts SET status = ? WHERE receipt_id = ?').bind(status, receiptId).run();
    } catch {
      // Leave the claim in place if a status write fails; never resend automatically.
      console.warn('Callback SMS alert status unavailable');
    }
  };

  try {
    const now = Math.floor(Date.now() / 1000);
    const dayStart = now - (now % 86400);
    // Opportunistic retention cleanup; the database contains no form content.
    await database.prepare('DELETE FROM callback_sms_alerts WHERE created_at < ?').bind(now - retentionSeconds).run();
    // Claim and global daily cap share one atomic D1 write, across all hostnames.
    // Every state counts toward the cap, including rejected/unknown attempts.
    const claim = await database.prepare("INSERT INTO callback_sms_alerts (receipt_id, status, created_at) SELECT ?, 'claimed', ? WHERE (SELECT COUNT(*) FROM callback_sms_alerts WHERE created_at >= ?) < ? ON CONFLICT(receipt_id) DO NOTHING").bind(receiptId, now, dayStart, dailyLimit).run();
    if (claim.success !== true || claim.meta?.changes !== 1) return {status: 'skipped'};
    claimed = true;

    const callerPhone = String(phone).replace(/[^+\d]/g, '');
    const body = `Vyratec callback ${reference}: ${short(name, 32)} | ${callerPhone} | ${short(company, 40)}. See email for preferred time.`;
    const credentials = new TextEncoder().encode(`${env.CLICKSEND_USERNAME}:${env.CLICKSEND_API_KEY}`);
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: {Authorization: `Basic ${btoa(String.fromCharCode(...credentials))}`, 'Content-Type': 'application/json'},
      // Always the configured private owner; never send to the submitted number.
      // Omit sender fields so the account's default numeric sender is used.
      body: JSON.stringify({messages: [{to: env.CALLBACK_SMS_TO, body, source: 'vyratec'}]})
    });
    if (!response.ok) {
      await mark('rejected');
      console.warn('Callback SMS alert rejected');
      return {status: 'rejected'};
    }
    const result = await response.json();
    const messages = result?.data?.messages;
    // An HTTP/top-level success does not establish individual message acceptance.
    const accepted = result?.http_code === 200 && result?.response_code === 'SUCCESS' && Array.isArray(messages) && messages.length === 1 && messages[0]?.status === 'SUCCESS' && typeof messages[0]?.message_id === 'string' && messages[0].message_id.trim().length > 0;
    const status = accepted ? 'queued' : 'rejected';
    await mark(status);
    if (!accepted) console.warn('Callback SMS alert rejected');
    return {status};
  } catch {
    // A timeout may follow provider acceptance. Retain the claim, with no retry.
    if (claimed) await mark('unknown');
    console.warn('Callback SMS alert unavailable; use the email notification');
    return {status: 'unknown'};
  }
}
