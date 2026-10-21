# Writing a vertical

One file per kind of business: `content/verticals/<slug>.json`. The page at /for/<slug>, its pack, its sample site
and its launch kit all come from this file. Nobody builds a page by hand.

## Start

    node scripts/build-verticals.js new cat-breeders --like dog-breeders --name "Cat breeders"

That copies the closest vertical as a draft and marks every line to rewrite with TODO. Rewrite them all, then:

    node scripts/build-verticals.js --check          # every problem, or "no problems"
    node scripts/build-verticals.js cat-breeders --shots   # pack files, sample site, phone poster
    npm test

Set `status` to `ready` when it passes. `test` (live to everyone while VERTICALS=on) is Eli's call, made on the board.

## The fields

- `name`: plural, how they'd say it ("Cat breeders"). `one`: one of their businesses ("cattery"); the page writes
  "a week at a cattery" and "your cattery", so it has to read right after "a" and "your".
- `group`: the shelf on /for (Pets, Local service, Online stores, Food and drink, Fitness, Creators and editors,
  Trucking and freight). Reuse one before adding one.
- `h1`: their problem in their words, 4 to 9 words. `mark`: one word or phrase from the h1 that gets the drawn line.
- `lede`: "127 gives a small <one> ..." then the concrete things, no adjectives.
- `week`: 3 to 5 rows. `when` is Mon to Sun; `job` is what they do that day; `hand` is the exact file or prompt 127
  hands them for it.
- `site.design`: a site pack design id. `site.sample`: a made-up business (`business`, `what` as a noun phrase,
  `services` as their real items with prices, `city`). `caption` says it's made up. Before it goes past admins,
  search the name with the trade and city (the web, Google Maps, USPTO's trademark search) and rename it if a real
  business in that trade uses it (Legal L102 VT5).
- `entry.door`: `site` (free site builder), `store` (store audit) or `creator` (creator kit); `label` is the button.
- `pack`: `name`, `price` ($29 to $49), `line`, `items` (ready Store item ids), three `prompts` written for this
  business, optional `kitFrom` to borrow files from another kit, and `notes`: what the owner must know before using
  the files (licenses, permits, what never to claim). Notes go at the top of the pack's README.
- A prompt's `rules` adds Legal's lines to it: `texts` (consent, the business name, STOP, 8am to 8pm), `pitch` (name,
  business, mailing address, "Reply 'no thanks' and I won't follow up."), `recurring` (price, how often, how to
  cancel, as easy as signing up). The check flags a prompt that writes texts or sells a recurring plan without it.
- `hq`: HQ pack ids that run their week (no held packs).
- `hooks`: 6 opening lines for posts. Say "I" only when it's true for whoever says it; otherwise "How to" or "I'd".
  A hook with money in it (a cost, a price) is organic only, with "Example: made-up numbers" on screen.
- `ads`: 3 angles with hook, body, headline. Promise the free result and describe the files, never clients,
  bookings, sales, income or results. The only dollar figure an ad may show is the pack's price.
- `keyword`: the DM word, 3 to 12 capital letters, unique. Keywords are off until Eli turns them on, and the first
  DM opens with L69's line.
- `next`: related slugs. `legal`: what's regulated about this business, or null. `legalRead`: the Legal ruling that
  read the note (like "L102"). A vertical with a note and no `legalRead` stays at admins, whatever its status.

## The rules the check enforces

The copy check with the paid rules (no income claims, no promise of clients or leads, the typicality line wherever
money appears), no em dashes, no TODO left, every design, Store item and HQ pack real. Also, by hand: none of the
words on the AI tells list (/mnt/project-files/v2/design/site-templates/30k-prompt.md), no "students", nothing a
template would write for any business. If Legal would want to read it, say so in `legal`.
