/* Institute of Islamic Learning — interactions (no dependencies) */
(() => {
  'use strict';

  const CFG = {
    whatsapp: '__WHATSAPP__',
    email: '__EMAIL__',
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const on = (el, ev, fn, o) => el && el.addEventListener(ev, fn, o);

  /* ---------------- theme ---------------- */
  const themeBtn = $('#themeToggle');
  const syncThemeLabel = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    if (themeBtn) themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  syncThemeLabel();
  on(themeBtn, 'click', () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    if (dark) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = 'dark';
    try { localStorage.setItem('iil-theme', dark ? 'light' : 'dark'); } catch (e) {}
    syncThemeLabel();
  });

  /* ---------------- header state + scroll progress ---------------- */
  const header = $('#siteHeader');
  const bar = $('#scrollProgress');
  const toTop = $('#toTop');
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    if (header) header.classList.toggle('is-stuck', y > 8);
    if (bar) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    }
    if (toTop) toTop.hidden = y < 600;
    ticking = false;
  };
  on(window, 'scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  on(toTop, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------------- desktop mega menu ---------------- */
  $$('.has-menu').forEach((item) => {
    const btn = $('.nav__toggle', item);
    const menu = $('.megamenu', item);
    if (!btn || !menu) return;
    let timer;
    const open = (v) => { btn.setAttribute('aria-expanded', String(v)); menu.hidden = !v; };
    on(btn, 'click', (e) => { e.preventDefault(); open(menu.hidden); });
    on(item, 'mouseenter', () => { clearTimeout(timer); if (matchMedia('(hover:hover)').matches) open(true); });
    on(item, 'mouseleave', () => { timer = setTimeout(() => open(false), 140); });
    on(item, 'focusout', (e) => { if (!item.contains(e.relatedTarget)) open(false); });
    on(document, 'keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });
  });

  /* ---------------- mobile drawer ---------------- */
  const drawer = $('#mobileNav');
  const burger = $('#burger');
  const setDrawer = (v) => {
    if (!drawer || !burger) return;
    drawer.hidden = !v;
    burger.setAttribute('aria-expanded', String(v));
    document.body.classList.toggle('no-scroll', v);
    if (v) { const f = $('a,button', drawer); f && f.focus(); } else burger.focus();
  };
  on(burger, 'click', () => setDrawer(drawer.hidden));
  on($('#drawerClose'), 'click', () => setDrawer(false));
  on(drawer, 'click', (e) => { if (e.target === drawer) setDrawer(false); });
  on(document, 'keydown', (e) => { if (e.key === 'Escape' && drawer && !drawer.hidden) setDrawer(false); });
  $$('.drawer__list a').forEach((a) => on(a, 'click', () => setDrawer(false)));
  $$('.drawer__acc').forEach((btn) => on(btn, 'click', () => {
    const sub = btn.nextElementSibling;
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    if (sub) sub.hidden = open;
  }));

  /* ---------------- booking modal ---------------- */
  const modal = $('#bookModal');
  $$('[data-book]').forEach((el) => on(el, 'click', (e) => {
    if (!modal || typeof modal.showModal !== 'function') return;      /* fall back to /contact#book */
    const inline = $('[data-booking].booking-form--inline');
    if (inline) return;                                               /* on the contact page, just scroll */
    e.preventDefault();
    modal.showModal();
    setDrawer(false);
  }));
  on(modal, 'click', (e) => { if (e.target === modal) modal.close(); });

  /* ---------------- booking form ---------------- */
  const buildMessage = (data) => {
    const L = [
      '*New free-trial request — Institute of Islamic Learning*', '',
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Phone: ${data.phone}`,
      data.country ? `Country: ${data.country}` : '',
      data.course ? `Course: ${data.course}` : '',
      data.student ? `Student: ${data.student}` : '',
      data.days ? `Schedule: ${data.days}` : '',
      data.time ? `Preferred time: ${data.time}` : '',
      data.notes ? `Notes: ${data.notes}` : '',
    ].filter(Boolean);
    return L.join('\n');
  };

  const markInvalid = (input, msg) => {
    const field = input.closest('.field');
    if (!field) return;
    field.classList.add('is-invalid');
    let err = $('.field__err', field);
    if (!err) { err = document.createElement('span'); err.className = 'field__err'; field.appendChild(err); }
    err.textContent = msg;
    input.setAttribute('aria-invalid', 'true');
  };
  const clearInvalid = (input) => {
    const field = input.closest('.field');
    if (!field) return;
    field.classList.remove('is-invalid');
    const err = $('.field__err', field);
    if (err) err.remove();
    input.removeAttribute('aria-invalid');
  };

  $$('[data-booking]').forEach((form) => {
    $$('input,select,textarea', form).forEach((i) => on(i, 'input', () => clearInvalid(i)));
    on(form, 'submit', (e) => {
      e.preventDefault();
      const status = $('.form-status', form);
      let firstBad = null;
      $$('[required]', form).forEach((input) => {
        clearInvalid(input);
        const v = input.value.trim();
        let bad = '';
        if (!v) bad = 'This field is required.';
        else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) bad = 'Please enter a valid email address.';
        else if (input.type === 'tel' && v.replace(/\D/g, '').length < 7) bad = 'Please enter a valid phone number.';
        if (bad) { markInvalid(input, bad); firstBad = firstBad || input; }
      });
      if (firstBad) {
        if (status) { status.textContent = 'Please check the highlighted fields.'; status.classList.add('is-error'); }
        firstBad.focus();
        return;
      }
      if (status) { status.textContent = ''; status.classList.remove('is-error'); }

      const data = Object.fromEntries(new FormData(form).entries());
      const msg = buildMessage(data);
      const wa = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(msg)}`;
      const mail = `mailto:${CFG.email}?subject=${encodeURIComponent('Free trial request — ' + data.name)}&body=${encodeURIComponent(msg)}`;

      const done = $('.form-done', form);
      if (done) {
        const link = $('[data-wa]', done);
        const mlink = $('[data-mail]', done);
        if (link) link.href = wa;
        if (mlink) mlink.href = mail;
      }
      form.classList.add('is-sent');
      try { window.open(wa, '_blank', 'noopener'); } catch (err) {}
      const heading = done && $('h3', done);
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
    });
  });

  /* ---------------- pricing tabs ---------------- */
  const priceRoot = $('[data-pricing]');
  if (priceRoot) {
    const setActive = (group, value) => {
      $$(`[data-tabgroup="${group}"] .tab`, priceRoot).forEach((t) => t.setAttribute('aria-selected', String(t.dataset.value === value)));
    };
    const render = () => {
      const region = $('[data-tabgroup="region"] [aria-selected="true"]', priceRoot)?.dataset.value || 'us';
      const dur = $('[data-tabgroup="duration"] [aria-selected="true"]', priceRoot)?.dataset.value || '30';
      $$('[data-panel]', priceRoot).forEach((p) => { p.hidden = p.dataset.region !== region || p.dataset.duration !== dur; });
    };
    $$('.tab', priceRoot).forEach((tab) => on(tab, 'click', () => { setActive(tab.closest('[data-tabgroup]').dataset.tabgroup, tab.dataset.value); render(); }));
    $$('[data-tabgroup]', priceRoot).forEach((group) => on(group, 'keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      const tabs = $$('.tab', group);
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); next.click();
    }));
    render();
  }

  /* ---------------- fee calculator ---------------- */
  const calc = $('#calc');
  if (calc) {
    let RATES = null;
    try { RATES = JSON.parse($('#rateData')?.textContent || 'null'); } catch (e) {}
    const out = $('#calcAmount');
    const sub = $('#calcSub');
    const run = () => {
      if (!RATES || !out) return;
      const region = $('[name=region]', calc).value;
      const dur = $('[name=duration]', calc).value;
      const per = Number($('[name=perweek]', calc).value);
      const r = RATES[region];
      if (!r) return;
      const rate = r.rates[dur];
      let total = rate * per;
      const disc = per >= 5 ? 0.06 : per >= 4 ? 0.03 : 0;
      total = total * (1 - disc);
      const rounded = Math.round(total);
      out.textContent = r.symbol + rounded;
      if (sub) sub.textContent = `${per * 4} classes / month · ${dur} minutes each${disc ? ` · ${Math.round(disc * 100)}% multi-class discount applied` : ''}`;
    };
    $$('select', calc).forEach((s) => on(s, 'change', run));
    run();
  }

  /* ---------------- testimonials ---------------- */
  const track = $('#ttrack');
  if (track) {
    const step = () => Math.max(260, track.querySelector('.tslide')?.getBoundingClientRect().width + 20 || 300);
    on($('#tprev'), 'click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    on($('#tnext'), 'click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    let auto = setInterval(() => {
      if (document.hidden) return;
      const end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      track.scrollTo({ left: end ? 0 : track.scrollLeft + step(), behavior: 'smooth' });
    }, 5200);
    ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => on(track, ev, () => { clearInterval(auto); auto = null; }, { passive: true }));
  }

  /* ---------------- reveal + counters ---------------- */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealables = $$('.reveal');
  if (revealables.length) {
    if (reduce || !('IntersectionObserver' in window)) revealables.forEach((el) => el.classList.add('is-in'));
    else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.style.transitionDelay = (Number(en.target.dataset.delay || 0)) + 'ms';
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      revealables.forEach((el) => io.observe(el));
    }
  }

  const counters = $$('[data-count]');
  if (counters.length && !reduce && 'IntersectionObserver' in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        co.unobserve(el);
        const target = Number(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const dur = 1300;
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased).toLocaleString() + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    counters.forEach((el) => co.observe(el));
  }

  /* ---------------- flip cards on touch ---------------- */
  $$('.flip').forEach((f) => on(f, 'click', () => {
    if (matchMedia('(hover:none)').matches) f.classList.toggle('is-flipped');
  }));

  /* ---------------- deep link: open modal from #book on non-contact pages ---------------- */
  if (location.hash === '#book' && !$('.booking-form--inline') && modal?.showModal) {
    modal.showModal();
  }
})();
