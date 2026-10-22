(() => {
  'use strict';
  // Only fixed event labels are transmitted; never form values or URL queries.
  const track = (event, location = 'website') => {
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
    fetch('/api/events', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({event, location}), keepalive: true
    }).catch(() => {});
  };
  track('page_view');
  const toggle = document.querySelector('.menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  const closeMenu = () => {
    if (!toggle || !mobileNav) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    mobileNav.hidden = true;
  };
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
      mobileNav.hidden = open;
    });
    mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); toggle.focus(); }
    });
    window.matchMedia('(min-width: 961px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  }
  document.querySelectorAll('[data-cta]').forEach(link => link.addEventListener('click', () => {
    track('cta_click', link.dataset.cta);
    const interest = document.getElementById('interest');
    if (link.dataset.interest && interest) interest.value = link.dataset.interest;
  }));
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  const form = document.getElementById('enquiry-form');
  const message = document.getElementById('form-message');
  const success = document.getElementById('form-success');
  if (!form || !message || !success) return;
  // Retain the SVG icon when the submit label changes; glyph arrows become emoji on iOS.
  const submitArrow = form.querySelector('.form-submit .arrow-icon').cloneNode(true);
  // Programme pages link back to this form with a fixed, non-personal programme slug.
  const selectedProgramme = new URLSearchParams(location.search).get('programme');
  const programmeInterests = {"executive-ai-briefing":"Executive AI Briefing","applied-ai-training":"Applied AI Training","ai-workflow-automation":"AI Workflows & Automation","custom-corporate-workshops":"Custom Corporate Workshop"};
  if (Object.hasOwn(programmeInterests, selectedProgramme)) {
    document.getElementById('interest').value = programmeInterests[selectedProgramme];
  }
  let started = false;
  let sending = false;
  let requestId = crypto.randomUUID();
  form.addEventListener('input', () => {
    if (!started) { started = true; track('enquiry_start', 'contact-form'); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    sending = true;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Sending enquiry…';
    form.setAttribute('aria-busy', 'true');
    message.className = 'form-message';
    message.textContent = '';
    const data = new FormData(form);
    data.set('requestId', requestId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/enquire', {
        method: 'POST', body: data, headers: {Accept: 'application/json'}, signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload.reference) {
        throw new Error(payload?.error || 'We couldn’t send your enquiry. Please try again or email us directly.');
      }
      // Primary conversion is recorded by the server only after Resend accepts the email.
      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.querySelector('.success-reference').textContent = `Enquiry reference: ${payload.reference}`;
      success.focus();
      requestId = crypto.randomUUID();
    } catch (error) {
      message.classList.add('error');
      message.textContent = error.name === 'AbortError'
        ? 'Sending took longer than expected. Please retry; your enquiry reference prevents a duplicate email.'
        : error.message;
      const email = document.createElement('a');
      email.href = 'mailto:shop@vyratec.com';
      email.textContent = 'Contact us';
      message.append(document.createElement('br'), email);
      message.focus();
    } finally {
      clearTimeout(timeout);
      sending = false;
      form.removeAttribute('aria-busy');
      button.disabled = false;
      button.textContent = 'Send training enquiry ';
      button.append(submitArrow.cloneNode(true));
    }
  });
  document.getElementById('new-enquiry').addEventListener('click', () => {
    success.hidden = true; form.hidden = false; started = false;
    message.textContent = ''; document.getElementById('name').focus();
  });
})();
