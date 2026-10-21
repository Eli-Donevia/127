// Posting to Instagram and Facebook through the Meta Graph API, for the composer (lib/harness/posts.js).
// Both sign in with Facebook Login (oauth.js `meta`): Instagram posts go to the business or creator
// account linked to one of the member's Pages, Facebook posts to the Page itself with the Page's token,
// which is fetched per call and never stored or handed to a caller.
//
// Reads: the places a member can post to, and Instagram's posting quota. Writes: one post each. A write
// runs only from an OK the member gave in the composer (index.js wrap needs approvedBy).

// apps.js loads this file before it exports, so AppError is looked up when it's thrown.
const fail = (message, status) => new (require('./apps').AppError)(message, status);
const { META_V } = require('./oauth');

const GRAPH = `https://graph.facebook.com/${META_V}`;
const clip = (s, max) => String(s == null ? '' : s).trim().slice(0, max);
const numId = (v) => {
  const s = String(v || '');
  if (!/^\d{1,30}$/.test(s)) throw fail("That account isn't one 127 can post to. Pick it again in the composer.", 400);
  return s;
};
const deps = { wait: (ms) => new Promise((r) => setTimeout(r, ms)) };
function _setDeps(over) {
  Object.assign(deps, over);
}

function graph(token, http) {
  return (path, opts = {}) => http('Meta', { url: `${GRAPH}${path}`, ...opts, headers: { authorization: `Bearer ${opts.token || token}` } });
}

async function pages(g) {
  const out = await g('/me/accounts?fields=id,name,access_token,instagram_business_account%7Bid,username%7D&limit=50');
  return Array.isArray(out.data) ? out.data : [];
}

function instagram(creds, http) {
  const g = graph(creds.token, http);
  return {
    // The Instagram accounts linked to the member's Pages: [{ id, name }].
    async places() {
      return (await pages(g)).filter((p) => p.instagram_business_account).map((p) => ({ id: String(p.instagram_business_account.id), name: `@${p.instagram_business_account.username || p.name}` }));
    },
    async quota({ id }) {
      const out = await g(`/${numId(id)}/content_publishing_limit?fields=quota_usage,config`);
      const d = (out.data || [])[0] || {};
      return { used: Number(d.quota_usage) || 0, max: Number(d.config && d.config.quota_total) || 100 };
    },
    writes: {
      // One photo with its caption. Instagram fetches the photo from imageUrl, makes a container, and the
      // container is published once it's ready.
      async post({ id, caption, imageUrl }) {
        const ig = numId(id);
        if (!imageUrl) throw fail('Instagram posts need a photo.', 400);
        const made = await g(`/${ig}/media`, { method: 'POST', form: { image_url: imageUrl, caption: clip(caption, 2200) } });
        const box = String(made.id || '');
        if (!box) throw fail("Instagram didn't take the photo. Try again.", 502);
        for (let i = 0; i < 10; i++) {
          const s = await g(`/${numId(box)}?fields=status_code`);
          if (s.status_code === 'FINISHED') break;
          if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw fail("Instagram couldn't use that photo. Check it's a JPEG between 4:5 and 1.91:1.", 400);
          if (i === 9) throw fail('Instagram is still working on the photo. 127 will try again.', 503);
          await deps.wait(3000);
        }
        const out = await g(`/${ig}/media_publish`, { method: 'POST', form: { creation_id: box } });
        const postId = String(out.id || '');
        let url = null;
        try {
          url = (await g(`/${numId(postId)}?fields=permalink`)).permalink || null;
        } catch {
          url = null;
        }
        return { id: postId, url };
      },
    },
  };
}

function facebook(creds, http) {
  const g = graph(creds.token, http);
  const pageToken = async (id) => {
    const p = (await pages(g)).find((x) => String(x.id) === String(id));
    if (!p || !p.access_token) throw fail("127 can't post to that Page. Reconnect Facebook and tick the Page.", 403);
    return p.access_token;
  };
  return {
    // The member's Pages: [{ id, name }].
    async places() {
      return (await pages(g)).map((p) => ({ id: String(p.id), name: clip(p.name, 120) }));
    },
    writes: {
      // Text, with a photo when there is one.
      async post({ id, caption, imageUrl }) {
        const page = numId(id);
        const token = await pageToken(page);
        const out = imageUrl
          ? await g(`/${page}/photos`, { method: 'POST', token, form: { url: imageUrl, caption: clip(caption, 60000) } })
          : await g(`/${page}/feed`, { method: 'POST', token, form: { message: clip(caption, 60000) } });
        const postId = String(out.post_id || out.id || '');
        return { id: postId, url: postId ? `https://www.facebook.com/${encodeURIComponent(postId)}` : null };
      },
    },
  };
}

module.exports = { instagram, facebook, _setDeps };
