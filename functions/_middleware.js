/** Serve the site from one host: the production pages.dev alias redirects to the custom domain. */
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === 'saiautonomy-web.pages.dev') {
    url.protocol = 'https:';
    url.hostname = 'saiautonomy.com';
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
