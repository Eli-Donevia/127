# DM funnel kit (`dm`)

ManyChat funnels for the member's own Instagram: people comment or reply with a word and get the
freebie, calendar, product link or waitlist by DM. Every funnel ends in a printable setup guide
(no scripts, prints on Letter) with each message as a copy block, a JSON spec of the flow,
3 story frames (PNG and MP4), 3 reel scripts and a pinned comment.

## Workflows

| id | title | tier | credits per run |
|---|---|---|---|
| dm.comment_to_dm | Send your freebie by DM | free | 19 |
| dm.booking | DM to booked call | builder | 19 |
| dm.product_link | DM a product link | builder | 20 |
| dm.story_reply | Story reply funnel | builder | 19 |
| dm.waitlist | Fill a waitlist | builder | 19 |
| dm.reply_bank | Answers for your DMs | builder | 7 |
| dm.check_funnel | Check your DM funnel | builder | 1 |

Funnel steps: (`read_product` for product_link) > `plan_funnel` > approve keyword (pick 1 of 3) >
`rank_posts` > `write_flow` > approve messages (editable) > `promo_scripts` > `story_frames` > `setup_guide`.

## Tools: inputs and outputs

- `dm.plan_funnel` (code, 1): in `goal` (freebie|booking|product|story|waitlist), `offer`, `link`, `inside`, `keyword`, `emailCapture`, `launch`, `date`, `price`, `product`. Out `keywords[3]` {keyword, why}, `path`, `numbers`, `link` {status works|private|broken|not_checked|missing}, `manychat` {plan, why, plans, checked, source}, `facts`, `today`.
- `dm.rank_posts` (api, 1, wants `instagram` {token, userId}): in `keyword`, `instagram` (handle, defaults to the brain). Out `status` (ranked|sample|not_connected|no_handle), `handle`, `top[5]`, `advice`. Reads Business Discovery on the Graph API; never logs the token.
- `dm.read_product` (api, 1): in `url`, `price`. Out `status` (read|unknown|blocked|missing), `name`, `price`, `priceText`, `description`, `image`, `source` (JSON-LD, Open Graph or Shopify product JSON). Robots respected.
- `dm.write_flow` (ai write, 6): in `plan`, `keyword`. Out `items` (5 public replies, opening DM + button, question + 3 answers for booking, email ask, link message + button, follow-up + button), `url` (tracked with utm), `tags`, `problems`.
- `dm.promo_scripts` (ai write, 6): in `plan`, `keyword`. Out `reels[3]` {title, length, hook, beats, cta, caption}, `stories[3]` {kicker, title, lines, sticker}, `pinned`.
- `dm.story_frames` (code, 3, wants `render`): in `plan`, `keyword`, `stories`. Out `frames[3]` {png}, `video` (MP4, 5 s each), `zip` (SVGs).
- `dm.setup_guide` (code, 2): in `plan`, `keyword`, `url`, `items`, `promo`, `posts`. Out `guide` (HTML), `spec` (JSON), `preview` (PNG phone mockup), `messages`, `tags`.
- `dm.write_replies` (ai write, 6): in `facts` ("Key: value" lines), `link`. Out 20 replies + 4 keyword auto-replies, `missing` (count with [brackets]).
- `dm.reply_sheet` (code, 1): in `items`, `link`, `color`. Out `sheet` (HTML), `csv`.
- `dm.check_funnel` (code, 1): in `keyword`, `opening`, `openingButton`, `link`, `linkButton`, `followUp`, `followUpHours`, `publicReplies`. Out `rows` {item, status fix|warn|ok, note, fix}, `fixes`, `warnings`.

## Real vs sample

- Real with no keys: keyword picks, every message (template copy from the member's brain and inputs, checked against ManyChat's limits), link check, product page read, guide, spec, frames, reply sheet, funnel check.
- Needs a key: `instagram` (top posts from the member's own account). Without it, `rank_posts` shows fictional sample posts in sample mode and manual steps otherwise. `render` makes the PNG and MP4 frames; without it the SVG zip and the inline frames in the guide still work.
- AI rewrites copy in the member's voice when the harness AI is on; fallbacks are full templates.

## Facts

`data/platform.json`: ManyChat plans and limits, Instagram's messaging windows and private reply rules, each with its source URL, checked 2026-10-19.

## Verified live (2026-10-19)

`node dev/run.js dm.product_link --live --input url=https://www.allbirds.com/products/mens-tree-runners` read the public product page: name, $100 price and description, then built the full funnel (20 credits). Link checks run the same way on the member's own link.
