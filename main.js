(() => {
  const toggle = document.querySelector('.menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
      mobileNav.hidden = open;
    });
    mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      mobileNav.hidden = true; toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    }));
    window.addEventListener('resize', () => {
      if (window.innerWidth > 860) { mobileNav.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
    });
  }
  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();
  const form = document.getElementById('enquiry-form');
  const msg = document.getElementById('form-message');
  if (form && msg) form.addEventListener('submit', async e => {
    e.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (!form.reportValidity()) return;
    button.disabled = true; button.textContent = 'Sending enquiry…';
    msg.className = 'form-message'; msg.textContent = '';
    try {
      const r = await fetch('/api/enquire', { method:'POST', body:new FormData(form), headers:{'Accept':'application/json'} });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || 'The form is not available yet. Please try again later.');
      form.reset(); msg.textContent = 'Thanks. Your enquiry has been sent; we’ll be in touch.'; msg.classList.add('success');
    } catch (err) {
      msg.textContent = err.message || 'Unable to send. Please try again shortly.';
      msg.classList.add('error');
    } finally { button.disabled = false; button.innerHTML = 'Send an enquiry <span aria-hidden="true">↗</span>'; }
  });
})();
