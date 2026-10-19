// The printable setup guide: one self-contained HTML file in the member's colors, no scripts.
// Every message sits in a copy block (click once to select it all) with its character count against
// ManyChat's limit; the phone preview and story frames are inline SVG; the rules and prices come
// from data/platform.json with the date they were checked and their sources.

const { files, text, time } = require('../../_kit');
const platform = require('../data/platform.json');
const { GOALS, FOLLOW_UP_HOURS, pathFor } = require('./goals');
const { LIMITS } = require('./limits');

const esc = files.esc;
const MC = platform.manychat;
const META = platform.meta;

// "#b5523b", 0.4 -> "rgba(181, 82, 59, 0.4)" (no color-mix, so older phones render it too)
function rgba(hex, a) {
  const h = String(hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function css(p) {
  return `
:root{--primary:${p.primary};--on-primary:${p.onPrimary};--accent:${p.accent};--ink:${p.ink};--paper:${p.paper};--surface:${p.surface};--muted:${p.muted};--line:${p.line};--deep:${p.deep};--bad:#b42318;--ok:#1a7f4b;color-scheme:light}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:1060px;margin:0 auto;padding:0 28px}
.hero{background:radial-gradient(900px 520px at 88% -10%,${rgba(p.primary, 0.7)},${rgba(p.primary, 0)} 70%),radial-gradient(700px 500px at -10% 120%,${rgba(p.accent, 0.35)},${rgba(p.accent, 0)} 70%),${p.deep};color:#fff;padding:72px 0 64px}
.kicker{font-size:13px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;opacity:.78}
h1{font-size:clamp(38px,6.4vw,74px);line-height:1.02;letter-spacing:-.035em;margin:18px 0 18px;font-weight:800;max-width:15ch}
.lede{font-size:clamp(18px,2.2vw,22px);max-width:40ch;opacity:.88;margin:0 0 30px}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:8px 16px;font-size:14px;font-weight:600;background:rgba(255,255,255,.06)}
.chip b{font-weight:800}
section{padding:64px 0 8px}
.sec-head{display:flex;align-items:baseline;gap:16px;margin-bottom:22px}
.sec-num{font-size:14px;font-weight:800;color:var(--primary);letter-spacing:.1em}
h2{font-size:clamp(28px,4vw,40px);line-height:1.1;letter-spacing:-.025em;margin:0;font-weight:800}
h3{font-size:21px;line-height:1.25;margin:0 0 8px;letter-spacing:-.01em}
p{margin:0 0 14px}
.muted{color:var(--muted)}
.grid2{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:36px;align-items:start}
.path{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.path li{display:grid;grid-template-columns:44px 1fr;gap:14px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px 18px}
.path .who{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.dot{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:var(--surface);color:var(--ink)}
.dot.you{background:var(--primary);color:var(--on-primary)}
.phone{background:var(--surface);border-radius:28px;padding:18px;border:1px solid var(--line);max-width:460px;margin:0 auto}
.phone svg{width:100%;height:auto;display:block}
.checks{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.checks li{display:grid;grid-template-columns:26px 1fr;gap:14px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.box{width:22px;height:22px;border:2px solid var(--primary);border-radius:6px;margin-top:3px}
.path-steps{font-weight:600}
.step{background:#fff;border:1px solid var(--line);border-radius:22px;padding:28px;margin:0 0 18px;break-inside:avoid}
.step-top{display:flex;gap:18px;align-items:flex-start;margin-bottom:12px}
.step-n{flex:0 0 auto;font-size:40px;line-height:1;font-weight:800;color:var(--primary);letter-spacing:-.04em;min-width:52px}
.copy{margin:14px 0 0;break-inside:avoid}
.copy-top{display:flex;justify-content:space-between;gap:12px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.count{font-variant-numeric:tabular-nums;letter-spacing:0;text-transform:none;font-weight:600}
.count.over{color:var(--bad)}
.msg{background:var(--surface);border-radius:16px 16px 16px 6px;padding:14px 18px;white-space:pre-wrap;user-select:all;-webkit-user-select:all;cursor:copy;font-size:17px;line-height:1.5;border:1px solid transparent}
.msg:hover{border-color:var(--primary)}
.btn-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.btn{display:inline-flex;align-items:center;gap:10px;border:1.5px solid var(--primary);color:var(--ink);border-radius:999px;padding:8px 16px;font-weight:700;font-size:15px;user-select:all;-webkit-user-select:all;background:#fff}
.btn small{font-weight:600;color:var(--muted);user-select:none;-webkit-user-select:none}
.btn.over{border-color:var(--bad)}
.url{font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all;background:#fff;border:1px dashed var(--line);border-radius:12px;padding:10px 14px;margin-top:10px;user-select:all;-webkit-user-select:all}
.note{font-size:15px;color:var(--muted);margin-top:10px}
.warn{background:#fff4f2;border:1px solid #f3c7bf;color:#7a271a;border-radius:14px;padding:12px 16px;font-size:15px;margin-top:12px}
.tip{border-left:4px solid var(--primary);padding:4px 0 4px 16px;margin:14px 0;color:var(--ink)}
.tags{display:flex;flex-wrap:wrap;gap:8px}
.tag{font:14px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--surface);border-radius:8px;padding:6px 10px;user-select:all;-webkit-user-select:all}
.reels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.reel{background:#fff;border:1px solid var(--line);border-radius:22px;padding:22px;break-inside:avoid}
.reel .len{font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.reel ol{padding-left:20px;margin:10px 0}
.reel li{margin:0 0 8px}
.say{font-weight:600}
.frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.frame{background:#fff;border:1px solid var(--line);border-radius:22px;padding:12px;break-inside:avoid}
.frame svg{width:100%;height:auto;display:block;border-radius:14px}
.frame p{font-size:14px;margin:10px 4px 2px;color:var(--muted)}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;font-size:15px}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--surface);font-size:13px;letter-spacing:.05em;text-transform:uppercase}
td.blank{min-width:70px}
.tw{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:18px}
.tw table{min-width:0}
.week{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.week li{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px}
.week b{display:block;color:var(--primary);font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
details{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 20px;margin-bottom:10px}
summary{font-weight:700;cursor:pointer}
details p{margin:10px 0 0}
.sources{font-size:13px;color:var(--muted);word-break:break-word}
.sources li{margin-bottom:4px}
footer{padding:48px 0 64px}
@media (max-width:820px){.grid2,.reels,.frames{grid-template-columns:1fr}.wrap{padding:0 16px}.hero{padding:48px 0 40px}.step{padding:20px}.frames{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.frame{padding:6px}.frame p{display:none}table{font-size:14px}th,td{padding:10px 8px}th{font-size:11px;letter-spacing:.03em}td.blank{min-width:34px}.hide-sm{display:none}}
@media print{@page{size:Letter;margin:14mm}body{font-size:12pt;background:#fff}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:28px 0}section{padding:24px 0 0}.step,.reel,.frame,details,table,.copy{break-inside:avoid}details{display:block}details>*{display:block}.msg{border:1px solid var(--line)}.phone{max-width:300px}.wrap{max-width:none;padding:0}}
`;
}

function count(s, limit) {
  const n = String(s || '').length;
  return `<span class="count${n > limit ? ' over' : ''}">${n} / ${limit}</span>`;
}

function copyBlock(label, body, limit) {
  return `<div class="copy"><div class="copy-top"><span>${esc(label)}</span>${limit ? count(body, limit) : ''}</div><div class="msg">${esc(body)}</div></div>`;
}

function buttonRow(buttons) {
  if (!buttons || !buttons.length) return '';
  return `<div class="btn-row">${buttons
    .map((b) => `<span class="btn${b.title.length > LIMITS.button ? ' over' : ''}">${esc(b.title)} <small>${b.title.length}/${LIMITS.button}${b.action === 'url' ? ', link button' : ''}</small></span>`)
    .join('')}</div>`;
}

function step(n, title, body) {
  return `<div class="step"><div class="step-top"><div class="step-n">${String(n).padStart(2, '0')}</div><div><h3>${esc(title)}</h3></div></div>${body}</div>`;
}

function para(s) {
  return `<p>${esc(s)}</p>`;
}

function planName(id) {
  const p = MC.plans.list.find((x) => x.id === id);
  return p ? p.name : 'Free';
}

// d: { plan, keyword, url, messages, tags, promo, frames (svg strings), phone (svg), posts, palette, today }
function buildGuide(d) {
  const { plan, keyword: K, messages: msgs, palette: p } = d;
  const goal = plan.goal;
  const g = GOALS[goal] || GOALS.freebie;
  const f = plan.facts || {};
  const isStory = goal === 'story';
  const byId = Object.fromEntries(msgs.map((m) => [m.id, m]));
  const replies = byId.publicReplies ? byId.publicReplies.texts : [];
  const mcPlan = (plan.manychat && plan.manychat.plan) || MC.plans.list[0];
  const headline = {
    freebie: `Comment ${K}, get the ${f.thing}`,
    booking: `Comment ${K}, book a ${/call|chat|session|consult/i.test(f.thing) ? f.thing : 'call'}`,
    product: `Comment ${K}, get the link`,
    story: `Reply ${K}, get the ${f.thing}`,
    waitlist: `Comment ${K}, join the waitlist`,
  }[goal];
  const problems = msgs.flatMap((m) => (m.type === 'public_reply' ? m.checks.flatMap((c, i) => c.problems.map((x) => `Public reply ${i + 1}: ${x}`)) : (m.check ? m.check.problems : []).map((x) => `${m.title}: ${x}`)));

  // ---------- hero ----------
  const hero = `<header class="hero"><div class="wrap">
<div class="kicker">DM funnel setup guide${f.business ? ` for ${esc(f.business)}` : ''}</div>
<h1>${esc(headline)}</h1>
<p class="lede">${esc(g.summary)}</p>
<div class="chips"><span class="chip">Keyword <b>${esc(K)}</b></span><span class="chip">ManyChat <b>${esc(mcPlan.name)}</b> plan</span><span class="chip">Setup about <b>20 minutes</b></span><span class="chip">${isStory ? 'Story reply' : 'Comment'} trigger</span></div>
</div></header>`;

  // ---------- 1. how it works ----------
  const pathItems = pathFor(goal, { keyword: K, emailCapture: !!plan.emailCapture })
    .map((s, i) => `<li><span class="dot${s.who === 'you' ? ' you' : ''}">${i + 1}</span><div><span class="who">${s.who === 'you' ? 'Automatic, from you' : 'Them'}</span><div><b>${esc(s.title)}</b></div><div class="muted">${esc(s.detail)}</div></div></li>`)
    .join('');
  const how = `<section><div class="wrap"><div class="sec-head"><span class="sec-num">01</span><h2>How it works</h2></div>
<div class="grid2"><div><ol class="path">${pathItems}</ol>
<p class="tip">${esc(isStory ? `Someone replying to your story is a message to you, so the conversation is already open and the link goes out right away.` : `Instagram lets a business send one private message to someone who commented, and keep talking only after they respond. That's why the first DM has a button: the tap is their response, and it opens a ${META.standardWindowHours} hour window for the rest.`)}</p></div>
<div class="phone">${d.phone || ''}</div></div></div></section>`;

  // ---------- 2. before you start ----------
  const link = plan.link || {};
  const posts = d.posts && d.posts.status === 'ok' && d.posts.top && d.posts.top.length ? d.posts.top.slice(0, 3) : [];
  const before = `<section><div class="wrap"><div class="sec-head"><span class="sec-num">02</span><h2>Before you start</h2></div><ul class="checks">
<li><span class="box"></span><div><b>Instagram professional account.</b> ${esc(MC.connect.account)}</div></li>
<li><span class="box"></span><div><b>Allow access to messages.</b> In the Instagram app: <span class="path-steps">${esc(MC.connect.allowMessages.join(' > '))}</span>. ${esc(MC.connect.allowMessagesNote)}</div></li>
<li><span class="box"></span><div><b>ManyChat connected to Instagram.</b> Sign up at manychat.com and connect your Instagram account. The ${esc(planName('free'))} plan covers up to ${esc(String(MC.plans.list[0].activeContacts))} people a month, with up to ${esc(String(MC.plans.list[0].liveAutomations).replace(/ at a time$/, ''))} automations live at a time. ${esc(plan.manychat ? plan.manychat.why : '')}</div></li>
<li><span class="box"></span><div><b>Your link.</b> ${esc(link.note || 'Open your link once on your phone to be sure it works.')}${d.url ? `<div class="url">${esc(d.url)}</div><div class="note">We added tracking tags (utm) so your analytics show visits from these DMs. The link works the same.</div>` : ''}</div></li>
${posts.length ? `<li><span class="box"></span><div><b>Where the keyword goes first.</b> Your posts with the most comments: ${esc(text.list(posts.map((x, i) => `${i + 1}) "${text.clip(x.caption || 'untitled', 48)}" (${x.comments} comments)`)))}. Add a line to their captions: "${esc(isStory ? `Send me ${K} in a DM` : `Comment ${K} and I'll send it to you`)}."${d.posts.sample ? ' (Sample posts until Instagram is connected.)' : ''}</div></li>` : ''}
</ul></div></section>`;

  // ---------- 3. build it ----------
  const steps = [];
  let n = 1;
  if (isStory) {
    steps.push(step(n++, 'Start a story reply automation', para(`In ManyChat, go to Automations and create a new automation. Choose the Instagram trigger for story replies. Pick ${MC.storyReplyTrigger.scope.join(' or ').toLowerCase()}, and set it to reply when the message contains ${K}.`) + copyBlock('Keyword', K)));
  } else {
    steps.push(step(n++, 'Start the automation', para(`In ManyChat, go to Automations, create a new automation and pick the quick automation called "${MC.quickAutomation.name}". It has a slot for each message below.`) + `<p class="note">Prefer the flow builder? Use the Instagram trigger for post and reel comments and add the same messages in order.</p>`));
    steps.push(
      step(
        n++,
        'Pick the posts and the keyword',
        para(`Choose ${MC.commentTrigger.postScope.map((x) => x.toLowerCase()).join(', or ')}. All posts works well once you add the keyword line to older captions. Add the keyword in capitals and lowercase to be safe.`) +
          copyBlock('Keyword', K) +
          copyBlock('Keyword, lowercase', K.toLowerCase()) +
          `<p class="note">${esc(MC.commentTrigger.firstCommentOnly)}</p>`
      )
    );
    if (replies.length)
      steps.push(
        step(
          n++,
          'Public replies under the comment',
          para(`ManyChat posts one of these under each comment so others see it works. Paste replies 1 to ${Math.min(MC.quickAutomation.publicReplies, replies.length)} now and swap in the others next week so they never look copied.`) + replies.map((r, i) => copyBlock(`Public reply ${i + 1}`, r, LIMITS.publicReply)).join('')
        )
      );
    if (byId.opening) steps.push(step(n++, 'Opening DM with a button', para('Sent privately to everyone who comments the keyword. Keep the button: the tap is what lets you keep talking.') + copyBlock('Opening DM', byId.opening.text, LIMITS.withButtons) + buttonRow(byId.opening.buttons)));
  }
  if (byId.question) {
    steps.push(step(n++, 'One question before the calendar', para('Add a message after the button tap with these three answer buttons. Each answer can add a tag, so you know who is ready before the call.') + copyBlock('Question', byId.question.text, LIMITS.withButtons) + buttonRow(byId.question.buttons)));
  }
  if (byId.emailAsk) {
    steps.push(step(n++, 'Ask for their email', para(`Turn on "Collect emails" (an ${planName('essential')} plan feature). Instagram stops automated messages ${META.standardWindowHours} hours after their last message, so email is how you reach them later.`) + copyBlock('Email ask', byId.emailAsk.text, LIMITS.withoutButtons)));
  }
  if (byId.link) {
    const hasBtn = byId.link.buttons && byId.link.buttons.length;
    steps.push(step(n++, hasBtn ? 'The link message' : byId.link.title, para(hasBtn ? 'Paste the message, add a link button, and paste your link into the button.' : 'The last message, after they give their email.') + copyBlock(byId.link.title, byId.link.text, hasBtn ? LIMITS.withButtons : LIMITS.withoutButtons) + buttonRow(byId.link.buttons) + (hasBtn && d.url ? `<div class="url">${esc(d.url)}</div>` : '')));
  }
  if (byId.followUp) {
    steps.push(
      step(
        n++,
        'Follow-up for people who did not open it',
        para(`Turn on the follow-up and set the delay to about ${FOLLOW_UP_HOURS} hours. It must land inside Instagram's ${META.standardWindowHours} hour window, and it only goes to people who didn't open the link.`) +
          copyBlock('Follow-up', byId.followUp.text, LIMITS.withButtons) +
          buttonRow(byId.followUp.buttons) +
          `<p class="note">${esc(MC.plans.featureNotes.find((x) => x.feature === 'followUp').text)}</p>`
      )
    );
  }
  steps.push(
    step(
      n++,
      'Tags, so you can count',
      para(`Add these tags at each step (tags come with the ${planName('essential')} plan; on ${planName('free')}, skip this and write down the numbers ManyChat shows on the automation page).`) +
        `<div class="tags">${(d.tags || []).map((t) => `<span class="tag" title="${esc(t.when)}">${esc(t.tag)}</span>`).join('')}</div><ul class="note">${(d.tags || []).map((t) => `<li><b>${esc(t.tag)}</b>: ${esc(t.when)}</li>`).join('')}</ul>`
    )
  );
  if (!isStory) {
    steps.push(step(n++, 'Catch story replies too', para(`Your story frames ask people to reply ${K}. Make a second automation with the story reply trigger, keyword ${K}, and paste the link message and follow-up from above.`)));
  }
  steps.push(step(n++, 'Catch DMs with the keyword', para(`Some people will DM you the word instead. Add a keywords trigger set to "${MC.keywordTrigger.matching[2]}" with ${K}, pointing at the same messages. ${MC.keywordTrigger.note}`)));
  steps.push(step(n++, 'Set it live', para('Turn the automation on. Then test it right away with the checklist below.')));
  const build = `<section><div class="wrap"><div class="sec-head"><span class="sec-num">03</span><h2>Build it in ManyChat</h2></div>
<p class="muted">Click a message once to select all of it, then copy. On a phone, press and hold.</p>
${problems.length ? `<div class="warn"><b>Fix before you publish:</b> ${esc(problems.join(' '))}</div>` : ''}
${steps.join('\n')}</div></section>`;

  // ---------- 4. test ----------
  const test = `<section><div class="wrap"><div class="sec-head"><span class="sec-num">04</span><h2>Test it in 5 minutes</h2></div><ul class="checks">
<li><span class="box"></span><div>From a second account (a friend's works), ${isStory ? `reply ${K} to your story` : `comment ${K} on the post`}. Use an account that hasn't commented there before.</div></li>
${isStory ? '' : '<li><span class="box"></span><div>Within a minute: a public reply under the comment, and the opening DM in their inbox or message requests.</div></li>'}
<li><span class="box"></span><div>${isStory ? 'The link message arrives right away.' : 'Tap the button. The next message arrives.'} Open the link on the phone and check it loads.</div></li>
<li><span class="box"></span><div>In ManyChat, open Contacts: the test account is there${(d.tags || []).length ? ` with the ${esc(d.tags[0].tag)} tag` : ''}.</div></li>
<li><span class="box"></span><div>Ask your friend to leave the link closed. The follow-up should arrive about ${FOLLOW_UP_HOURS} hours later.</div></li>
</ul></div></section>`;

  // ---------- 5. promo ----------
  const reels = (d.promo && d.promo.reels ? d.promo.reels : [])
    .map(
      (r, i) => `<div class="reel"><div class="len">Reel ${i + 1} · ${esc(r.length || '15 to 30 seconds')}</div><h3>${esc(r.title)}</h3>
<p><span class="say">"${esc(r.hook.say)}"</span>${r.hook.text ? `<br><span class="muted">On screen: ${esc(r.hook.text)}</span>` : ''}</p>
<ol>${(r.beats || []).map((b) => `<li>${esc(b.shot)}${b.say ? `<br><span class="say">"${esc(b.say)}"</span>` : ''}${b.text ? `<br><span class="muted">On screen: ${esc(b.text)}</span>` : ''}</li>`).join('')}</ol>
<p><span class="say">"${esc(r.cta.say)}"</span><br><span class="muted">On screen: ${esc(r.cta.text)}</span></p>
${copyBlock('Caption', r.caption, 2200)}</div>`
    )
    .join('');
  const frames = (d.frames || [])
    .map((svgStr, i) => {
      const s = (d.promo && d.promo.stories && d.promo.stories[i]) || {};
      return `<div class="frame">${svgStr}<p>${esc(s.sticker || (i === 2 ? 'Leave the bottom clear for the reply box.' : ''))}</p></div>`;
    })
    .join('');
  const promo = `<section><div class="wrap"><div class="sec-head"><span class="sec-num">05</span><h2>Get people ${isStory ? 'replying' : 'commenting'}</h2></div>
<p>The automation only works when people see the keyword. Film these three, post the story frames, and pin this comment under every reel:</p>
${copyBlock('Pinned comment', (d.promo && d.promo.pinned) || '', 2200)}
<div class="reels" style="margin-top:22px">${reels}</div>
<h3 style="margin-top:34px">Story frames</h3><p class="muted">Post all three in a row. The PNG files are in your Library.</p>
<div class="frames">${frames}</div></div></section>`;

  // ---------- 6. first week ----------
  const days = [
    ['Day 1', `Build the automation, test it, and post reel 1 with the pinned comment.`],
    ['Day 2', `Post the three story frames.`],
    ['Day 3', posts.length ? `Add the keyword line to the captions of your top ${posts.length} posts.` : 'Add the keyword line to the captions of your 3 most-commented posts.'],
    ['Day 4', 'Post reel 2. Reply by hand to anyone who asked a question in the DMs.'],
    ['Day 5', 'Swap in public replies 4 and 5. Post the story frames again with a new first frame.'],
    ['Day 6', 'Post reel 3.'],
    ['Day 7', 'Write down your numbers below. Change one thing next week: the hook, the keyword or the first DM.'],
  ];
  const week = `<section><div class="wrap"><div class="sec-head"><span class="sec-num">06</span><h2>Your first week</h2></div>
<ul class="week">${days.map(([d1, t]) => `<li><b>${esc(d1)}</b>${esc(t)}</li>`).join('')}</ul>
<p class="tip">Your first 25: read every conversation from the first 25 people who come through and answer questions yourself. Their words tell you what to put in the next reel, and it's how a funnel turns into real conversations.</p></div></section>`;

  // ---------- 7. numbers ----------
  const numbers = `<section><div class="wrap"><div class="sec-head"><span class="sec-num">07</span><h2>Numbers to write down</h2></div>
<p class="note">Fill one column at the end of each week, straight from ManyChat and Instagram.</p>
<div class="tw"><table><thead><tr><th>Number</th><th>Where to find it</th><th><span class="hide-sm">Week </span>1</th><th><span class="hide-sm">Week </span>2</th><th><span class="hide-sm">Week </span>3</th><th><span class="hide-sm">Week </span>4</th></tr></thead><tbody>
${(plan.numbers || []).map((r) => `<tr><td><b>${esc(r.label)}</b></td><td class="muted">${esc(r.where)}</td><td class="blank"></td><td class="blank"></td><td class="blank"></td><td class="blank"></td></tr>`).join('')}
</tbody></table></div>
<p class="note">Two numbers matter most: of the people who got the DM, how many tapped, and of those, how many opened the link. If taps are low, change the opening DM. If opens are low, change the link message.</p></div></section>`;

  // ---------- 8. rules ----------
  const plansRows = MC.plans.list
    .map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${x.monthly ? `$${x.monthly} a month, or $${x.yearlyPerMonth} a month billed yearly` : 'Free'}</td><td>${esc(x.activeContacts.toLocaleString('en-US'))} people a month</td><td>${esc(x.includes)}</td></tr>`)
    .join('');
  const rules = `<section><div class="wrap"><div class="sec-head"><span class="sec-num">08</span><h2>Rules that matter</h2></div>
<ul class="checks">
<li><span class="box"></span><div><b>One message until they respond.</b> ${esc(META.privateReplies)}</div></li>
<li><span class="box"></span><div><b>The ${META.standardWindowHours} hour window.</b> ${esc(META.standardWindow)} ${esc(MC.windows.text)}</div></li>
<li><span class="box"></span><div><b>Replies by hand for ${META.humanAgentDays} days.</b> ${esc(META.humanAgent)}</div></li>
<li><span class="box"></span><div><b>ManyChat limits.</b> ${esc(MC.limits.notes.join(' '))}</div></li>
<li><span class="box"></span><div><b>No broadcasts later.</b> ${esc(META.noOneTimeNotifications)} If you want to reach people next month, collect their email.</div></li>
</ul>
<h3 style="margin-top:28px">ManyChat plans</h3>
<div class="tw"><table><thead><tr><th>Plan</th><th>Price</th><th>Who it covers</th><th>What it adds</th></tr></thead><tbody>${plansRows}</tbody></table></div>
<p class="note">${esc(MC.plans.activeContacts)} ${esc(MC.plans.caveat)} Prices checked ${esc(time.longDate(MC.plans.checked))}.</p></div></section>`;

  // ---------- 9. troubleshooting ----------
  const fix = `<section><div class="wrap"><div class="sec-head"><span class="sec-num">09</span><h2>If something doesn't work</h2></div>
<details><summary>ManyChat says connected, but nothing happens</summary><p>${esc(`Check "Allow access to messages": ${MC.connect.allowMessages.join(' > ')}. ${MC.connect.allowMessagesNote}`)}</p></details>
<details><summary>Some comments don't get a DM</summary><p>${esc(MC.commentTrigger.firstCommentOnly)} Also check the comment has the keyword as its own word, and that the automation is live on that post.</p></details>
<details><summary>The DM went to message requests</summary><p>That's normal for people who don't follow you yet. The public reply tells them to check requests. Once they tap the button, the chat moves to their main inbox.</p></details>
<details><summary>The follow-up never sent</summary><p>${esc(`It only goes to people who didn't open the link, and only inside the ${META.standardWindowHours} hour window. If the delay is longer than that, Instagram won't deliver it.`)} ${esc(MC.plans.featureNotes.find((x) => x.feature === 'followUp').text)}</p></details>
<details><summary>The link opens a login page</summary><p>Some links (shared drives, private pages) need a login. Open your link in a private browser window. If it asks you to sign in, change its sharing to "anyone with the link".</p></details>
<details><summary>A button won't save</summary><p>Button names can be ${LIMITS.button} characters at most. The counts next to each button above show where you stand.</p></details>
</div></section>`;

  // ---------- footer ----------
  const srcs = [...new Set([...MC.plans.sources, MC.connect.source, MC.commentTrigger.source, ...MC.quickAutomation.sources, ...MC.limits.sources, MC.keywordTrigger.source, MC.storyReplyTrigger.source, MC.windows.source, ...META.sources])];
  const footer = `<footer><div class="wrap"><p class="muted">Platform facts checked ${esc(time.longDate(platform.checked))}. Instagram and ManyChat change their apps often: if a menu name differs, look for the closest match.</p><ul class="sources">${srcs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></footer>`;

  return files.htmlDoc({
    title: `${headline} | ${f.business || 'DM funnel'} setup guide`,
    description: g.summary,
    css: css(p),
    body: [hero, how, before, build, test, promo, week, numbers, rules, fix, footer].join('\n'),
  });
}

module.exports = { buildGuide, css };
