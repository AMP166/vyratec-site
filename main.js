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
  const enhanceHeroProcess = () => {
    const root = document.getElementById('hero-process');
    if (!root) return;
    const controls = root.querySelector('#hero-process-controls');
    const svg = root.querySelector('svg');
    const buttons = [...root.querySelectorAll('button[data-process-step]')];
    const layers = [...root.querySelectorAll('g[data-process-layer]')];
    const panels = [...root.querySelectorAll('[data-process-panel]')];
    const completeSequence = (elements, key) => elements.length === 4
      && ['0', '1', '2', '3'].every(index => elements.filter(element => element.dataset[key] === index).length === 1);
    // Leave every step readable if the diagram and its controls do not match.
    if (!controls || !svg || !completeSequence(buttons, 'processStep')
      || !completeSequence(layers, 'processLayer') || !completeSequence(panels, 'processPanel')) return;
    const orderedButtons = ['0', '1', '2', '3'].map(index => buttons.find(button => button.dataset.processStep === index));
    const orderedLayers = ['0', '1', '2', '3'].map(index => layers.find(layer => layer.dataset.processLayer === index));
    const orderedPanels = ['0', '1', '2', '3'].map(index => panels.find(panel => panel.dataset.processPanel === index));
    if (orderedButtons.some((button, index) => !controls.contains(button)
      || button.getAttribute('aria-controls') !== orderedPanels[index].id
      || !svg.contains(orderedLayers[index]))) return;
    let activeStep = -1;
    const selectStep = index => {
      if (index === activeStep) return;
      activeStep = index;
      orderedButtons.forEach((button, step) => {
        const active = step === index;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('is-active', active);
        orderedLayers[step].classList.toggle('is-active', active);
        orderedPanels[step].hidden = !active;
      });
    };
    orderedButtons.forEach((button, index) => {
      // Native buttons retain their normal Tab, Enter and Space behaviour.
      ['pointerenter', 'focus', 'click'].forEach(event => button.addEventListener(event, () => selectStep(index)));
    });
    orderedLayers.forEach((layer, index) => {
      ['pointerenter', 'click'].forEach(event => layer.addEventListener(event, () => selectStep(index)));
    });
    svg.addEventListener('dragstart', event => event.preventDefault());
    selectStep(0);
    root.dataset.enhanced = 'true';
    controls.hidden = false;
  };
  enhanceHeroProcess();
  const enhanceMotion = () => {
    const page = document.documentElement;
    const controls = [...document.querySelectorAll('button[data-motion-toggle]')];
    const graphics = [...document.querySelectorAll('.hero-process, .programme-row, .approach-steps li, .workflow-example, .model-range')];
    let observer;
    let userPaused = false;
    const setPageVisibility = () => { page.dataset.pageVisible = String(!document.hidden); };
    const useStaticGraphics = () => {
      page.dataset.motion = 'paused';
      controls.forEach(button => { button.hidden = true; });
      graphics.forEach(graphic => graphic.classList.remove('motion-ready', 'is-in-view', 'has-entered', 'motion-complete'));
      if (observer) observer.disconnect();
    };
    // Motion is an optional enhancement. A missing API must not affect navigation or forms.
    useStaticGraphics();
    setPageVisibility();
    try {
      if (typeof window.matchMedia !== 'function' || typeof window.IntersectionObserver !== 'function') return;
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      const syncControls = () => {
        const paused = preference.matches || userPaused;
        page.dataset.motion = paused ? 'paused' : 'running';
        if (paused) graphics.forEach(graphic => {
          if (graphic.classList.contains('has-entered')) graphic.classList.add('motion-complete');
        });
        controls.forEach(button => {
          button.hidden = preference.matches;
          button.setAttribute('aria-pressed', String(paused));
          const label = button.querySelector('[data-motion-label]');
          if (label) label.textContent = paused ? 'Resume motion' : 'Pause motion';
        });
      };
      observer = new window.IntersectionObserver(entries => {
        entries.forEach(entry => {
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.1;
          entry.target.classList.toggle('is-in-view', visible);
          if (visible) {
            entry.target.classList.add('has-entered');
            if (page.dataset.motion === 'paused') entry.target.classList.add('motion-complete');
          }
        });
      }, {threshold: [0, 0.1], rootMargin: '0px 0px -24px 0px'});
      graphics.forEach(graphic => {
        observer.observe(graphic);
        graphic.classList.add('motion-ready');
      });
      controls.forEach(button => button.addEventListener('click', () => {
        userPaused = !userPaused;
        syncControls();
      }));
      if (typeof preference.addEventListener === 'function') preference.addEventListener('change', syncControls);
      else if (typeof preference.addListener === 'function') preference.addListener(syncControls);
      document.addEventListener('visibilitychange', setPageVisibility);
      syncControls();
    } catch {
      useStaticGraphics();
    }
  };
  enhanceMotion();
  const trainingRequest = document.getElementById('training-enquiry');
  const callbackRequest = document.getElementById('callback');
  const openRequest = request => {
    if (!request) return;
    // Explicitly close the sibling for browsers without exclusive details support.
    [trainingRequest, callbackRequest].forEach(option => { if (option) option.open = option === request; });
  };
  const openHashRequest = () => {
    if (location.hash === '#callback') openRequest(callbackRequest);
    else if (location.hash === '#contact' || location.hash === '#training-enquiry') openRequest(trainingRequest);
  };
  openHashRequest();
  if (callbackRequest && location.hash === '#callback') {
    // Restore the initial anchor after closing the taller training form changes the layout.
    const alignInitialCallback = () => requestAnimationFrame(() => {
      if (location.hash === '#callback' && callbackRequest.open) {
        callbackRequest.scrollIntoView({block:'start', behavior:'auto'});
      }
    });
    if (document.readyState === 'complete') alignInitialCallback();
    else window.addEventListener('load', alignInitialCallback, {once:true});
  }
  window.addEventListener('hashchange', openHashRequest);
  // Also handle a link to the current hash after the visitor changed the open section.
  document.querySelectorAll('a[href="#callback"], a[href="#contact"]').forEach(link => {
    link.addEventListener('click', () => openRequest(link.hash === '#callback' ? callbackRequest : trainingRequest));
  });
  // Programme pages link back to this form with a fixed, non-personal programme slug.
  const selectedProgramme = new URLSearchParams(location.search).get('programme');
  const programmeInterests = {"executive-ai-briefing":"Executive AI Briefing","applied-ai-training":"Applied AI Training","ai-workflow-automation":"AI Workflows & Automation","custom-corporate-workshops":"Custom Corporate Workshop"};
  const interest = document.getElementById('interest');
  if (interest && Object.hasOwn(programmeInterests, selectedProgramme)) {
    interest.value = programmeInterests[selectedProgramme];
  }
  const enhanceRequestForm = ({formId, messageId, successId, restartId, locationLabel, submitLabel, requestLabel}) => {
    const form = document.getElementById(formId);
    const message = document.getElementById(messageId);
    const success = document.getElementById(successId);
    const restart = document.getElementById(restartId);
    if (!form || !message || !success || !restart) return;
    // Retain the SVG icon when the submit label changes; glyph arrows become emoji on iOS.
    const button = form.querySelector('[type="submit"]');
    const submitArrow = button.querySelector('.arrow-icon').cloneNode(true);
    let started = false;
    let sending = false;
    let requestId = crypto.randomUUID();
    const markStarted = () => {
      if (!started) { started = true; track('enquiry_start', locationLabel); }
    };
    form.addEventListener('input', markStarted);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;
      markStarted();
      sending = true;
      button.disabled = true;
      button.textContent = 'Sending…';
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
          throw new Error(payload?.error || `We couldn’t send your ${requestLabel}. Please try again or contact us by email.`);
        }
        // Conversions are recorded by the server only after Resend accepts the email.
        form.reset();
        form.hidden = true;
        success.hidden = false;
        success.querySelector('.success-reference').textContent = `Request reference: ${payload.reference}`;
        success.focus();
        requestId = crypto.randomUUID();
      } catch (error) {
        message.classList.add('error');
        message.textContent = error.name === 'AbortError'
          ? 'Sending took longer than expected. Please retry; your request reference prevents a duplicate email.'
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
        button.textContent = `${submitLabel} `;
        button.append(submitArrow.cloneNode(true));
      }
    });
    restart.addEventListener('click', () => {
      success.hidden = true; form.hidden = false; started = false;
      message.textContent = ''; form.querySelector('[autocomplete="name"]').focus();
    });
  };
  enhanceRequestForm({formId:'enquiry-form', messageId:'form-message', successId:'form-success', restartId:'new-enquiry', locationLabel:'contact-form', submitLabel:'Send training enquiry', requestLabel:'enquiry'});
  enhanceRequestForm({formId:'callback-form', messageId:'callback-message', successId:'callback-success', restartId:'new-callback', locationLabel:'callback-form', submitLabel:'Request a callback', requestLabel:'callback request'});
})();
