/* ==================================================================
 * Fernhill — main.js
 * Vanilla JavaScript, no jQuery. One function per feature, each with
 * guard clauses so it runs safely on pages that lack its markup.
 * ================================================================== */
(function () {
  'use strict';

  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var money = function (n, cents) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ----------------------------------------------------------------
   * Studio data — edit opening hours and lawn prices here.
   * ---------------------------------------------------------------- */
  var STUDIO_TZ = 'America/Los_Angeles';
  // Day number (0 = Sunday) → [opens, closes] in decimal hours, or null when closed.
  var HOURS = { 0: null, 1: [7.5, 17.5], 2: [7.5, 17.5], 3: [7.5, 17.5], 4: [7.5, 17.5], 5: [7.5, 16.5], 6: [9, 13] };

  var LAWN = {
    base: 42,          // call-out part of each visit, dollars
    perSqft: 0.0062,   // dollars per square foot per visit
    plans: {
      essential: { name: 'Essential', visits: 4, discount: 1 },
      seasonal:  { name: 'Seasonal',  visits: 6, discount: 0.94 },
      complete:  { name: 'Complete',  visits: 9, discount: 0.88 }
    },
    // Yearly price of each extra for a lawn of s square feet.
    extras: {
      overseed: function (s) { return 85 + s * 0.016; },
      aerate:   function (s) { return 65 + s * 0.009; },
      mowing:   function (s) { return 28 * (28 + s * 0.0035); },
      leaves:   function (s) { return 2 * (55 + s * 0.004); }
    }
  };

  /* ----------------------------------------------------------------
   * Mobile menu: close after a link is chosen.
   * ---------------------------------------------------------------- */
  function initNav() {
    var collapse = document.getElementById('primary-nav');
    if (!collapse || !window.bootstrap) return;
    $$('a', collapse).forEach(function (link) {
      link.addEventListener('click', function () {
        if (!collapse.classList.contains('show')) return;
        window.bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).hide();
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && collapse.classList.contains('show')) {
        window.bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).hide();
        var toggler = $('.navbar-toggler');
        if (toggler) toggler.focus();
      }
    });
  }

  /* ----------------------------------------------------------------
   * Header border and shadow once the page scrolls.
   * ---------------------------------------------------------------- */
  function initStickyHeader() {
    var header = $('.site-header');
    if (!header) return;
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ----------------------------------------------------------------
   * Home page: highlight the nav link for the section in view.
   * ---------------------------------------------------------------- */
  function initScrollSpy() {
    var links = $$('.nav-menu [data-spy]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (l) { map[l.getAttribute('data-spy')] = l; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('active'); });
        if (map[entry.target.id]) map[entry.target.id].classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) obs.observe(sec);
    });
  }

  /* ----------------------------------------------------------------
   * Fade-up reveal. Content is only hidden while .js is on <html>.
   * ---------------------------------------------------------------- */
  function initReveal() {
    var els = $$('.reveal');
    if (!els.length) return;
    if (prefersReduced || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries, o) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); o.unobserve(entry.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { obs.observe(el); });
  }

  /* ----------------------------------------------------------------
   * Count-up numbers. The final figure is in the HTML already.
   * ---------------------------------------------------------------- */
  function initCountUp() {
    var nums = $$('[data-count]');
    if (!nums.length || prefersReduced || !('IntersectionObserver' in window)) return;
    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-suffix') || '';
      var start = null;
      var tick = function (ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / 1400, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US') + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    var obs = new IntersectionObserver(function (entries, o) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); o.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { obs.observe(n); });
  }

  /* ----------------------------------------------------------------
   * Footer year.
   * ---------------------------------------------------------------- */
  function initYear() {
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ----------------------------------------------------------------
   * Opening hours: highlight today and show open / closed, in the
   * studio's own time zone.
   * ---------------------------------------------------------------- */
  function initOpenStatus() {
    var statuses = $$('[data-open-status]');
    var lists = $$('[data-hours]');
    if (!statuses.length && !lists.length) return;

    var day, hour;
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: STUDIO_TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      var get = function (t) { return (parts.filter(function (p) { return p.type === t; })[0] || {}).value; };
      day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      hour = parseInt(get('hour'), 10) + parseInt(get('minute'), 10) / 60;
    } catch (e) {
      var now = new Date(); day = now.getDay(); hour = now.getHours() + now.getMinutes() / 60;
    }

    lists.forEach(function (list) {
      var li = $('[data-day="' + day + '"]', list);
      if (li) li.classList.add('today');
    });

    var fmt = function (h) {
      var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      var ampm = hh >= 12 ? 'pm' : 'am';
      return ((hh % 12) || 12) + (mm ? ':' + (mm < 10 ? '0' : '') + mm : '') + ampm;
    };
    var today = HOURS[day];
    var open = today && hour >= today[0] && hour < today[1];
    var text;
    if (open) {
      text = 'Open now, until ' + fmt(today[1]);
    } else {
      var names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      for (var i = 0; i < 8; i++) {
        var d = (day + i) % 7, h = HOURS[d];
        if (!h || (i === 0 && hour >= h[0])) continue;
        text = 'Closed now, opens ' + (i === 0 ? 'today' : i === 1 ? 'tomorrow' : names[d]) + ' at ' + fmt(h[0]);
        break;
      }
    }
    statuses.forEach(function (s) {
      s.classList.add(open ? 'is-open' : 'is-closed');
      var span = $('span', s);
      if (span && text) span.textContent = text;
    });
  }

  /* ----------------------------------------------------------------
   * Projects: filter buttons with counts and a live status line.
   * ---------------------------------------------------------------- */
  function initFilters() {
    var group = $('[data-filters]');
    var grid = $('[data-project-grid]');
    if (!group || !grid) return;
    var buttons = $$('[data-filter]', group);
    var items = $$('.project', grid);
    var status = $('[data-filter-status]');
    var empty = $('[data-empty]');

    buttons.forEach(function (b) {
      var f = b.getAttribute('data-filter');
      var n = f === 'all' ? items.length : items.filter(function (it) { return it.getAttribute('data-type').split(' ').indexOf(f) > -1; }).length;
      var c = $('[data-count-for]', b);
      if (c) c.textContent = n;
    });

    var apply = function (btn) {
      var f = btn.getAttribute('data-filter');
      var shown = 0;
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      items.forEach(function (it) {
        var match = f === 'all' || it.getAttribute('data-type').split(' ').indexOf(f) > -1;
        it.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      if (status) {
        var label = btn.firstChild.textContent.trim().toLowerCase();
        status.textContent = f === 'all' ? 'Showing all ' + shown + ' projects' : 'Showing ' + shown + ' ' + label + ' project' + (shown === 1 ? '' : 's');
      }
    };
    buttons.forEach(function (b) { b.addEventListener('click', function () { apply(b); }); });
  }

  /* ----------------------------------------------------------------
   * Before / after slider. A native range input handles the keyboard
   * (arrows, Home, End, Page Up/Down); pointer dragging sets it too.
   * ---------------------------------------------------------------- */
  function initBeforeAfter() {
    $$('[data-ba]').forEach(function (box) {
      var range = $('[data-ba-range]', box);
      if (!range) return;
      var set = function (v) {
        v = Math.max(0, Math.min(100, Math.round(v)));
        range.value = v;
        box.style.setProperty('--pos', v + '%');
        range.setAttribute('aria-valuetext', v + '% before photo, ' + (100 - v) + '% after photo');
      };
      range.addEventListener('input', function () { set(range.value); });
      set(range.value);

      var dragging = false;
      var fromPointer = function (e) {
        var r = box.getBoundingClientRect();
        set(((e.clientX - r.left) / r.width) * 100);
      };
      range.style.pointerEvents = 'none';
      box.style.touchAction = 'pan-y';
      box.style.cursor = 'ew-resize';
      box.addEventListener('pointerdown', function (e) {
        dragging = true;
        box.setPointerCapture(e.pointerId);
        fromPointer(e);
        range.focus({ preventScroll: true });
      });
      box.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
      ['pointerup', 'pointercancel'].forEach(function (t) { box.addEventListener(t, function () { dragging = false; }); });

      var wrap = box.parentNode;
      $$('[data-ba-jump]', wrap).forEach(function (btn) {
        btn.addEventListener('click', function () { set(parseFloat(btn.getAttribute('data-ba-jump'))); });
      });
    });
  }

  /* ----------------------------------------------------------------
   * Project details in a native <dialog>.
   * ---------------------------------------------------------------- */
  function initProjectDialog() {
    var dialog = document.getElementById('project-dialog');
    var triggers = $$('[data-open-project]');
    if (!triggers.length) return;
    var supported = dialog && typeof dialog.showModal === 'function';

    triggers.forEach(function (btn) {
      var card = btn.closest('.project');
      if (!card) return;
      btn.setAttribute('aria-label', 'View details: ' + $('h3', card).textContent);
      btn.addEventListener('click', function () {
        if (!supported) { card.classList.toggle('show-more'); return; }
        var img = $('img', card);
        var dImg = $('[data-dialog-img]', dialog);
        dImg.src = img.getAttribute('src');
        dImg.alt = img.alt;
        $('[data-dialog-title]', dialog).textContent = $('h3', card).textContent;
        $('[data-dialog-tag]', dialog).textContent = $('.feat-tag', card).textContent;
        $('[data-dialog-loc]', dialog).innerHTML = $('.project-loc', card).innerHTML;
        $('[data-dialog-foot]', dialog).textContent = $('.project-foot span', card).textContent;
        var more = $('[data-dialog-more]', dialog);
        more.innerHTML = '';
        more.appendChild($('.project-more', card).cloneNode(true));
        dialog.showModal();
      });
    });

    if (!supported) return;
    var close = $('[data-dialog-close]', dialog);
    if (close) close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  /* ----------------------------------------------------------------
   * Lawn care calendar: switch plans, grey out treatments a plan
   * leaves out, mark the current month.
   * ---------------------------------------------------------------- */
  var setCalendarPlan = function () {};
  function initLawnCalendar() {
    var table = $('[data-cal]');
    var group = $('[data-cal-plans]');
    if (!table || !group) return;
    var buttons = $$('[data-plan]', group);
    var rows = $$('tbody tr', table);
    var summary = $('[data-cal-summary]');
    var caption = $('[data-cal-caption]');
    var month = new Date().getMonth();

    $$('[data-m="' + month + '"]', table).forEach(function (c) { c.classList.add('now'); });

    setCalendarPlan = function (plan) {
      var info = LAWN.plans[plan];
      if (!info) return;
      var months = [];
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-plan') === plan ? 'true' : 'false'); });
      rows.forEach(function (row) {
        var inPlan = row.getAttribute('data-plans').split(' ').indexOf(plan) > -1;
        row.classList.toggle('is-off', !inPlan);
        var cell = $('td .dot', row);
        var label = $('[data-dot-label]', row);
        var m = cell ? parseInt(cell.parentNode.getAttribute('data-m'), 10) : -1;
        if (label) label.textContent = inPlan ? 'Visit in ' + MONTHS[m] : 'Not in the ' + info.name + ' plan';
        if (inPlan && months.indexOf(m) === -1) months.push(m);
      });
      months.sort(function (a, b) { return a - b; });
      if (summary) {
        summary.innerHTML = '<strong>' + info.name + ':</strong> ' + months.length + ' visits, ' + MONTHS[months[0]] + ' to ' + MONTHS[months[months.length - 1]];
      }
      if (caption) caption.textContent = 'Visits on the ' + info.name + ' plan. Treatments in grey are not included in this plan.';
    };

    buttons.forEach(function (b) { b.addEventListener('click', function () { setCalendarPlan(b.getAttribute('data-plan')); }); });
    var pressed = buttons.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0];
    setCalendarPlan(pressed ? pressed.getAttribute('data-plan') : 'complete');
  }

  /* ----------------------------------------------------------------
   * Lawn care price calculator.
   * ---------------------------------------------------------------- */
  function initLawnCalculator() {
    var form = $('[data-calc]');
    if (!form) return;
    var range = $('[data-size-range]', form);
    var input = $('[data-size-input]', form);
    var out = {
      plan: $('[data-out-plan]'), size: $('[data-out-size]'), month: $('[data-out-month]'), visit: $('[data-out-visit]'),
      visits: $('[data-out-visits]'), planTotal: $('[data-out-plan-total]'), extras: $('[data-out-extras]'), year: $('[data-out-year]')
    };
    var min = parseInt(input.min, 10), max = parseInt(input.max, 10);
    var clamp = function (v) { v = parseInt(v, 10); if (isNaN(v)) v = 5000; return Math.max(min, Math.min(max, v)); };

    var calc = function () {
      var size = clamp(input.value);
      var checked = $('input[name="plan"]:checked', form);
      var key = checked ? checked.value : 'seasonal';
      var plan = LAWN.plans[key];
      var perVisit = Math.round((LAWN.base + size * LAWN.perSqft) * plan.discount);
      var planTotal = perVisit * plan.visits;
      var extras = $$('input[name="extra"]:checked', form).reduce(function (sum, cb) {
        return sum + Math.round(LAWN.extras[cb.value](size));
      }, 0);
      var year = planTotal + extras;
      out.plan.textContent = plan.name;
      out.size.textContent = size.toLocaleString('en-US');
      out.visit.textContent = money(perVisit);
      out.visits.textContent = plan.visits;
      out.planTotal.textContent = money(planTotal);
      out.extras.textContent = money(extras);
      out.year.textContent = money(year);
      out.month.textContent = money(year / 12, true);
    };

    range.addEventListener('input', function () { input.value = range.value; calc(); });
    input.addEventListener('input', function () {
      var v = parseInt(input.value, 10);
      if (!isNaN(v)) range.value = clamp(v);
      calc();
    });
    input.addEventListener('change', function () { input.value = clamp(input.value); range.value = input.value; calc(); });
    $$('[data-size]', form).forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.getAttribute('data-size'); range.value = input.value; calc(); });
    });
    form.addEventListener('change', calc);
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    $$('[data-pick-plan]').forEach(function (link) {
      link.addEventListener('click', function () {
        var key = link.getAttribute('data-pick-plan');
        var radio = $('input[name="plan"][value="' + key + '"]', form);
        if (radio) radio.checked = true;
        setCalendarPlan(key);
        calc();
      });
    });
    calc();
  }

  /* ----------------------------------------------------------------
   * Photo upload: drag and drop, previews, remove, limits.
   * ---------------------------------------------------------------- */
  var uploadedPhotos = [];
  function initUpload() {
    var zone = $('[data-dropzone]');
    var input = $('[data-file-input]');
    var list = $('[data-thumbs]');
    var msg = $('[data-upload-msg]');
    if (!zone || !input || !list) return;
    var MAX = 8, MAX_MB = 10;

    var syncInput = function () {
      if (typeof DataTransfer === 'undefined') return;
      try {
        var dt = new DataTransfer();
        uploadedPhotos.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
      } catch (e) { /* older browsers keep their own selection */ }
    };
    var render = function (note) {
      list.innerHTML = '';
      uploadedPhotos.forEach(function (file, i) {
        var li = document.createElement('li');
        var img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = 'Preview of ' + file.name;
        img.onload = function () { URL.revokeObjectURL(img.src); };
        var name = document.createElement('span');
        name.className = 'thumb-name';
        name.textContent = file.name;
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove ' + file.name);
        rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
        rm.addEventListener('click', function () {
          var gone = uploadedPhotos.splice(i, 1)[0];
          syncInput();
          render(gone.name + ' removed.');
          input.focus();
        });
        li.appendChild(img); li.appendChild(name); li.appendChild(rm);
        list.appendChild(li);
      });
      var n = uploadedPhotos.length;
      if (msg) msg.textContent = (note ? note + ' ' : '') + (n ? n + ' of ' + MAX + ' photos added.' : 'No photos added yet.');
    };
    var add = function (files) {
      var skipped = 0;
      Array.prototype.forEach.call(files, function (f) {
        if (!/^image\//.test(f.type) || f.size > MAX_MB * 1024 * 1024 || uploadedPhotos.length >= MAX) { skipped++; return; }
        uploadedPhotos.push(f);
      });
      syncInput();
      render(skipped ? skipped + ' file' + (skipped === 1 ? ' was' : 's were') + ' skipped (images only, up to ' + MAX_MB + ' MB, ' + MAX + ' photos).' : '');
    };

    input.addEventListener('change', function () { add(input.files); });
    ['dragenter', 'dragover'].forEach(function (t) {
      zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.remove('is-over'); });
    });
    zone.addEventListener('drop', function (e) { if (e.dataTransfer) add(e.dataTransfer.files); });
  }

  /* ----------------------------------------------------------------
   * Form validation and success state. Nothing is sent anywhere.
   * ---------------------------------------------------------------- */
  function initForms() {
    $$('form[data-validate]').forEach(function (form) {
      var success = form.parentNode.querySelector('[data-success]');
      var tried = false;

      var checkField = function (el) {
        var ok = el.checkValidity();
        el.classList.toggle('is-invalid', !ok);
        el.setAttribute('aria-invalid', ok ? 'false' : 'true');
        var wrap = el.closest('.form-check');
        if (wrap) wrap.classList.toggle('has-error', !ok);
        return ok;
      };
      var checkGroup = function (wrap) {
        var inputs = $$('input', wrap);
        var ok = inputs.some(function (i) { return i.checked; });
        wrap.classList.toggle('has-error', !ok);
        inputs.forEach(function (i) { i.setAttribute('aria-invalid', ok ? 'false' : 'true'); });
        return ok;
      };
      var groups = $$('[data-group]', form);
      var fields = $$('input, select, textarea', form).filter(function (el) {
        return el.type !== 'radio' && el.type !== 'file' && !el.hasAttribute('data-min-one') && el.hasAttribute('required');
      });

      var validate = function () {
        var first = null;
        fields.forEach(function (el) { if (!checkField(el) && !first) first = el; });
        groups.forEach(function (g) { if (!checkGroup(g) && !first) first = $('input', g); });
        return first;
      };

      form.addEventListener('input', function (e) { if (tried && fields.indexOf(e.target) > -1) checkField(e.target); });
      form.addEventListener('change', function (e) {
        if (!tried) return;
        if (fields.indexOf(e.target) > -1) checkField(e.target);
        var g = e.target.closest('[data-group]');
        if (g) checkGroup(g);
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        tried = true;
        var first = validate();
        if (first) { first.focus(); return; }
        if (!success) return;
        showSuccess(form, success);
      });
    });
  }

  function showSuccess(form, success) {
    var val = function (name) { var el = form.elements[name]; return el ? (el.value || '').trim() : ''; };
    var name = val('name').split(' ')[0] || 'there';
    var rows = [];
    var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

    if (form.hasAttribute('data-quote')) {
      var styles = $$('input[name="style"]:checked', form).map(function (c) { return c.value; });
      rows = [
        ['Garden', (form.querySelector('input[name="size"]:checked') || {}).value],
        ['Project', val('type')],
        ['Budget', (form.querySelector('input[name="budget"]:checked') || {}).value],
        ['Styles', styles.join(', ')],
        ['Photos', uploadedPhotos.length ? uploadedPhotos.length + ' attached' : 'None']
      ];
    } else {
      rows = [['Topic', val('topic')], ['Reply to', val('email')]];
    }
    var list = rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<li><span>' + esc(r[0]) + '</span><strong>' + esc(r[1]) + '</strong></li>';
    }).join('');

    success.innerHTML =
      '<span class="success-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>' +
      '<h3>Thank you, ' + esc(name) + '</h3>' +
      '<p>Your ' + (form.hasAttribute('data-quote') ? 'consultation request' : 'message') + ' is complete and ready to go. Here is what you told us:</p>' +
      '<ul class="success-list">' + list + '</ul>' +
      '<p class="demo-note">Template demo: no data has left your browser. Connect the form to a form service or your own backend to receive it.</p>' +
      '<button type="button" class="btn btn-line btn-sm mt-2" data-reset>Start again</button>';
    form.hidden = true;
    success.classList.add('show');
    success.focus({ preventScroll: true });
    success.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    var reset = $('[data-reset]', success);
    if (reset) reset.addEventListener('click', function () {
      form.reset();
      success.classList.remove('show');
      success.innerHTML = '';
      form.hidden = false;
      var firstField = $('input, select, textarea', form);
      if (firstField) firstField.focus();
    });
  }

  /* ----------------------------------------------------------------
   * Copy the studio address.
   * ---------------------------------------------------------------- */
  function initCopy() {
    $$('[data-copy]').forEach(function (btn) {
      var label = btn.textContent;
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        var done = function () {
          btn.textContent = 'Address copied';
          setTimeout(function () { btn.textContent = label; }, 2200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { btn.textContent = text; });
        } else {
          btn.textContent = text;
        }
      });
    });
  }

  function init() {
    initNav();
    initStickyHeader();
    initScrollSpy();
    initReveal();
    initCountUp();
    initYear();
    initOpenStatus();
    initFilters();
    initBeforeAfter();
    initProjectDialog();
    initLawnCalendar();
    initLawnCalculator();
    initUpload();
    initForms();
    initCopy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
