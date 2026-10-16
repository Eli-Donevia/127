# Put the new 127 site on Replit (about 10 minutes)

This makes a **new** Replit app from the GitHub repo `Eli-Donevia/127`. Your live 127group.io app stays exactly as it is until you decide to move the domain.

## 1. Create the app
1. In Replit, tap **Create App → Import code or design → GitHub**.
2. Pick **Eli-Donevia/127** and import it. Name it something like "127 site".
3. Tap **Run** once. Replit installs packages and opens a preview. It works right away in demo mode.

## 2. Add a database
**Tools → Database → Create a PostgreSQL database.** Replit adds `DATABASE_URL` on its own. Without it, member accounts are lost on every deploy.

## 3. Add Secrets (Tools → Secrets)
Copy these in. Names must match exactly.

| Secret | Value |
|---|---|
| `SESSION_SECRET` | Any random 64 characters. In the Replit Shell: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `ADMIN_EMAILS` | `eli@127group.io` |
| `BASE_URL` | The app's `https://….replit.app` URL for now. Change it to `https://127group.io` when the domain moves. |
| `STRIPE_SECRET_KEY` | Your Stripe **test** secret key (Stripe → Developers → API keys). Roll it first, since it was pasted in chat. |
| `STRIPE_WEBHOOK_SECRET` | I give you this after step 5. |
| `KLAVIYO_PRIVATE_KEY` | Klaviyo → Settings → API keys → **Create private API key** → Full access. Starts with `pk_`. |
| `KLAVIYO_WAITLIST_LIST_ID` | `VDzLZV` |
| `KLAVIYO_MEMBERS_LIST_ID` | `UiUrrh` |
| `KLAVIYO_LIST_ID` | `RNQeWM` |
| `ANTHROPIC_API_KEY` | From console.anthropic.com → API keys. Powers Eli's Playbook and the AI tools. |
| `PRELAUNCH` | `true` (waitlist mode until doors open) |
| `LAUNCH_AT` | `2026-11-17T15:00:00Z` |
| `FOUNDING_CLOSES_AT` | `2026-11-25T05:00:00Z` |
| `FOUNDING_PRICE` | `19` |
| `FOUNDING_CAP` | `100` |
| `REFERRALS_FOR_REWARD` | `3` |

**Email that must reach people** (confirm your email, password reset): add `RESEND_API_KEY` and `EMAIL_FROM` (`127 <hello@127group.io>`) from a free resend.com account once its DNS records for 127group.io are in. Until then those emails only show in the logs, so you can't sign in as admin on the deployed site.

Optional later: `META_PIXEL_ID`, `TIKTOK_PIXEL_ID`, `META_CAPI_TOKEN`, `PLAUSIBLE_DOMAIN`, `CIRCLE_CALL_URL`, `CIRCLE_COMMUNITY_URL`. The full list with notes is in `.env.example`.

## 4. Deploy
**Deploy → Reserved VM** (one always-on machine, smallest size is fine). When it's live, copy the URL.

## 5. One quick check
Open `/admin` on the deployed site from your phone on cellular, then from a laptop on Wi-Fi. The top line shows "Your IP as the server sees it". If both show the same address, add the Secret `TRUST_PROXY` = `2` and redeploy. Otherwise the sign-up and waitlist limits apply to everyone at once.

## 6. Send me the URL
Paste the `https://….replit.app` URL in the Website thread. I then:
- create the Stripe webhook for it and give you `STRIPE_WEBHOOK_SECRET` to add in Secrets (redeploy after),
- run a test purchase with card 4242 4242 4242 4242 and check the member unlocks,
- check that waitlist signups land in Klaviyo.

## Moving 127group.io later
When you're happy with the new site: new app → **Deployments → Settings → Link a domain** → `127group.io`, remove the domain from the old app, then change `BASE_URL` and the Stripe webhook URL. The media kit is already carried over at `/media-kit`.
