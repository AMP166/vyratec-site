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
    const graphics = [...document.querySelectorAll([
      '.hero-process', '.programme-row', '.approach-steps li', '.workflow-example', '.model-endpoint',
      '.capability', '.experience-record', '.section-heading', '.local-ai-priorities article',
      '.contact-copy', '.training-facts', '.training-aside', '.programme-section', '.training-intro',
      '.information-heading', '.information-content section', '.information-contact', '.error-code', '.footer-brand'
    ].join(', '))];
    const revealCandidates = [...document.querySelectorAll([
      '.section-heading', '.capability', '.experience-record', '.practice-copy', '.programme-intro',
      '.programme-row', '.approach-steps li', '.local-ai-copy', '.model-range', '.local-ai-priorities article',
      '.faq-grid > div:first-child', '.contact-copy', '.form-panel', '.training-intro', '.programme-section',
      '.training-aside', '.footer-brand'
    ].join(', '))];
    // Reveal a block once rather than compounding transforms on nested content.
    const reveals = revealCandidates.filter(element => !revealCandidates.some(parent => parent !== element && parent.contains(element)));
    let graphicObserver;
    let revealObserver;
    let resizeFrame;
    let preference;
    const setPageVisibility = () => { page.dataset.pageVisible = String(!document.hidden); };
    const reveal = element => {
      element.classList.remove('reveal-pending');
      element.classList.add('reveal-shown');
      if (revealObserver) revealObserver.unobserve(element);
    };
    const showAll = () => reveals.forEach(reveal);
    const useStaticGraphics = () => {
      page.dataset.motion = 'paused';
      if (graphicObserver) graphicObserver.disconnect();
      if (revealObserver) revealObserver.disconnect();
      graphics.forEach(graphic => graphic.classList.remove('motion-ready', 'is-in-view', 'has-entered', 'motion-complete'));
      reveals.forEach(element => element.classList.remove('scroll-reveal', 'reveal-pending', 'reveal-shown'));
    };
    const hashTarget = () => {
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
      const target = id ? document.getElementById(id) : null;
      // Page-wide anchors must not finish every section's pending entrance.
      return target && target !== document.body && target !== page && target.tagName !== 'MAIN' ? target : null;
    };
    const revealHashTarget = () => {
      const target = hashTarget();
      if (target) reveals.forEach(element => {
        if (element === target || element.contains(target) || target.contains(element)) reveal(element);
      });
    };
    // Observe the diagram itself: a tall text column must not start its graphic offscreen.
    const graphicTargets = new Map();
    graphics.forEach(graphic => {
      const selector = graphic.matches('.hero-process') ? '.process-scene'
        : graphic.matches('.programme-row') ? '.programme-mark'
        : graphic.matches('.capability') ? '.capability-mark'
        : graphic.matches('.experience-record') ? '.experience-circuit'
        : graphic.matches('.workflow-example') ? '.workflow-line'
        : graphic.matches('.model-endpoint') ? '.model-hardware'
        : graphic.matches('.contact-copy') ? '.contact-circuit' : null;
      const target = (selector && graphic.querySelector(selector)) || graphic;
      if (!graphicTargets.has(target)) graphicTargets.set(target, []);
      graphicTargets.get(target).push(graphic);
    });
    const observeMotion = () => {
      if (graphicObserver) graphicObserver.disconnect();
      if (revealObserver) revealObserver.disconnect();
      if (preference.matches) return;
      // Pixel margins stay proportional to viewport height, including portrait phones.
      const inset = Math.round(window.innerHeight * 0.12);
      const rootMargin = '0px 0px -' + inset + 'px 0px';
      graphicObserver = new window.IntersectionObserver(entries => {
        entries.forEach(entry => {
          const visible = entry.isIntersecting;
          graphicTargets.get(entry.target).forEach(graphic => {
            graphic.classList.toggle('is-in-view', visible);
            if (visible) graphic.classList.add('has-entered');
          });
        });
      }, {threshold: 0, rootMargin});
      revealObserver = new window.IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) reveal(entry.target);
        });
      }, {threshold: 0, rootMargin});
      graphicTargets.forEach((roots, target) => graphicObserver.observe(target));
      reveals.forEach(element => {
        if (element.classList.contains('reveal-pending')) revealObserver.observe(element);
      });
    };
    const syncPreference = () => {
      page.dataset.motion = preference.matches ? 'paused' : 'running';
      if (preference.matches) {
        // A preference change finishes entries and exposes all content immediately.
        graphics.forEach(graphic => {
          graphic.classList.add('has-entered', 'motion-complete');
          graphic.classList.remove('is-in-view');
        });
        showAll();
      }
      observeMotion();
    };
    // Missing APIs or an enhancement error always leave a readable static page.
    useStaticGraphics();
    setPageVisibility();
    try {
      if (typeof window.matchMedia !== 'function' || typeof window.IntersectionObserver !== 'function') return;
      preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      graphics.forEach(graphic => graphic.classList.add('motion-ready'));
      // Arm reveals after the browser applies any initial fragment position.
      requestAnimationFrame(() => {
        try {
          const viewportHeight = window.innerHeight;
          const initialTarget = hashTarget();
          // Read layout once before applying styles. Never hide content already in view.
          const initialRects = reveals.map(element => [element, element.getBoundingClientRect()]);
          initialRects.forEach(([element, rect]) => {
            const containsTarget = initialTarget && (element === initialTarget || element.contains(initialTarget) || initialTarget.contains(element));
            element.classList.add('scroll-reveal');
            if (!preference.matches && !containsTarget && rect.top >= viewportHeight && rect.height > 0 && rect.width > 0) element.classList.add('reveal-pending');
            else reveal(element);
          });
          syncPreference();
        } catch {
          useStaticGraphics();
        }
      });
      const safelySyncPreference = () => {
        try { syncPreference(); } catch { useStaticGraphics(); }
      };
      if (typeof preference.addEventListener === 'function') preference.addEventListener('change', safelySyncPreference);
      else if (typeof preference.addListener === 'function') preference.addListener(safelySyncPreference);
      document.addEventListener('visibilitychange', setPageVisibility);
      window.addEventListener('hashchange', revealHashTarget);
      document.addEventListener('focusin', event => {
        const pending = event.target.closest?.('.reveal-pending');
        if (pending) reveal(pending);
      });
      window.addEventListener('resize', () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          try { observeMotion(); } catch { useStaticGraphics(); }
        });
      });
    } catch {
      useStaticGraphics();
    }
  };
  enhanceMotion();
  const enhanceSectionNavigation = () => {
    const main = document.getElementById('main');
    const sectionIds = ['capabilities', 'programmes', 'approach', 'experience', 'local-ai'];
    const links = [...document.querySelectorAll('.desktop-nav a, #mobile-nav a')]
      .filter(link => sectionIds.some(id => link.getAttribute('href') === `#${id}`));
    // Programme and information pages link to /#section and retain their normal navigation.
    if (!main || !links.length || sectionIds.some(id => !main.contains(document.getElementById(id)))
      || typeof window.IntersectionObserver !== 'function') return;
    const sections = [...main.children].filter(element => element.tagName === 'SECTION');
    const visible = new Set();
    let observer;
    let resizeFrame;
    const setCurrent = section => {
      links.forEach(link => {
        if (section && link.getAttribute('href') === `#${section.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const observeSections = () => {
      if (observer) observer.disconnect();
      visible.clear();
      setCurrent(null);
      const height = window.innerHeight;
      const headerHeight = document.querySelector('.header-inner')?.getBoundingClientRect().height || 0;
      const readingLine = Math.max(0, Math.min(height - 2, Math.max(headerHeight + 24, height * 0.23)));
      // A narrow reading band switches sections without watching every scroll event.
      observer = new window.IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        setCurrent(sections.find(section => visible.has(section)));
      }, {threshold: 0, rootMargin: `-${Math.floor(readingLine)}px 0px -${Math.max(0, Math.floor(height - readingLine - 2))}px 0px`});
      sections.forEach(section => observer.observe(section));
    };
    try {
      observeSections();
      window.addEventListener('resize', () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(observeSections);
      });
    } catch {
      if (observer) observer.disconnect();
      setCurrent(null);
    }
  };
  enhanceSectionNavigation();
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
