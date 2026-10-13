// Cloudflare Pages Functions: POST /api/enquire
// To activate, configure RESEND_API_KEY, CONTACT_TO and CONTACT_FROM in Cloudflare Pages env vars.
// CONTACT_FROM must be a sender domain verified with Resend.
export async function onRequestPost({request, env}) {
  const json = (payload, status=200) => new Response(JSON.stringify(payload), {
    status, headers: {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store'}
  });
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 30000) return json({ok:false,error:'Message too large.'},413);
    const form = await request.formData();
    if (String(form.get('website')||'').trim()) return json({ok:true});
    const get = (key, max) => String(form.get(key)||'').trim().slice(0,max);
    const name = get('name',140), email = get('email',200), company = get('company',200);
    const interest = get('interest',160), message = get('message',4000);
    if (!name || !company || !interest || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ok:false,error:'Please complete the required fields.'},400);
    }
    if (!env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) {
      return json({ok:false,error:'Online enquiries are not connected yet. Please contact Vyratec using your usual channel.'},503);
    }
    const text = [
      'New Vyratec training enquiry','',`Name: ${name}`,`Email: ${email}`,`Organisation: ${company}`,
      `Programme: ${interest}`,'','Message:',message || '(not supplied)'
    ].join('\n');
    const res = await fetch('https://api.resend.com/emails',{
      method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:env.CONTACT_FROM,to:[env.CONTACT_TO],reply_to:email,subject:`Vyratec enquiry — ${company}`,text})
    });
    if (!res.ok) return json({ok:false,error:'The enquiry could not be sent. Please try again later.'},502);
    return json({ok:true});
  } catch (err) { return json({ok:false,error:'Unable to process the enquiry right now.'},500); }
}
export async function onRequestGet(){return new Response('Method not allowed',{status:405})}
