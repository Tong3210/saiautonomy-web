/** The demo page was removed. Answer 410 so caches and crawlers drop it. */
export async function onRequest({ request, env }) {
  const page = await env.ASSETS.fetch(new URL('/404', request.url));
  const headers = new Headers(page.headers);
  headers.set('cache-control', 'no-store');
  return new Response(page.body, { status: 410, headers });
}
