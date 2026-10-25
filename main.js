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
  const protectionError = 'The security check is temporarily unavailable. Please try again or contact us by email.';
  let protectionConfig;
  let protectionScript;
  const loadProtectionConfig = () => {
    if (!protectionConfig) {
      protectionConfig = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch('/api/form-config', {headers:{Accept:'application/json'}, cache:'no-store', signal:controller.signal});
          const config = await response.json();
          if (!response.ok || typeof config.sitekey !== 'string' || !/^[a-z0-9_-]{10,100}$/i.test(config.sitekey)) throw new Error(protectionError);
          return config;
        } finally { clearTimeout(timeout); }
      })().catch(error => { protectionConfig = null; throw error; });
    }
    return protectionConfig;
  };
  const loadProtectionScript = () => {
    if (window.turnstile?.render) return Promise.resolve(window.turnstile);
    if (!protectionScript) {
      protectionScript = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        const finish = error => {
          clearTimeout(timeout);
          script.onload = script.onerror = null;
          if (error) { script.remove(); reject(new Error(protectionError)); }
          else resolve(window.turnstile);
        };
        const timeout = setTimeout(() => finish(true), 12000);
        script.onload = () => window.turnstile?.render ? finish(false) : finish(true);
        script.onerror = () => finish(true);
        document.head.append(script);
      }).catch(error => { protectionScript = null; throw error; });
    }
    return protectionScript;
  };
  const createFormProtection = (form, action) => {
    const container = form.querySelector('.form-verification');
    let widgetId;
    let preparing;
    let pending;
    const finish = (error, token) => {
      if (!pending) return;
      const current = pending;
      pending = null;
      clearTimeout(current.timeout);
      if (error) current.reject(new Error(error));
      else current.resolve(token);
    };
    const prepare = () => {
      if (widgetId !== undefined) return Promise.resolve();
      if (!preparing) {
        preparing = (async () => {
          const config = await loadProtectionConfig();
          const turnstile = await loadProtectionScript();
          widgetId = turnstile.render(container, {
            sitekey:config.sitekey, action, theme:'light', size:'compact',
            execution:'execute', appearance:'interaction-only', retry:'never', 'response-field':false,
            callback:token => finish(null, token),
            'error-callback':() => finish(protectionError),
            'unsupported-callback':() => finish('Your browser could not complete the security check. Please contact us by email.'),
            'expired-callback':() => finish('The security check expired. Please try sending again.'),
            'timeout-callback':() => finish('The security check timed out. Please try sending again.')
          });
          if (widgetId === undefined || widgetId === null) throw new Error(protectionError);
        })().catch(error => { preparing = null; widgetId = undefined; throw error; });
      }
      return preparing;
    };
    return {
      prepare,
      async verify() {
        try { await prepare(); } catch { throw new Error(protectionError); }
        // Tokens are single-use. A failed attempt always gets a fresh challenge.
        window.turnstile.reset(widgetId);
        return new Promise((resolve, reject) => {
          pending = {resolve, reject, timeout:setTimeout(() => finish('The security check timed out. Please try sending again.'), 120000)};
          try { window.turnstile.execute(`#${container.id}`); }
          catch { finish(protectionError); }
        });
      },
      reset() {
        finish('Please try sending again.');
        if (widgetId !== undefined) {
          try { window.turnstile.reset(widgetId); } catch { widgetId = undefined; preparing = null; }
        }
      }
    };
  };
  const retryDeadline = (response, payload) => {
    const value = payload?.retryAfter ?? response.headers.get('Retry-After');
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds > 0) return Date.now() + Math.min(seconds, 86400) * 1000;
    const date = Date.parse(value);
    return Number.isFinite(date) && date > Date.now() ? Math.min(date, Date.now() + 86400000) : 0;
  };
  const retryTimeMessage = deadline => {
    const seconds = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
    return seconds < 60
      ? `Please try again in ${seconds} seconds.`
      : `Please try again after ${new Date(deadline).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}.`;
  };
  const enhanceRequestForm = ({formId, messageId, successId, restartId, locationLabel, submitLabel, requestLabel, action}) => {
    const form = document.getElementById(formId);
    const message = document.getElementById(messageId);
    const success = document.getElementById(successId);
    const restart = document.getElementById(restartId);
    if (!form || !message || !success || !restart) return;
    // Retain the SVG icon when the submit label changes; glyph arrows become emoji on iOS.
    const button = form.querySelector('[type="submit"]');
    const submitArrow = button.querySelector('.arrow-icon').cloneNode(true);
    const protection = createFormProtection(form, action);
    let started = false;
    let sending = false;
    let requestId = crypto.randomUUID();
    let previousAttempt;
    let cooldown;
    const showError = text => {
      message.className = 'form-message error';
      message.textContent = text;
      const email = document.createElement('a');
      email.href = 'mailto:shop@vyratec.com';
      email.textContent = 'Contact us';
      message.append(document.createElement('br'), email);
      message.focus();
    };
    const markStarted = () => {
      if (!started) { started = true; track('enquiry_start', locationLabel); }
    };
    form.addEventListener('input', markStarted);
    // Load only when a visitor reaches a form; verification runs on submission.
    form.addEventListener('focusin', () => protection.prepare().catch(() => {}), {once:true});
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;
      markStarted();
      const data = new FormData(form);
      data.set('requestId', requestId);
      const signature = JSON.stringify([...data].filter(([name]) => name !== 'cf-turnstile-response'));
      if (cooldown?.signature === signature && cooldown.until > Date.now()) {
        showError(`Your details have been kept. ${retryTimeMessage(cooldown.until)}`);
        return;
      }
      sending = true;
      button.disabled = true;
      button.textContent = 'Checking…';
      form.setAttribute('aria-busy', 'true');
      message.className = 'form-message';
      message.textContent = 'Completing the security check. If a check appears above, follow its instructions.';
      const send = async token => {
        const current = new FormData(form);
        current.set('requestId', requestId);
        if (JSON.stringify([...current].filter(([name]) => name !== 'cf-turnstile-response')) !== signature) {
          throw new Error('Your details changed during the security check. Please review them and send again.');
        }
        data.set('cf-turnstile-response', token);
        previousAttempt = {signature, token};
        button.textContent = 'Sending…';
        message.textContent = '';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch('/api/enquire', {method:'POST', body:data, headers:{Accept:'application/json'}, signal:controller.signal});
          return {response, payload:await response.json().catch(() => null)};
        } finally { clearTimeout(timeout); }
      };
      try {
        // The same submission can recover an accepted receipt after a timeout,
        // even if its original single-use token has already been consumed.
        const recovering = previousAttempt?.signature === signature;
        const token = recovering ? previousAttempt.token : await protection.verify();
        let {response, payload} = await send(token);
        if (recovering && !response.ok && payload?.code === 'verification_required') {
          button.textContent = 'Checking…';
          message.textContent = 'Refreshing the security check. If a check appears above, follow its instructions.';
          ({response, payload} = await send(await protection.verify()));
        }
        if (!response.ok || !payload?.ok || !payload.reference) {
          const deadline = [409, 429].includes(response.status) ? retryDeadline(response, payload) : 0;
          if (deadline) cooldown = {signature, until:deadline};
          throw new Error(`${payload?.error || `We couldn’t send your ${requestLabel}. Please try again or contact us by email.`}${deadline ? ` ${retryTimeMessage(deadline)}` : ''}`);
        }
        // Conversions are recorded by the server only after Resend accepts the email.
        form.reset();
        form.hidden = true;
        success.hidden = false;
        success.querySelector('.success-reference').textContent = `Request reference: ${payload.reference}`;
        success.focus();
        requestId = crypto.randomUUID();
        previousAttempt = null;
        cooldown = null;
      } catch (error) {
        showError(error.name === 'AbortError'
          ? 'Sending took longer than expected. Please retry; your request reference prevents a duplicate email.'
          : (error instanceof TypeError ? 'We couldn’t connect. Your details have been kept; please try again or contact us by email.'
            : (error.message || `We couldn’t send your ${requestLabel}. Please try again or contact us by email.`)));
      } finally {
        protection.reset();
        sending = false;
        form.removeAttribute('aria-busy');
        button.disabled = false;
        button.textContent = `${submitLabel} `;
        button.append(submitArrow.cloneNode(true));
      }
    });
    restart.addEventListener('click', () => {
      success.hidden = true; form.hidden = false; started = false;
      previousAttempt = null; cooldown = null;
      message.textContent = ''; form.querySelector('[autocomplete="name"]').focus();
    });
    // The base HTML explains the email alternative if JavaScript cannot run.
    form.querySelector('[data-form-static-fallback]').hidden = true;
    button.disabled = false;
  };
  enhanceRequestForm({formId:'enquiry-form', messageId:'form-message', successId:'form-success', restartId:'new-enquiry', locationLabel:'contact-form', submitLabel:'Send training enquiry', requestLabel:'enquiry', action:'training'});
  enhanceRequestForm({formId:'callback-form', messageId:'callback-message', successId:'callback-success', restartId:'new-callback', locationLabel:'callback-form', submitLabel:'Request a callback', requestLabel:'callback request', action:'callback'});
})();
