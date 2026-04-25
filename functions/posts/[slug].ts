// This file is executed by Cloudflare Pages on edge nodes
// It intercepts requests to /posts/* and modifies the HTML response using HTMLRewriter

interface Env {
  VITE_SERVER_BASE_URL?: string;
  cinema_db?: any;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params, next } = context;
  const slug = params.slug as string;

  // 1. Fetch the static index.html from Pages using ASSETS binding
  // This is required for SPAs because `await next()` for a dynamic route returns 404
  // and Cloudflare's automatic SPA fallback would strip our changes.
  const url = new URL(request.url);
  url.pathname = '/';
  const response = await env.ASSETS.fetch(new Request(url, request));
  
  const clonedResponse = new Response(response.body, response);
  clonedResponse.headers.set('X-Function-Executed', 'true');

  // 2. Use env var or default to the production API (which is just the same domain if served together)
  const apiBaseUrl = env.VITE_SERVER_BASE_URL || 'https://cinesphere.com.vn';
  const apiUrl = `${apiBaseUrl}/api/posts/${slug}`;

  try {
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) return response;

    const data: any = await apiRes.json();
    const post = data.post;

    if (!post) return response;

    const title = post.title || 'CINESPHERE';
    const description = post.excerpt || 'Trải nghiệm hấp dẫn tại CINESPHERE';
    let image = post.featured_image || '/og-image.jpg';

    // Ensure image URL is absolute for Facebook/Zalo SEO crawlers
    if (image.startsWith('/')) {
      const url = new URL(request.url);
      image = `${url.origin}${image}`;
    }

    // Optional: strip HTML tags from description if excerpt contains HTML
    const cleanDescription = description.replace(/<[^>]*>?/gm, '').substring(0, 200);

    // 3. Set up HTMLRewriter to rewrite meta tags dynamically
    return new HTMLRewriter()
      .on('meta[property="og:title"]', {
        element(e) { e.setAttribute('content', title); }
      })
      .on('meta[property="og:description"]', {
        element(e) { e.setAttribute('content', cleanDescription); }
      })
      .on('meta[property="og:image"]', {
        element(e) { e.setAttribute('content', image); }
      })
      .on('meta[property="og:type"]', {
        element(e) { e.setAttribute('content', 'article'); }
      })
      .on('title', {
        element(e) { e.setInnerContent(`${title} | CINESPHERE`); }
      })
      // Inject missing meta tags (like twitter cards and og:url)
      .on('head', {
        element(e) {
          const safeTitle = title.replace(/"/g, '&quot;');
          const safeDesc = cleanDescription.replace(/"/g, '&quot;');
          const safeImage = image.replace(/"/g, '&quot;');

          e.append(`<meta property="og:url" content="${request.url}" />`, { html: true });

          e.append(`<meta name="twitter:card" content="summary_large_image" />`, { html: true });
          e.append(`<meta name="twitter:title" content="${safeTitle}" />`, { html: true });
          e.append(`<meta name="twitter:description" content="${safeDesc}" />`, { html: true });
          e.append(`<meta name="twitter:image" content="${safeImage}" />`, { html: true });
        }
      })
      .transform(response);

  } catch (error) {
    // If anything fails, fallback to passing the original file unharmed
    return response;
  }
};
