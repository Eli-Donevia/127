// Library worksheets: interactive calculators + copy buttons.
// Each calculator renders into <div data-calc="key"> and mirrors its inputs and
// results into the form's hidden __calc field, so they save with the worksheet
// and can be sent to Eli's Playbook for feedback.
// The formulas and thresholds follow product/playbooks/CALCULATORS.md. Input keys never
// change meaning, so saved answers keep loading.
(function () {
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var el = document.querySelector(b.getAttribute('data-copy'));
    if (!el) return;
    var done = function () { var t = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = t; }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(el.innerText).then(done, done); else done();
  });

  var root = document.querySelector('[data-calc]');
  if (!root) return;
  var hidden = root.closest('form').querySelector('input[name=__calc]');
  var saved = {};
  try { saved = JSON.parse(hidden.value || '{}').inputs || {}; } catch (e) { saved = {}; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(id) { var v = parseFloat(String((root.querySelector('[data-k="' + id + '"]') || {}).value || '').replace(/[$,%\s]/g, '')); return isFinite(v) ? v : 0; }
  function val(id) { return (root.querySelector('[data-k="' + id + '"]') || {}).value || ''; }
  function blank(id) { return String(val(id)).trim() === ''; }
  function money(n) { var a = Math.abs(n); return (n < 0 ? '-' : '') + '$' + (Math.round(a * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: a < 10 ? 2 : 0 }); }
  function pct(n) { return (Math.round(n * 10) / 10) + '%'; }
  function round1(n) { return (Math.round(n * 10) / 10).toString(); }
  function inp(k, label, ph, cls) { return '<label class="field ' + (cls || '') + '"><span>' + label + '</span><input class="input" inputmode="decimal" data-k="' + k + '" placeholder="' + esc(ph || '') + '" value="' + esc(saved[k] || '') + '"></label>'; }
  // Lists of prices ("600, 500, 700"): the iOS decimal keypad has no comma, so these use the text keyboard.
  function inpList(k, label, ph) { return '<label class="field"><span>' + label + '</span><input class="input" inputmode="text" data-k="' + k + '" placeholder="' + esc(ph || '') + '" value="' + esc(saved[k] || '') + '"></label>'; }
  function sel(k, label, options) { return '<label class="field"><span>' + label + '</span><select class="input" data-k="' + k + '">' + options.map(function (o) { return '<option' + (saved[k] === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>'; }
  function list(id) { return String(val(id)).split(/[,;\s]+/).map(function (x) { return parseFloat(x.replace(/\$/g, '')); }).filter(function (x) { return isFinite(x) && x > 0; }); }
  function median(arr) { var a = arr.slice().sort(function (x, y) { return x - y; }), m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  // rows: [label, value, dim]. A dim row is shown greyed (too few to judge).
  function out(rows) { return rows.map(function (r) { return '<div class="calc-out' + (r[2] ? ' dim' : '') + '"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join(''); }
  function lines(arr, style) { return arr.map(function (t, i) { return '<p class="small' + (style ? '' : ' muted') + '" style="margin:' + (i ? 6 : 8) + 'px 0 0' + (style ? ';' + style : '') + '">' + t + '</p>'; }).join(''); }
  function prompt(t) { return { html: '<p class="small muted" style="margin:0">' + t + '</p>', summary: '' }; }
  function plain(rows) { return rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('; '); }

  var calcs = {
    'idea-score': {
      criteria: ['People pay to solve it (proof)', 'Economics and channels work', 'Clear differentiator', 'Market growing, AI-proof', 'Insider access', "I'll care in 2 years"],
      hints: [
        '5 = 3+ named people or businesses paying today, with prices. 1 = can\'t name anyone.',
        '5 = a sale clears a profit and you can reach 20 buyers this month. 1 = needs shelf space, big ads or a platform\'s approval.',
        '5 = a customer could repeat your edge in one sentence. 1 = \'I care more\'.',
        '5 = demand rising and AI speeds you up. 1 = a free AI tool does the job.',
        '5 = you lived it or a named insider agreed to talk. 1 = nobody in that world.',
        '5 = you\'d do it for fun. 1 = bored by spring.',
      ],
      render: function () {
        var c = this.criteria, hints = this.hints, h = '<div class="scroll-x"><table class="t idea-grid"><thead><tr><th>Idea</th>';
        c.forEach(function (x, i) { h += '<th title="' + esc(x + '. ' + hints[i]) + '">' + (i + 1) + '</th>'; });
        h += '<th>Sum</th></tr></thead><tbody>';
        for (var r = 0; r < 5; r++) {
          h += '<tr><td><input class="input" data-k="idea' + r + '" placeholder="Idea ' + (r + 1) + '" value="' + esc(saved['idea' + r] || '') + '"></td>';
          for (var i = 0; i < c.length; i++) {
            var k = 's' + r + '_' + i, sv = saved[k] || '';
            h += '<td><select class="input sc" data-k="' + k + '"><option value=""></option>' + [1, 2, 3, 4, 5].map(function (n) { return '<option' + (String(n) === String(sv) ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></td>';
          }
          h += '<td class="mono tot" data-tot="' + r + '">0</td></tr>';
        }
        h += '</tbody></table></div><ol class="calc-legend">' + c.map(function (x, i) { return '<li><strong>' + esc(x) + '</strong><span>' + esc(hints[i]) + '</span></li>'; }).join('') + '</ol><div class="calc-res"></div>';
        return h;
      },
      compute: function () {
        var c = this.criteria, ideas = [], named = 0;
        for (var r = 0; r < 5; r++) {
          var name = val('idea' + r).trim(), sc = [], t = 0, n = 0;
          for (var i = 0; i < 6; i++) { var s = num('s' + r + '_' + i); sc.push(s); if (s) { t += s; n++; } }
          root.querySelector('[data-tot="' + r + '"]').textContent = t || '0';
          if (name) named++;
          if (!name || !n) continue;
          // Ties on the lowest score go to the earlier, more important question.
          var low = 6, li = -1;
          sc.forEach(function (s, i) { if (s && s < low) { low = s; li = i; } });
          ideas.push({ r: r, name: name, t: t, n: n, p: sc[0], low: low, li: li,
            ones: sc.map(function (s, i) { return s === 1 ? c[i] : null; }).filter(Boolean),
            highs: sc.filter(function (s) { return s >= 4; }).length });
        }
        var full = ideas.filter(function (x) { return x.n === 6; })
          .sort(function (a, b) { return b.t - a.t || b.p - a.p || a.r - b.r; });
        var partial = ideas.filter(function (x) { return x.n < 6; });
        var leaderRow = full.length ? full[0].r : -1;
        if (!named) {
          root.querySelectorAll('.tot').forEach(function (td) { td.classList.remove('win'); });
          return prompt('Name an idea and score it 1 to 5 on each question.');
        }
        var waiting = partial.length ? '<p class="small muted" style="margin:8px 0 0">Not in the race yet: ' + partial.map(function (x) { return esc(x.name) + ' (' + x.n + ' of 6 scored)'; }).join(', ') + '.</p>' : '';
        var partialSummary = partial.map(function (x) { return x.name + ': ' + x.n + ' of 6 scored'; });
        if (!full.length) {
          root.querySelectorAll('.tot').forEach(function (td) { td.classList.remove('win'); });
          return { html: '<p class="small muted" style="margin:0">Score all 6 questions for at least one idea.</p>' + waiting, summary: partialSummary.join('; ') + '.' };
        }
        // Near tie: within 2 points, question 1 (proof) is tie-breaker 1.
        var by = 'total', tieNote = '';
        if (full.length > 1 && full[0].t - full[1].t <= 2) {
          if (full[1].p > full[0].p) { var sw = full[0]; full[0] = full[1]; full[1] = sw; by = 'question 1 tie-break'; }
          else if (full[1].p === full[0].p) tieNote = 'Still tied. Use tie-breakers 2 to 5 in the playbook: fastest path to a paying customer, lowest cost to test, insider, coin flip.';
          else if (full[0].t === full[1].t) by = 'question 1 tie-break';
        }
        var L = full[0];
        leaderRow = L.r;
        root.querySelectorAll('.tot').forEach(function (td) { td.classList.toggle('win', +td.getAttribute('data-tot') === leaderRow); });
        var verdict = [L.p <= 2 ? 'Not ready: no proof yet that people pay. Run the proof hunt before anything else.'
          : L.t >= 22 ? 'Strong. Take it to real buyers this week.'
          : L.t >= 16 ? 'Promising, with gaps. Fix ' + c[L.li] + ' first.'
          : 'Weak across the board. Pick again in one more sitting, not one more month.'];
        if (L.ones.length) verdict.push('Red flag: ' + L.ones.join(', ') + ' scored 1.');
        if (L.highs) verdict.push('You gave ' + L.highs + ' question' + (L.highs > 1 ? 's' : '') + ' a 4 or 5. Write the proof for each in the proof field. No proof, no score above 2.');
        var rows = [['Leader', esc(L.name) + ' · ' + L.t + '/30'], ['Question 1 (proof)', L.p + '/5'], ['Weakest question', esc(c[L.li]) + ' (' + L.low + ')']];
        var summary = full.map(function (x) { return x.name + ': ' + x.t + '/30, question 1 ' + x.p + ', weakest ' + c[x.li] + ' ' + x.low + ', red flags ' + (x.ones.length ? x.ones.join(', ') : 'none'); })
          .concat(partialSummary).join('; ') + '. Leader: ' + L.name + ' by ' + by + '. Verdict: ' + verdict.join(' ') + (tieNote ? ' ' + tieNote : '');
        return { html: out(rows) + lines(verdict.concat(tieNote ? [tieNote] : []).map(esc)) + waiting, summary: summary };
      },
    },
    pricing: {
      render: function () {
        return '<div class="calc-grid">' +
          inp('value', 'What it’s worth to the customer, per month ($)', 'e.g. 630') +
          inp('alt', 'What they spend today on alternatives, per month ($)', 'e.g. 120') +
          inp('low', 'Lowest competitor price ($)', 'e.g. 150') +
          inp('high', 'Highest competitor price ($)', 'e.g. 1000') +
          inp('price', 'Your price ($)', 'e.g. 250') +
          sel('model', 'Charged', ['monthly', 'one-time']) +
          inp('months', 'One-time only: months the result keeps paying off', 'e.g. 12') +
          inp('cost', 'Your cost to deliver, per sale or per customer per month ($)', 'e.g. 10') +
          inp('hours', 'Your hours per sale or per customer per month', 'e.g. 8') +
          inp('goal', 'Monthly goal to clear after costs ($)', 'e.g. 1000') +
          inpList('vw_too_expensive', 'Buyers’ too-expensive prices', 'e.g. 600, 500, 700') +
          inpList('vw_expensive', 'Buyers’ getting-expensive prices', 'e.g. 600, 500, 700') +
          inpList('vw_bargain', 'Buyers’ bargain prices', 'e.g. 600, 500, 700') +
          inpList('vw_too_cheap', 'Buyers’ too-cheap prices', 'e.g. 600, 500, 700') +
          '</div><div class="calc-res"></div>';
      },
      compute: function () {
        var v = num('value'), a = num('alt'), lo = num('low'), hi = num('high'), p = num('price'), monthly = val('model') !== 'one-time';
        if (!p) return prompt('Add your price to see the ROI story.');
        // Blank months means 12, which reproduces the original one-time math.
        var m = monthly ? 1 : (num('months') || 12);
        var roi = monthly ? v / p : (v * m) / p, perDay = monthly ? p / 30 : p / (m * 30.4);
        var largest = !v ? 'add their value' : monthly || m === 12 ? money(v * (monthly ? 12 : m)) + ' a year in value' : money(v * m) + ' in value over ' + m + ' months';
        var pos = lo && hi ? (p < lo ? 'below every competitor' : p > hi ? 'above every competitor' : 'inside the competitor range') : 'unknown vs competitors';
        var rows = [['ROI for the customer', roi ? round1(roi) + 'x' + (!monthly && m !== 12 ? ' over ' + m + ' months' : '') : 'add their value'], ['Smallest-number framing', money(perDay) + ' a day'], ['Largest-number framing', largest], ['Position', pos]];
        if (a) rows.push(['vs what they spend today', monthly ? (p < a ? money(a - p) + '/mo cheaper' : money(p - a) + '/mo more') : money(a * 12) + '/yr on alternatives']);
        // The founder's side of the deal.
        var costEntered = !blank('cost'), gp = p - num('cost'), gm = gp / p;
        if (costEntered) rows.push([monthly ? 'What each customer leaves you, per month' : 'What each sale earns you', money(gp) + ' (' + Math.round(gm * 100) + '% margin)']);
        if (num('hours') > 0) rows.push(['Your real hourly rate', money(gp / num('hours')) + ' an hour after costs']);
        if (num('goal') > 0 && gp > 0) rows.push([(monthly ? 'Customers needed for ' : 'Sales needed per month for ') + money(num('goal')) + (monthly ? ' a month' : ''), String(Math.ceil(num('goal') / gp))]);
        // Buyer read: a small-sample Van Westendorp, medians of each list, from 3 buyers up.
        var vw = { tE: list('vw_too_expensive'), e: list('vw_expensive'), b: list('vw_bargain'), tC: list('vw_too_cheap') };
        var n = Math.min(vw.tE.length, vw.e.length, vw.b.length, vw.tC.length), buyer = null;
        if (n >= 3) {
          buyer = { tE: median(vw.tE), e: median(vw.e), b: median(vw.b), tC: median(vw.tC) };
          var where = p > buyer.tE ? 'above most buyers’ too-expensive price' : p > buyer.e ? 'on the expensive side, needs proof' : p >= buyer.b ? 'inside the comfort zone' : p >= buyer.tC ? 'on the cheap side' : 'below most buyers’ too-cheap price';
          rows.push(['Buyer comfort zone (' + n + ' buyers)', money(buyer.b) + ' to ' + money(buyer.e)], ['Your price vs buyers', where]);
        }
        var verdict = [];
        if (costEntered && gp <= 0) verdict.push('You lose money on every sale. Fix the price or the cost before anything else.');
        if (roi >= 10) verdict.push('Probably under-priced: the buyer gets 10x or more. Test a higher price on your next 5 buyers.');
        else if (roi >= 3) verdict.push('Healthy. Easy to defend with the ROI story.');
        else if (roi > 0) verdict.push('Thin. Prove more value, change the model (try a base fee plus bonus), or lower the price.');
        if (buyer) {
          if (p > buyer.tE) verdict.push('Most buyers you asked called this too expensive. Add proof or lead with a smaller option.');
          else if (p < buyer.tC) verdict.push('This is below what most buyers called too cheap. A price this low can make buyers doubt the quality.');
          if (!(buyer.tC <= buyer.b && buyer.b <= buyer.e && buyer.e <= buyer.tE)) verdict.push('Buyer answers look out of order. Check each list is in the right box.');
        }
        verdict.push('Test it on 5 real buyers before you change it.');
        if (gp > 0) verdict.push('Paying for ads? Your break-even cost per sale is ' + money(gp) + (monthly ? ' per first month' : '') + '. Use it in the Launch Budget Calculator.');
        return { html: out(rows) + lines(verdict), summary: plain(rows) + '. ' + verdict.join(' ') };
      },
    },
    budget: {
      platforms: ['Meta (Facebook/Instagram)', 'TikTok', 'Google', 'Other'],
      render: function () {
        return '<div class="calc-grid">' +
          inp('budget', 'Total test budget ($)', 'e.g. 80') +
          inp('cpc', 'Expected cost per click ($)', 'e.g. 1.00') +
          inp('conv', 'Page conversion rate (%)', 'e.g. 2') +
          inp('price', 'Price of what you sell ($)', 'e.g. 72') +
          inp('cost', 'Your cost to deliver one order ($)', 'e.g. 30') +
          inp('days', 'Test length (days)', 'e.g. 7') +
          sel('platform', 'Platform', this.platforms) +
          '</div><div class="eyebrow" style="margin:10px 0 4px">Optional</div><div class="calc-grid">' +
          inp('repeat', 'Purchases per customer in the first 30 days', 'e.g. 1') +
          inp('cpm', 'Cost per 1,000 impressions ($)', 'e.g. 15') +
          inp('ctr', 'Click-through rate (%)', 'e.g. 1.2') +
          '</div><div class="calc-res"></div>';
      },
      compute: function () {
        var b = num('budget'), p = num('price'), cpm = num('cpm'), ctr = num('ctr');
        // CPC = (CPM / 1000) / (CTR / 100), for members who only know their CPM and CTR.
        var c = num('cpc') || (cpm && ctr ? cpm / (10 * ctr) : 0);
        if (!b || !c) return prompt('Add a budget and a cost per click, or a CPM and click-through rate.');
        var platform = val('platform') || this.platforms[0], meta = platform.indexOf('Meta') === 0, tiktok = platform === 'TikTok';
        var visitors = b / c, impressions = cpm ? b / cpm * 1000 : (ctr ? visitors / (ctr / 100) : null);
        var cv = num('conv') / 100, sales = visitors * cv, cps = sales ? b / sales : 0;
        var r = num('repeat') || 1, be = (p - num('cost')) * r;
        var d = num('days') || 7, daily = b / d, perWeek = sales * 7 / d;
        var rev = sales * p * r, net = sales * be - b;
        var zero = Math.pow(1 - cv, visitors);
        var rows = [['Daily budget', money(daily) + ' a day for ' + d + ' day' + (d === 1 ? '' : 's')]];
        if (impressions) rows.push(['Impressions', Math.round(impressions).toLocaleString()]);
        rows.push(['Expected visitors', Math.round(visitors).toLocaleString()], ['Expected sales', round1(sales)], ['Cost per sale', cps ? money(cps) : '–']);
        if (p) rows.push(['Break-even cost per sale', money(be)], ['Revenue back', money(rev)], ['Left after ads and costs', money(net)]);
        if (cv > 0) rows.push(['Chance of zero sales, even if your guesses are right', Math.round(zero * 100) + '%'], ['Learning-phase check', round1(perWeek) + ' sales a week' + (meta ? ' vs about 50 a week Meta asks for' : '')]);
        var rules = [];
        if (!p) rules.push('Add your price to see your break-even and pause point.');
        else if (be <= 0) rules.push('You lose money on every sale before ads. Fix the price or the cost first (Pricing Worksheet).');
        else if (2 * be < b) rules.push('Pause rule: pause any ad that spends ' + money(2 * be) + ' (2x break-even) with zero sales.');
        else rules.push('Pause rule: your cap is under 2x break-even, so the whole ' + money(b) + ' is your pause point. Judge this test on cost per click and page actions, not profit.');
        rules.push('Stop rule: if the whole ' + money(b) + ' is spent and each sale costs more than ' + (p && be > 0 ? money(be) : 'it earns you') + ', stop the test.');
        var verdict = [];
        if (p && be > 0 && cps) {
          if (cps <= 0.5 * be) verdict.push('Profitable on paper with room for error. Run it small, confirm on a second test, then double down.');
          else if (cps <= be) verdict.push('Near break-even. Fine for learning, not for scaling.');
          else verdict.push('You’d lose ' + money(cps - be) + ' per sale. Fix the page, the offer or your order value first, or grow organically.');
        }
        if (meta && cv > 0 && perWeek < 50) verdict.push('Below Meta’s long-standing guidance of about 50 results a week per ad set, so expect "learning limited". That’s normal for a small test.');
        if (tiktok && daily <= 20) verdict.push('TikTok Ads Manager needs more than $20 a day per ad group (more than $50 per campaign budget). Shorten the test or raise the daily budget.');
        if (meta) verdict.push('Check the minimum daily budget Ads Manager shows for your goal.');
        if (cv > 0 && zero > 0.25) verdict.push('There’s a real chance of zero sales from luck alone. Compare ads on click-through and cost per click first.');
        return { html: out(rows) + lines(rules, 'color:var(--accent-ink)') + lines(verdict), summary: plain(rows) + '. ' + rules.concat(verdict).join(' ') };
      },
    },
    kpi: {
      groups: [
        ['Inputs you control', [['posts', 'Posts published'], ['outreach', 'Outreach sent (DMs, emails, calls)']]],
        ['Results', [['reach', 'Views / reach'], ['visits', 'Profile or site visits'], ['leads', 'Leads (all, including outreach replies)'], ['replies', '…of which replies to your outreach'], ['sales', 'Sales'], ['revenue', 'Revenue ($)']]],
      ],
      // Starting floors and sample-size minimums are 127 rules of thumb, not public benchmarks.
      steps: {
        r1: { label: 'Reach → visits', floor: 0.01, close: 1, hint: 'People see you but don’t look closer. Test new hooks and fix your bio and pinned posts. See the Hook & Caption Bank.' },
        r2: { label: 'Visits → leads', floor: 0.03, close: 3, hint: 'People look but don’t raise a hand. Make the offer and the next step obvious. See The One-Page Offer.' },
        r6: { label: 'Reply rate', floor: 0.10, close: 2, hint: 'Outreach isn’t getting replies. Make messages shorter and more personal, and send them to warmer people. See Outreach Scripts.' },
        r3: { label: 'Leads → sales', floor: 0.10, close: 4, hint: 'Conversations aren’t closing. That’s usually trust, price framing or offer clarity, not traffic. See Outreach Scripts.' },
      },
      render: function () {
        var h = '<div class="scroll-x"><table class="t kpi"><thead><tr><th></th><th>Last week</th><th>This week</th><th>Change</th></tr></thead><tbody>';
        this.groups.forEach(function (g) {
          h += '<tr class="grp"><td colspan="4" class="eyebrow">' + g[0] + '</td></tr>';
          g[1].forEach(function (f) {
            h += '<tr><td>' + f[1] + '</td><td><input class="input" inputmode="decimal" data-k="l_' + f[0] + '" value="' + esc(saved['l_' + f[0]] || '') + '"></td><td><input class="input" inputmode="decimal" data-k="t_' + f[0] + '" value="' + esc(saved['t_' + f[0]] || '') + '"></td><td class="mono" data-ch="' + f[0] + '">–</td></tr>';
          });
        });
        return h + '</tbody></table></div>' +
          '<div class="eyebrow" style="margin:12px 0 4px">Weekly targets</div><div class="calc-grid">' +
          inp('g_posts', 'Posts per week', 'e.g. 4') + inp('g_outreach', 'Outreach per week', 'e.g. 20') +
          '</div><button type="button" class="btn ghost sm" data-newweek>Start a new week</button>' +
          '<div class="calc-res"></div>';
      },
      // Counts and rates for one week ('l_' or 't_'). Negatives count as 0.
      week: function (w) {
        var g = function (k) { return Math.max(0, num(w + k)); };
        var x = { posts: g('posts'), outreach: g('outreach'), reach: g('reach'), visits: g('visits'), leads: g('leads'), replies: g('replies'), sales: g('sales'), revenue: g('revenue') };
        x.inbound = blank(w + 'replies') ? x.leads : Math.max(x.leads - x.replies, 0);
        var q = function (a, b, ok) { return b > 0 ? { v: a / b, ok: ok } : null; };
        x.r1 = q(x.visits, x.reach, x.reach >= 500);
        x.r2 = q(x.inbound, x.visits, x.visits >= 100);
        x.r3 = q(x.sales, x.leads, x.leads >= 10);
        x.r4 = q(x.revenue, x.sales, true);
        x.r5 = q(x.revenue, x.leads, x.leads >= 10);
        x.r6 = x.outreach > 0 && x.replies > 0 ? q(x.replies, x.outreach, x.outreach >= 20) : null;
        x.r7 = q(x.reach, x.posts, true);
        // Selling straight from a store (sales but no leads): visits to sales replaces visits to leads.
        x.r8 = !x.leads && x.sales > 0 ? q(x.sales, x.visits, x.visits >= 100) : null;
        if (x.r8) x.r2 = null;
        return x;
      },
      compute: function () {
        var self = this, T = this.week('t_'), L = this.week('l_');
        this.groups.forEach(function (g) {
          g[1].forEach(function (f) {
            var l = num('l_' + f[0]), t = num('t_' + f[0]), td = root.querySelector('[data-ch="' + f[0] + '"]');
            td.textContent = l > 0 ? ((t - l) / l * 100 >= 0 ? '+' : '') + Math.round((t - l) / l * 100) + '%' : t > 0 ? 'new' : '–';
            td.className = 'mono ' + (l > 0 && t > l ? 'up' : l > 0 && t < l ? 'down' : '');
          });
        });
        var keys = ['posts', 'outreach', 'reach', 'visits', 'leads', 'replies', 'sales', 'revenue'];
        if (!keys.some(function (k) { return num('t_' + k) > 0; })) return prompt('Fill in this week to see your conversion rates.');
        var hasLast = keys.some(function (k) { return num('l_' + k) > 0; });
        var pts = function (k) { return L[k] ? ' (' + ((T[k].v - L[k].v) >= 0 ? '+' : '') + ((T[k].v - L[k].v) * 100).toFixed(1) + ' pts)' : ''; };
        var chg = function (k) { return L[k] && L[k].v ? ' (' + (T[k].v >= L[k].v ? '+' : '') + Math.round((T[k].v - L[k].v) / L[k].v * 100) + '%)' : ''; };
        var few = ' (too few to judge)';
        var rateRow = function (k, label) { var t = T[k]; return t ? [label, (t.v * 100).toFixed(1) + '%' + pts(k) + (t.ok ? '' : few), !t.ok] : null; };
        var rows = [
          rateRow('r1', 'Reach → visits'), rateRow('r2', 'Visits → leads'), rateRow('r8', 'Visits → sales'), rateRow('r3', 'Leads → sales'),
          T.r4 ? ['Average sale', money(T.r4.v) + chg('r4')] : null,
          T.r5 ? ['Revenue per lead', money(T.r5.v) + chg('r5') + (T.r5.ok ? '' : few), !T.r5.ok] : null,
          rateRow('r6', 'Reply rate'),
          T.r7 ? ['Reach per post', Math.round(T.r7.v).toLocaleString() + chg('r7')] : null,
        ].filter(Boolean);
        var notes = [];
        if (T.r3 && T.r3.v > 1) notes.push('More sales than leads: count every buyer as a lead so the chain stays honest.');
        if (!blank('t_replies') && T.replies > T.leads) notes.push('Replies are part of leads. Check your counts.');
        // Weakest step: a big drop from last week first, else the step furthest below its starting floor.
        var weakest = null, reason = '', floorNote = false;
        var judged = Object.keys(this.steps).filter(function (k) { return T[k] && T[k].ok; });
        var drops = judged.filter(function (k) { return L[k] && L[k].ok && L[k].v > 0; })
          .map(function (k) { return { k: k, d: (T[k].v - L[k].v) / L[k].v }; })
          .filter(function (x) { return x.d <= -0.2; })
          .sort(function (a, b) { return a.d - b.d; });
        if (drops.length) {
          weakest = drops[0].k;
          reason = 'dropped ' + Math.round(-drops[0].d * 100) + '% from last week';
        } else {
          var below = judged.map(function (k) { return { k: k, ratio: T[k].v / self.steps[k].floor }; })
            .filter(function (x) { return x.ratio < 1; })
            .sort(function (a, b) { return a.ratio - b.ratio; });
          if (below.length) {
            // Within 0.1 of the lowest, fix the step closest to the sale first.
            var pick = below.filter(function (x) { return x.ratio - below[0].ratio <= 0.1; })
              .sort(function (a, b) { return self.steps[b.k].close - self.steps[a.k].close; })[0];
            weakest = pick.k;
            reason = 'below the starting floor of ' + pct(self.steps[pick.k].floor * 100);
            floorNote = true;
          }
        }
        var weakLine = weakest ? 'Weakest step: ' + this.steps[weakest].label + ', ' + reason + '. ' + this.steps[weakest].hint : 'No clear leak this week. Keep inputs on target and run one test.';
        var extra = [];
        if (floorNote) extra.push('Starting floors are rough. After 4 weeks, beat your own average instead.');
        if (T.r4 && L.r4 && L.r4.v > 0 && (T.r4.v - L.r4.v) / L.r4.v <= -0.2) extra.push('Each sale is worth less than last week. Check discounts and add-ons. See the Pricing Worksheet.');
        // Input vs result: check the lead measures before changing the strategy.
        var verdict = '';
        if (hasLast) {
          var gP = num('g_posts'), gO = num('g_outreach');
          var inputsDown = gP > 0 || gO > 0 ? (gP > 0 && T.posts < gP) || (gO > 0 && T.outreach < gO) : (T.posts + T.outreach) < 0.8 * (L.posts + L.outreach);
          var resultsDown = T.leads < 0.8 * L.leads || T.sales < L.sales;
          var resultsUp = T.leads > 1.2 * L.leads || T.sales > L.sales;
          verdict = inputsDown && resultsDown ? 'You did less this week. Get back to your input targets before you change the strategy.'
            : !inputsDown && resultsDown ? 'Inputs held and results fell. Change one thing in the message, hook or offer, not the volume.'
            : !inputsDown && resultsUp ? 'Inputs on target and results up. Double down: same format, same channel, same message.'
            : inputsDown && resultsUp ? 'Results rose on less effort. Find the post, message or referral that did it and write down why.'
            : 'Steady week. Keep inputs on target and test one change on your weakest step.';
        }
        var html = (rows.length ? out(rows) : '<p class="small muted" style="margin:0">Add reach, visits, leads and sales to see your conversion rates.</p>') +
          lines(notes, 'color:var(--accent-ink)') + lines([weakLine].concat(extra, verdict ? [verdict] : []));
        var target = function (k, g) { return T[k] + (num(g) > 0 ? '/' + num(g) : ''); };
        var counts = 'This week: posts ' + target('posts', 'g_posts') + ', outreach ' + target('outreach', 'g_outreach') + ', reach ' + T.reach + ', visits ' + T.visits + ', leads ' + T.leads + (blank('t_replies') ? '' : ' (replies ' + T.replies + ')') + ', sales ' + T.sales + ', revenue ' + money(T.revenue) + '.';
        var summary = counts + (rows.length ? ' ' + plain(rows) + '.' : '') + ' ' + (weakest ? 'Weakest step: ' + this.steps[weakest].label + ', ' + reason + '.' : 'No clear leak.') + (verdict ? ' ' + verdict : '') + (notes.length ? ' ' + notes.join(' ') : '');
        return { html: html, summary: summary };
      },
    },
  };

  var c = calcs[root.getAttribute('data-calc')];
  if (!c) return;
  root.innerHTML = c.render();
  function update() {
    var res = c.compute();
    root.querySelector('.calc-res').innerHTML = res.html;
    var inputs = {};
    root.querySelectorAll('[data-k]').forEach(function (el) { if (el.value) inputs[el.getAttribute('data-k')] = el.value; });
    hidden.value = JSON.stringify({ inputs: inputs, summary: res.summary });
  }
  root.addEventListener('input', update);
  root.addEventListener('change', update);
  // KPI dashboard: move this week into last week so members type one column each Monday.
  root.addEventListener('click', function (e) {
    if (!e.target.closest('[data-newweek]')) return;
    root.querySelectorAll('[data-k^="t_"]').forEach(function (el) {
      var last = root.querySelector('[data-k="l_' + el.getAttribute('data-k').slice(2) + '"]');
      if (last) last.value = el.value;
      el.value = '';
    });
    update();
  });
  update();
})();
