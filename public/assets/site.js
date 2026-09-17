(function () {
  var t = new URLSearchParams(window.location.search).get('theme');
  if (t === 'light' || t === 'dark') {
    document.documentElement.setAttribute('data-theme', t);
    var w = document.querySelector('.cf-turnstile');
    if (w) w.setAttribute('data-theme', t);
  }
})();
(function () {
  var form = document.getElementById('contactForm');
  if (!form) return;
  var btn = document.getElementById('submitBtn');
  var success = document.getElementById('formSuccess');
  var errorEl = document.getElementById('formError');

  function showError(msg) { errorEl.textContent = msg; errorEl.hidden = false; }
  function resetBtn() {
    btn.disabled = false;
    btn.textContent = 'Send message';
    if (window.turnstile) window.turnstile.reset();
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorEl.hidden = true;
    if (!form.email.value.trim() || !form.message.value.trim()) {
      showError('Please fill in the required fields.');
      return;
    }
    var data = new FormData(form);
    if (!data.get('cf-turnstile-response')) {
      showError('Please complete the verification.');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      var res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      var body = await res.json().catch(function () { return {}; });
      if (res.ok && body.ok) {
        form.hidden = true;
        success.classList.add('show');
        return;
      }
      showError(body.error === 'turnstile_failed' ? 'Verification failed. Please try again.' : 'Something went wrong. Please try again in a moment.');
    } catch (err) {
      showError('Network error. Please try again.');
    }
    resetBtn();
  });
})();

(function () {
  var ledger = document.querySelector('.ledger');
  if (!ledger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var slots = Array.prototype.slice.call(ledger.querySelectorAll('.row:not(.live) .name'));
  if (slots.length < 2) return;
  function step() {
    if (document.hidden) return;
    var i = Math.floor(Math.random() * (slots.length - 1));
    var a = slots[i], b = slots[i + 1];
    var dy = b.getBoundingClientRect().top - a.getBoundingClientRect().top;
    var ta = a.textContent;
    a.textContent = b.textContent;
    b.textContent = ta;
    a.style.transition = 'none'; b.style.transition = 'none';
    a.style.transform = 'translateY(' + dy + 'px)';
    b.style.transform = 'translateY(' + (-dy) + 'px)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        a.style.transition = 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)';
        b.style.transition = a.style.transition;
        a.style.transform = 'translateY(0)';
        b.style.transform = 'translateY(0)';
      });
    });
  }
  window.setTimeout(function () { step(); window.setInterval(step, 7000); }, 7000);
})();
