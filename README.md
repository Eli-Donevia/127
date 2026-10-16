# 127 website

The public site and member platform for 127: a free founder assessment that builds a personalized 30-day roadmap, a library of playbooks and templates, AI tools, a wins board, and three tiers (Free, Builder at $29/month, Founder's Circle at $299/month by application).

It runs in demo mode with zero setup. Every integration (Stripe, Claude, email, database, automations) switches on when you add its key.

## Run it on Replit

Step-by-step with every Secret: [REPLIT-SETUP.md](REPLIT-SETUP.md).

1. In Replit, click **Create App → Import code or design → GitHub** and pick `Eli-Donevia/127` (or upload `127group-website.zip`).
2. Click **Run**. Replit installs packages and opens the site.
3. Open the **Secrets** tab and add at least:
   - `SESSION_SECRET`: a random string of 32+ characters (production refuses to start without one). Generate it with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - `ADMIN_EMAILS`: the email you'll sign up with
4. Sign up through the assessment with that email and tap the confirmation link in your inbox (admin only works for a confirmed email; without Resend, the link shows on your dashboard in development). Then visit `/admin`.

To keep members' data when you deploy, add a database: **Tools → Database → Create a PostgreSQL database**. Replit adds `DATABASE_URL` and the app uses it automatically (otherwise data lives in `data/db.json`, which Replit deployments don't keep).

Deploy with **Deploy → Reserved VM** (one always-on instance). Then **Deployments → Settings → Link a domain** for `127group.io`. Add `NODE_ENV=production` and `BASE_URL=https://127group.io` to Secrets.

Run locally instead: `npm install && npm start`, then open http://localhost:3000. Copy `.env.example` to `.env` to set keys.

## Turn on payments (Stripe)

1. **Test mode first.** In the Replit Shell run `STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup -- --webhook-url https://YOUR-DOMAIN/billing/webhook`. It creates the Builder and Founder's Circle products, the $29, founding $19 (from `FOUNDING_PRICE`) and $299 monthly prices, the founding referral coupon (first month free), the customer portal and the webhook, then prints what to add to Secrets. Running it again is safe.
2. Add Secrets: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (plus `STRIPE_PORTAL_CONFIGURATION` if the script printed one). Prices are found by lookup key, so no price IDs are needed. Never paste a key into code or a committed file; prefer a restricted key (`rk_`) for production.
3. Test: sign up, upgrade with card `4242 4242 4242 4242`, then try `4000 0000 0000 0341` (declines on renewal) and `4000 0025 0000 3155` (3-D Secure).
4. **Tax.** Stripe Tax only collects where you have an active registration. Add your head office address (Dashboard → Tax → Settings), add each registration your tax advisor confirms (Tax → Locations), pick a product tax code and re-run setup with `--tax-code txcd_...`, then set `STRIPE_AUTOMATIC_TAX=true`. Prices are tax-exclusive by default (tax added at checkout); pass `--tax-behavior inclusive` to change that.
5. **Invoices and dunning.** Turn on Dashboard → Settings → Billing → Customer emails (receipts, failed payments, card expiring) and Revenue recovery → Smart retries. Members see invoices in the portal; one-off invoices (for example an annual Circle seat) can be sent from Dashboard → Invoices.
6. **Go live:** run setup again with your live key and `--live`, add the live Secrets, and add your live tax registrations before the first real payment.
7. **Checkout consent and look (Dashboard only).** Settings → Public details: set the Terms of Service URL, then set `STRIPE_TERMS_CONSENT=true` so Checkout requires the Terms box with the renewal wording (Membership Terms Appendix A2). Settings → Branding: background `#060607`, the lavender-white accent, the 127 mark, business name "127". Product catalog: Builder description "Every playbook, every AI tool and all 4 weeks of your roadmap.", Founder's Circle "A weekly call with Eli, 4 seats, two gatherings a year." (re-running `stripe:setup` resets descriptions to the plan taglines). Customer emails: successful payments and refunds on.

What the app does: new members pay through Stripe Checkout (subscription mode, no promo-code box, founding price, referral and win-back coupons applied automatically from signed links, renewal wording at the pay button). Upgrades are charged straight away and only unlock once paid; Builder → Circle shows a confirm screen with an unticked consent box first. Downgrades credit unused time. Cancelling is in-app (`/app/billing/cancel`): one tap sets the subscription to end at the period end, and "Keep Builder" undoes it. Pause is not built yet: it has to start when the paid month ends (`pause_collection` set at the period end, `resumes_at` = period end + 1 day), which needs a scheduled job. Webhooks (`checkout.session.*`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `customer.source.expiring`) are signature-checked, de-duplicated and re-read from Stripe, so they're safe out of order. A failed renewal keeps access while Stripe retries, shows an "Update card" banner on every app page and sends one email. Klaviyo gets Started Checkout, Payment Failed, Payment Recovered and Card Expiring. Run `npm test` for the billing tests (no Stripe account needed).

Until Stripe is connected, upgrade buttons say payments aren't on yet. For testing, set `DEMO_BILLING=true` to simulate upgrades with no payment (always ignored when `NODE_ENV=production`).

## Other integrations

| What | Secrets | Notes |
|---|---|---|
| AI tools (Claude) | `ANTHROPIC_API_KEY` | Without it, tools return a clearly labeled demo answer. Optional settings are in `.env.example`. `npm run ai:side-by-side` compares two models on 10 Free questions and 5 Idea Tests and writes `side-by-side.md` next to `package.json`; it costs under $1 in API calls, so run it only on Eli's say-so. |
| Email (Resend) | `RESEND_API_KEY`, `EMAIL_FROM` | Welcome, upgrade and Circle emails. Without it, emails are logged. |
| Klaviyo | `KLAVIYO_PRIVATE_KEY`, `KLAVIYO_WAITLIST_LIST_ID`, `KLAVIYO_MEMBERS_LIST_ID`, `KLAVIYO_LIST_ID` | Sends the launch metrics (Joined Waitlist, Confirmed Waitlist, Referral Counted, Signed Up, Completed Onboarding, Completed Step, Earned Badge, Hit Free Limit, Upgraded, Downgraded, Cancelled Subscription, Applied to Circle, Approved for Circle, Posted Win, 127 Lead Captured) and keeps profile properties in sync. People are only added to a list when they ticked the email box; unticking it in Settings unsubscribes them. Deleting an account asks Klaviyo to delete the profile. |
| Automations | `WEBHOOK_URL` | Every event is also POSTed as JSON (Zapier, Make, n8n, a CRM). |
| Ad pixels | `META_PIXEL_ID`, `TIKTOK_PIXEL_ID`, `META_CAPI_TOKEN` | Funnel pages only; `META_CAPI_TOKEN` also sends Lead server-side, deduped with the pixel. Add a cookie notice before turning these on. |
| Circle call | `CIRCLE_CALL_URL`, `CIRCLE_CALL_TIME` | Shown to Circle members. |
| Circle group | `CIRCLE_COMMUNITY_URL` | Skool, Circle.so, WhatsApp or Discord invite link. |
| Circle size | `CIRCLE_CAPACITY` | Defaults to 4 seats. |
| Analytics | `PLAUSIBLE_DOMAIN` | Page views plus goals: Roadmap Preview, Signup, Onboarding Complete, Activation (first step done), Checkout Start, Upgrade, Waitlist Join, Waitlist Confirm, Referral Share. Add each as a goal in Plausible. |

The admin page shows which integrations are connected.

## Edit content without touching code

- `content/onboarding.json`: the member onboarding questionnaire (questions, options, order). A readable copy lives in the project as a Claude Doc.
- `content/resources.json`: the library (18 playbooks, worksheets and calculators drafted from your frameworks). Set `"reviewed": true` on an item once you've approved it.
- `content/templates/`: the templates library (manifest plus the sheet, doc, checklist and recipe files) from the Templates thread. Re-sync with `node scripts/sync-templates.js [path/to/product/templates]` when the manifest version changes; it copies only the files the manifest lists and checks each sha256. Files are served only through `GET /app/templates/:slug/:file` (Builder files need Builder; previews are open to every member), never from `public/`.
- `lib/plans.js`: plan names, prices, features and AI run limits.
- `views/home.ejs`: landing page copy, including the founder note (marked as draft).

Draft labels only show to admins (or to everyone with `SHOW_DRAFT_FLAGS=true`).

## How it fits together

- **Onboarding is the signup.** Visitors take the assessment first (`/start`), then create an account to save their roadmap. Answers save locally as they go, so nobody loses progress.
- **Roadmap engine** (`lib/roadmap.js`) maps stage and goal to a track (Start, Build, Grow; founders who need systems get an operations plan inside Build), builds 4 weeks of steps tied to resources, trims steps for people with under 3 hours a week, and adds notes for their obstacles. With a Claude key it also writes a short personal note.
- **Free vs paid.** Free members see weeks 1 and 2 (every resource those weeks use opens for them), three starter resources, Eli's Playbook chat and the Idea & Offer Validator (15 messages a month). Builder unlocks everything. Access is decided only by the member's plan, which only Stripe webhooks change.
- **Gamification** rewards finished work: XP for roadmap steps, finished resources and shared wins; five levels from Groundwork to Built; six badges.
- **Founder's Circle** is application-based: members apply in the app, you approve in `/admin`, and approved members get a checkout button. Seats are capped.
- **Admin** shows members, MRR, activation, free-to-paid conversion, live questionnaire answers, applications and integration status, plus a CSV export.

Stack: Node + Express, server-rendered EJS, plain CSS, Postgres or a JSON file, Stripe, Claude, Resend.

## Founding members and pre-launch

- `PRELAUNCH=true` until `LAUNCH_AT`: the homepage and pricing point to `/founding`, and `/start` goes to the waitlist. Testers get in with `/start?invite=<PRELAUNCH_INVITE>`.
- `/founding` captures name, email and an unticked email box. Each person gets an invite link (`/f/CODE`) and a status page (`/founding/status?code=CODE`) with their count. A friend counts once they tap the confirm link; same-network referrals within 24 hours still count but are flagged in `/admin`.
- Lead magnets post to `POST /api/waitlist` (JSON: `email, first_name, optin, source: quiz|stack, ref, utm_*`). The Founder Score, Day One Stack and Idea Test pages (`/score`, `/stack`, `/idea-test`) already join the waitlist automatically before launch.
- Founding price: `FOUNDING_PRICE` (shown on pages), `FOUNDING_CLOSES_AT`, `FOUNDING_CAP` (default 100), `REFERRALS_FOR_REWARD` (default 3), plus the founding price and coupon that `stripe:setup` creates. A founding member is anyone on the waitlist or who signs up before the close. Cancelling ends the founding price.
- `/admin` shows the waitlist (joined, confirmed, by source, top referrers, flags) with a CSV export.

## Security notes

Email confirmation (unconfirmed accounts get 3 AI messages; admin needs a confirmed email), password reset by email, rate limits on sign-in, signup, AI, waitlist and reset, AI runs counted before the call and refunded on failure, safe redirects after sign-in, security headers, `/healthz` for uptime checks. Deleting an account cancels its Stripe subscription and removes its events.

## Design

Dark and product-led, built from the existing 127group.io look (near-black, Geist type, grey-to-white headline fade, lavender-white buttons) with a members'-club feel for the Founder's Circle. All colors and type live as variables at the top of `public/css/style.css`. The homepage hero asks question 1 of the assessment inline; tapping an answer opens `/start` already on question 2.

## Still to do before launch

- Replace the starter library and founder note with your own content.
- Privacy policy, terms and refund policy (placeholders at `/privacy` and `/terms`).
- Klaviyo account and list ids, Stripe account and prices, launch dates and founding price (all env, no code changes).
