/* ==========================================================================
   SCOFIS Google Ads landing pages — shared behaviour
   Built by Generate Your Audience

   Pushes these events to dataLayer for GTM triggers:
     call_click        - any tap on a tel: link or call button
     enquiry_click     - any tap on an "enquiry" CTA that scrolls to the form
     form_start        - first interaction with the enquiry form
     generate_lead     - successful form submission  (use this one as the
                         Google Ads "Book online" conversion trigger)
   ========================================================================== */
(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PAGE = document.body.getAttribute('data-page') || 'unknown';

  function push(ev, extra) {
    var o = { event: ev, page_type: PAGE };
    if (extra) { for (var k in extra) { o[k] = extra[k]; } }
    window.dataLayer.push(o);
  }

  /* ---------- scroll reveals ---------- */
  var els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(els, function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* ---------- call tracking ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
    if (a) {
      push('call_click', { call_source: a.getAttribute('data-src') || 'link' });
    }
    var enq = e.target.closest ? e.target.closest('[data-enquiry]') : null;
    if (enq) {
      push('enquiry_click', { cta_source: enq.getAttribute('data-enquiry') });
    }
  }, true);

  /* ---------- enquiry form ---------- */
  var form = document.getElementById('leadForm');
  if (!form) { return; }

  var started = false;
  form.addEventListener('input', function () {
    if (!started) { started = true; push('form_start'); }
  }, { once: false });

  function clearState(el) {
    if (el && el.style) { el.style.borderColor = ''; }
  }

  form.querySelectorAll('input, textarea').forEach(function (f) {
    f.addEventListener('input', function () { clearState(f); });
  });
  form.querySelectorAll('.choice-group input').forEach(function (r) {
    r.addEventListener('change', function () {
      var g = r.closest('.choice-group');
      if (g) { g.classList.remove('invalid'); }
    });
  });

  var errBox = document.getElementById('formError');
  function showError(msg) {
    if (!errBox) { return; }
    errBox.textContent = msg;
    errBox.classList.add('show');
  }
  function hideError() {
    if (errBox) { errBox.classList.remove('show'); }
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    hideError();

    var invalid = false;

    form.querySelectorAll('input[required]:not([type=radio]), textarea[required]').forEach(function (f) {
      if (!f.value.trim()) { f.style.borderColor = '#C9553F'; invalid = true; }
      else { clearState(f); }
    });

    var email = form.querySelector('#email');
    if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      email.style.borderColor = '#C9553F';
      invalid = true;
    }
    var phone = form.querySelector('#phone');
    if (phone && phone.value && phone.value.replace(/[^0-9]/g, '').length < 8) {
      phone.style.borderColor = '#C9553F';
      invalid = true;
    }

    form.querySelectorAll('.choice-group[data-required]').forEach(function (g) {
      var checked = g.querySelector('input:checked');
      g.classList.toggle('invalid', !checked);
      if (!checked) { invalid = true; }
    });

    if (invalid) {
      showError('Please check the highlighted fields and try again.');
      return;
    }

    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });

    /* campaign attribution so the CRM lead is traceable back to the ad */
    var qs = new URLSearchParams(window.location.search);
    ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
      var v = qs.get(k);
      if (v) { data[k] = v; }
    });
    data.pageUrl = window.location.href;
    data.pageType = PAGE;

    var btn = form.querySelector('.submit');
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, body: j }; });
      })
      .then(function (res) {
        if (!res.ok) { throw new Error((res.body && res.body.message) || 'Request failed'); }
        push('generate_lead', {
          enquiry_type: data.enquiryType || PAGE,
          has_referral: data.hasReferral || 'not stated'
        });
        var wrap = form.closest('.formcard-body');
        if (wrap) { wrap.classList.add('is-sent'); }
        var card = form.closest('.formcard');
        if (card && card.scrollIntoView) {
          card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        }
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
        showError('Sorry, that did not send. Please try again, or call us on (07) 5406 0586 and we will take your details over the phone.');
      });
  });
})();
