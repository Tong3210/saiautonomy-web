/** Contact form intake: validates the fields, verifies the Turnstile token, forwards the message. */
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[A-Za-z]{2,}$/;
const MAX_ORGANIZATION = 200;
const MAX_MESSAGE = 2000;
const ALLOWED_HOSTS = new Set(['saiautonomy.com', 'www.saiautonomy.com']);
const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function originAllowed(origin) {
  if (!origin) return true; // non-browser clients still have to pass Turnstile
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_HOSTS.has(host) || host.endsWith('.saiautonomy-web.pages.dev');
  } catch {
    return false;
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  }
  for (const key of ['TURNSTILE_SECRET_KEY', 'APPS_SCRIPT_URL', 'FORM_SHARED_SECRET']) {
    if (!env[key]) return json({ ok: false, error: 'not_configured' }, 500);
  }
  if (!originAllowed(request.headers.get('Origin'))) return json({ ok: false, error: 'forbidden' }, 403);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }
  const field = (name) => (form.get(name) ?? '').toString().trim();

  // Honeypot: real users never see this field. Pretend success so bots stop retrying.
  if (field('company_website')) return json({ ok: true });

  const email = field('email');
  const organization = field('organization');
  const message = field('message');

  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);
  if (organization.length > MAX_ORGANIZATION) return json({ ok: false, error: 'invalid_organization' }, 400);
  if (!message || message.length > MAX_MESSAGE) return json({ ok: false, error: 'invalid_message' }, 400);

  const token = field('cf-turnstile-response');
  if (!token) return json({ ok: false, error: 'turnstile_missing' }, 400);

  const ip = request.headers.get('CF-Connecting-IP');
  const verifyBody = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) verifyBody.set('remoteip', ip);
  let outcome;
  try {
    const verify = await fetch(TURNSTILE_VERIFY, { method: 'POST', body: verifyBody });
    outcome = await verify.json();
  } catch {
    outcome = { success: false };
  }
  if (!outcome.success) return json({ ok: false, error: 'turnstile_failed' }, 403);

  const payload = {
    secret: env.FORM_SHARED_SECRET,
    submitted_at: new Date().toISOString(),
    email,
    organization,
    message,
    country: (request.cf && request.cf.country) || '',
    page: request.headers.get('Referer') || '',
  };

  let upstream;
  try {
    upstream = await fetch(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow', // Apps Script answers POST with a 302 to googleusercontent.com
    });
  } catch {
    return json({ ok: false, error: 'upstream_unreachable' }, 502);
  }
  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || !data || data.ok !== true) return json({ ok: false, error: 'upstream_rejected' }, 502);

  return json({ ok: true });
}
