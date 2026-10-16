// Library worksheets: interactive calculators + copy buttons.
// Each calculator renders into <div data-calc="key"> and mirrors its inputs and
// results into the form's hidden __calc field, so they save with the worksheet
// and can be sent to Eli's Playbook for feedback.
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
  function money(n) { return '$' + (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 2 : 0 }); }
  function pct(n) { return (Math.round(n * 10) / 10) + '%'; }
  function inp(k, label, ph, cls) { return '<label class="field ' + (cls || '') + '"><span>' + label + '</span><input class="input" inputmode="decimal" data-k="' + k + '" placeholder="' + esc(ph || '') + '" value="' + esc(saved[k] || '') + '"></label>'; }
  // Under every money result (legal/05-earnings-disclaimer.md Part B, calculators and worksheets).
  var ESTIMATE = '<p class="small muted calc-estimate" style="margin:8px 0 0">An estimate from the numbers you entered. Not a forecast or a promise.</p>';
  function out(rows) { return rows.map(function (r) { return '<div class="calc-out"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join(''); }

  var calcs = {
    'idea-score': {
      criteria: ['People pay to solve it (proof)', 'Economics and channels work', 'Clear differentiator', 'Market growing, AI-proof', 'Insider access', "I'll care in 2 years"],
      render: function () {
        var c = this.criteria, h = '<div class="scroll-x"><table class="t idea-grid"><thead><tr><th>Idea</th>';
        c.forEach(function (x, i) { h += '<th title="' + esc(x) + '">' + (i + 1) + '</th>'; });
        h += '<th>Sum</th></tr></thead><tbody>';
        for (var r = 0; r < 5; r++) {
          h += '<tr><td><input class="input" data-k="idea' + r + '" placeholder="Idea ' + (r + 1) + '" value="' + esc(saved['idea' + r] || '') + '"></td>';
          for (var i = 0; i < c.length; i++) {
            var k = 's' + r + '_' + i, sv = saved[k] || '';
            h += '<td><select class="input sc" data-k="' + k + '"><option value=""></option>' + [1, 2, 3, 4, 5].map(function (n) { return '<option' + (String(n) === String(sv) ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></td>';
          }
          h += '<td class="mono tot" data-tot="' + r + '">0</td></tr>';
        }
        h += '</tbody></table></div><ol class="calc-legend">' + c.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol><div class="calc-res"></div>';
        return h;
      },
      compute: function () {
        var best = -1, bestName = '', rows = [];
        for (var r = 0; r < 5; r++) {
          var name = val('idea' + r).trim(), t = 0, n = 0;
          for (var i = 0; i < 6; i++) { var s = num('s' + r + '_' + i); if (s) { t += s; n++; } }
          root.querySelector('[data-tot="' + r + '"]').textContent = t || '0';
          if (name && n) { rows.push(name + ': ' + t + '/30'); if (t > best) { best = t; bestName = name; } }
        }
        root.querySelectorAll('.tot').forEach(function (td) { td.classList.toggle('win', best > 0 && +td.textContent === best); });
        var msg = bestName ? out([['Leader', esc(bestName) + ' · ' + best + '/30']]) + '<p class="small muted" style="margin:8px 0 0">' + (best >= 22 ? 'Strong. Go get proof from real buyers this week.' : best >= 16 ? 'Promising, with gaps. Fix the lowest score before you build.' : 'Weak across the board. Keep looking, but not for long.') + ' Ties go to the shortest path to a first paying customer.</p>' : '<p class="small muted" style="margin:0">Name an idea and score it 1 to 5 on each question.</p>';
        return { html: msg, summary: rows.join('; ') };
      },
    },
    pricing: {
      render: function () {
        return '<div class="calc-grid">' +
          inp('value', 'What it’s worth to the customer, per month ($)', 'e.g. 400') +
          inp('alt', 'What they spend today on alternatives, per month ($)', 'e.g. 120') +
          inp('low', 'Lowest competitor price ($)', 'e.g. 49') +
          inp('high', 'Highest competitor price ($)', 'e.g. 199') +
          inp('price', 'Your price ($)', 'e.g. 79') +
          '<label class="field"><span>Charged</span><select class="input" data-k="model">' + ['monthly', 'one-time'].map(function (m) { return '<option' + (saved.model === m ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></label>' +
          '</div><div class="calc-res"></div>';
      },
      compute: function () {
        var v = num('value'), a = num('alt'), lo = num('low'), hi = num('high'), p = num('price'), monthly = val('model') !== 'one-time';
        if (!p) return { html: '<p class="small muted" style="margin:0">Add your price to see the ROI story.</p>', summary: '' };
        var yearValue = v * 12, roi = monthly ? (v / p) : (yearValue / p), perDay = monthly ? p / 30 : p / 365;
        var pos = lo && hi ? (p < lo ? 'below every competitor' : p > hi ? 'above every competitor' : 'inside the competitor range') : 'unknown vs competitors';
        var rows = [['ROI for the customer', roi ? (Math.round(roi * 10) / 10) + 'x' : 'add their value'], ['Smallest-number framing', money(perDay) + ' a day'], ['Largest-number framing', yearValue ? money(yearValue) + ' a year in value' : 'add their value'], ['Position', pos]];
        if (a) rows.push(['vs what they spend today', monthly ? (p < a ? money(a - p) + '/mo cheaper' : money(p - a) + '/mo more') : money(a * 12) + '/yr on alternatives']);
        var tip = roi >= 10 ? 'Under-priced. You can likely charge more.' : roi >= 3 ? 'Healthy. Easy to defend with the ROI story.' : roi > 0 ? 'Thin. Raise the value or lower the price.' : '';
        return { html: out(rows) + (tip ? '<p class="small muted" style="margin:8px 0 0">' + tip + ' Test it on five real buyers before you change it.</p>' : '') + ESTIMATE, summary: rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('; ') };
      },
    },
    budget: {
      render: function () {
        return '<div class="calc-grid">' +
          inp('budget', 'Total test budget ($)', 'e.g. 75') +
          inp('cpc', 'Expected cost per click ($)', 'e.g. 0.60') +
          inp('conv', 'Page conversion rate (%)', 'e.g. 2') +
          inp('price', 'Price of what you sell ($)', 'e.g. 39') +
          '</div><div class="calc-res"></div>';
      },
      compute: function () {
        var b = num('budget'), c = num('cpc'), cv = num('conv') / 100, p = num('price');
        if (!b || !c) return { html: '<p class="small muted" style="margin:0">Add a budget and cost per click.</p>', summary: '' };
        var visitors = b / c, sales = visitors * cv, cps = sales ? b / sales : 0, rev = sales * p;
        var rows = [['Expected visitors', Math.round(visitors).toLocaleString()], ['Expected sales', (Math.round(sales * 10) / 10).toString()], ['Cost per sale', cps ? money(cps) : '–'], ['Revenue back', money(rev)]];
        var stop = (p ? 'Pause rule: if you’ve spent ' + money(Math.min(2 * p, b)) + ' (the price of two sales) with zero sales, pause and fix one thing. ' : '') + 'Stop rule: if the whole ' + money(b) + ' is spent and each sale costs more than it earns you, stop the test.';
        var verdict = p && cps ? (cps < p * 0.5 ? 'Profitable on paper. Run it small, then double down on what works.' : cps < p ? 'Breakeven-ish. Fine for learning, not for scaling.' : 'You’d lose money per sale. Fix the page or offer first, or grow organically.') : '';
        return { html: out(rows) + '<p class="small" style="margin:10px 0 0;color:var(--accent-ink)">' + stop + '</p>' + (verdict ? '<p class="small muted" style="margin:6px 0 0">' + verdict + '</p>' : '') + ESTIMATE, summary: rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('; ') + '. ' + stop };
      },
    },
    kpi: {
      fields: [['reach', 'Views / reach'], ['visits', 'Profile or site visits'], ['leads', 'Leads / conversations'], ['sales', 'Sales'], ['revenue', 'Revenue ($)']],
      render: function () {
        var h = '<div class="scroll-x"><table class="t kpi"><thead><tr><th></th><th>Last week</th><th>This week</th><th>Change</th></tr></thead><tbody>';
        this.fields.forEach(function (f) {
          h += '<tr><td>' + f[1] + '</td><td><input class="input" inputmode="decimal" data-k="l_' + f[0] + '" value="' + esc(saved['l_' + f[0]] || '') + '"></td><td><input class="input" inputmode="decimal" data-k="t_' + f[0] + '" value="' + esc(saved['t_' + f[0]] || '') + '"></td><td class="mono" data-ch="' + f[0] + '">–</td></tr>';
        });
        return h + '</tbody></table></div><div class="calc-res"></div>';
      },
      compute: function () {
        var F = this.fields;
        F.forEach(function (f) {
          var l = num('l_' + f[0]), t = num('t_' + f[0]), td = root.querySelector('[data-ch="' + f[0] + '"]');
          td.textContent = l ? ((t - l) / l * 100 >= 0 ? '+' : '') + Math.round((t - l) / l * 100) + '%' : '–';
          td.className = 'mono ' + (l && t > l ? 'up' : l && t < l ? 'down' : '');
        });
        var r = num('t_reach'), v = num('t_visits'), le = num('t_leads'), s = num('t_sales'), rev = num('t_revenue');
        var steps = [['Reach → visits', r ? v / r * 100 : null], ['Visits → leads', v ? le / v * 100 : null], ['Leads → sales', le ? s / le * 100 : null]];
        var known = steps.filter(function (x) { return x[1] !== null; });
        if (!known.length) return { html: '<p class="small muted" style="margin:0">Fill in this week to see your conversion rates.</p>', summary: '' };
        var rows = known.map(function (x) { return [x[0], pct(x[1])]; });
        if (s) rows.push(['Average sale', money(rev / s)]);
        var weakest = known.slice().sort(function (a, b) { return a[1] - b[1]; })[0];
        var hint = { 'Reach → visits': 'Your hook and profile are the leak. Test new hooks before posting more.', 'Visits → leads': 'People look but don’t raise their hand. Make the offer and call to action clearer.', 'Leads → sales': 'Conversations aren’t closing. That’s usually trust or offer clarity, not traffic.' }[weakest[0]];
        return { html: out(rows) + '<p class="small muted" style="margin:8px 0 0">Weakest step: ' + weakest[0] + '. ' + hint + '</p>', summary: rows.map(function (x) { return x[0] + ': ' + x[1]; }).join('; ') };
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
  update();
})();
