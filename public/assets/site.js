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
