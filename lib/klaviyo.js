// Klaviyo server API. Fire and forget with a timeout: a Klaviyo outage never
// blocks signup or checkout, and a missing key simply skips (dev mode).
//
// KLAVIYO_PRIVATE_KEY        private key with profiles, events, lists and subscriptions write scopes
// KLAVIYO_WAITLIST_LIST_ID   list for waitlist signups who ticked the email box
// KLAVIYO_MEMBERS_LIST_ID    list for members who ticked the email box

const REVISION = '2024-10-15';
const BASE = 'https://a.klaviyo.com/api';

function on() {
  return !!process.env.KLAVIYO_PRIVATE_KEY;
}

async function call(path, body, method = 'POST') {
  if (!on()) return;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_KEY}`,
        revision: REVISION,
        'content-type': 'application/vnd.api+json',
        accept: 'application/vnd.api+json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) console.warn('[klaviyo]', path, res.status, (await res.text()).slice(0, 300));
  } catch (err) {
    console.warn('[klaviyo]', path, err.message);
  }
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined));
}

function profileAttrs(email, props = {}) {
  const { first_name, ...rest } = props;
  return clean({ email, first_name, properties: clean(rest) });
}

// One metric on one profile, with profile properties updated in the same call.
function track(metric, email, properties = {}, profile = {}) {
  if (!email) return Promise.resolve();
  return call('/events/', {
    data: {
      type: 'event',
      attributes: {
        properties: clean(properties),
        metric: { data: { type: 'metric', attributes: { name: metric } } },
        profile: { data: { type: 'profile', attributes: profileAttrs(email, profile) } },
      },
    },
  });
}

function upsertProfile(email, profile = {}) {
  if (!email) return Promise.resolve();
  return call('/profile-import/', { data: { type: 'profile', attributes: profileAttrs(email, profile) } });
}

// Only called when the person ticked the email box.
function subscribe(listId, email) {
  if (!listId || !email) return Promise.resolve();
  return call('/profile-subscription-bulk-create-jobs/', {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        profiles: { data: [{ type: 'profile', attributes: { email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } }] },
      },
      relationships: { list: { data: { type: 'list', id: listId } } },
    },
  });
}

function unsubscribe(listId, email) {
  if (!email) return Promise.resolve();
  return call('/profile-subscription-bulk-delete-jobs/', {
    data: {
      type: 'profile-subscription-bulk-delete-job',
      attributes: { profiles: { data: [{ type: 'profile', attributes: { email } }] } },
      relationships: listId ? { list: { data: { type: 'list', id: listId } } } : undefined,
    },
  });
}

function forget(email) {
  if (!email) return Promise.resolve();
  return call('/data-privacy-deletion-jobs/', {
    data: { type: 'data-privacy-deletion-job', attributes: { profile: { data: { type: 'profile', attributes: { email } } } } },
  });
}

module.exports = { on, track, upsertProfile, subscribe, unsubscribe, forget };
