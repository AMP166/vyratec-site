import {json} from '../_lib.mjs';
import {protectionConfig} from '../_abuse.mjs';

// The widget sitekey is public. Credentials and visitor information never leave
// the server through this endpoint, including when configuration is incomplete.
export function onRequestGet({env}) {
  const sitekey = env.TURNSTILE_SITE_KEY;
  let ready = false;
  try { protectionConfig(env); ready = true; } catch {}
  if (!ready || typeof sitekey !== 'string' || !/^[a-zA-Z0-9_-]{10,100}$/.test(sitekey)) {
    return json({error: 'The form security check is unavailable. Please contact us by email.'}, 503);
  }
  return json({sitekey});
}
