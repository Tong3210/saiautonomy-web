/**
 * Early-access form intake for saiautonomy.com.
 *
 * Browser → POST /api/early-access (this Function, same origin)
 *   1. reject unknown origins and honeypot hits
 *   2. validate fields against the form's own option lists
 *   3. verify the Turnstile token with Cloudflare
 *   4. forward the submission to the Google Apps Script web app,
 *      authenticated with a shared secret, which writes the sheet
 *      and emails the company inbox
 *
 * Environment (Pages → Settings → Variables and Secrets):
 *   TURNSTILE_SECRET_KEY  Turnstile widget secret
 *   APPS_SCRIPT_URL       Apps Script web-app /exec URL
 *   FORM_SHARED_SECRET    random string, same value in Apps Script properties
 */

const ROLES = new Set(['site_manager', 'drone_operator', 'systems_integrator', 'researcher', 'investor', 'other']);
const PLATFORMS = new Set(['px4', 'ardupilot', 'dji', 'none', 'other']);
const SCENARIOS = new Set(['', 'construction', 'power', 'agriculture', 'sar', 'other']);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[A-Za-z]{2,}$/;
const MAX_FREE_TEXT = 2000;
const ALLOWED_HOSTS = new Set(['saiautonomy.com', 'www.saiautonomy.com', 'saiautonomy-web.pages.dev']);
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
  const role = field('role');
  const platform = field('platform');
  const scenario = field('scenario');
  const painPoint = field('pain_point').slice(0, MAX_FREE_TEXT);

  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);
  if (!ROLES.has(role)) return json({ ok: false, error: 'invalid_role' }, 400);
  if (!PLATFORMS.has(platform)) return json({ ok: false, error: 'invalid_platform' }, 400);
  if (!SCENARIOS.has(scenario)) return json({ ok: false, error: 'invalid_scenario' }, 400);

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
    role,
    platform,
    scenario,
    pain_point: painPoint,
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
