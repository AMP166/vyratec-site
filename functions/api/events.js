import {json, isSameOrigin, readBody, recordEvent, ctaLocations} from '../_lib.mjs';
// enquiry_success is intentionally NOT accepted from visitors.
const clientEvents = ['page_view', 'cta_click', 'enquiry_start'];
export async function onRequestPost({request, env}) {
  if (!isSameOrigin(request)) return json({ok: false}, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ok: false}, 415);
  try {
    const data = JSON.parse(new TextDecoder().decode(await readBody(request, 1024)));
    if (!clientEvents.includes(data.event) || !ctaLocations.includes(data.location)) return json({ok: false}, 400);
    recordEvent(env, data.event, data.location, request);
    return new Response(null, {status: 204, headers: {'Cache-Control': 'no-store'}});
  } catch (error) { return json({ok: false}, error instanceof RangeError ? 413 : 400); }
}
export function onRequestGet() { return new Response('Method not allowed', {status: 405, headers: {Allow: 'POST'}}); }
