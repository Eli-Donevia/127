// Renders the Day One Stack guide from window.STACK.
(function () {
  var D = window.STACK, K = window.K127, esc = K.esc;
  var ON_SITE = K.onSite;
  var printMode = /[?&]print=1/.test(location.search);
  var promptNo = 0;
  var allTools = [];
  D.layers.forEach(function (l) { l.tools.forEach(function (t) { allTools.push(t.name); }); });

  function toolCard(t) {
    return '<article class="card tool" id="tool-' + t.name.toLowerCase() + '">' +
      '<div class="tool-head"><div class="tool-logo" aria-hidden="true">' + esc(t.mono) + '</div>' +
        '<div><h3 class="h3">' + esc(t.name) + '</h3><div class="small fog">' + esc(t.job) + '</div></div></div>' +
      '<p class="small" style="margin:0;color:var(--c-ink)">' + esc(t.eli) + '</p>' +
      '<div><div class="label" style="margin-bottom:10px">Set it up</div><ol class="steps">' + t.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div>' +
      '<dl class="kv"><dt>Cost</dt><dd>' + esc(t.cost) + '</dd>' + (t.skip ? '<dt>Wait if</dt><dd>' + esc(t.skip) + '</dd>' : '') + '</dl>' +
      '<div class="small" style="border-top:1px solid var(--c-line);padding-top:12px;color:var(--c-lilac)">' + esc(t.rule) + '</div>' +
    '</article>';
  }

  function promptCard(p) {
    promptNo++;
    return '<article class="card prompt" id="p' + promptNo + '">' +
      '<span class="layer-num">' + String(promptNo).padStart(2, '0') + '</span>' +
      '<h4>' + esc(p.t) + '</h4><div class="when">' + esc(p.when) + '</div>' +
      '<button class="btn pill copy" data-n="' + promptNo + '">Copy</button>' +
      '<pre>' + esc(p.p) + '</pre></article>';
  }

  var h = '';
  // cover
  h += '<section class="narrow hero print-pad">' +
    '<span class="label">The Day One Stack</span>' +
    '<h1 class="h-display steel" style="margin:16px 0 18px">Make today day one.</h1>' +
    '<p class="lede">The tools I use to build, the order to set them up, and 30 prompts you can copy and paste today.</p>' +
    '<div class="row" style="margin-top:22px;gap:8px"><span class="chip">' + allTools.length + ' tools</span><span class="chip">6 layers</span><span class="chip">30 prompts</span><span class="chip signal">$0 to start</span></div>' +
  '</section>';

  // intro letter
  h += '<section class="narrow" style="padding-top:18px"><div class="card stack-m">' +
    D.intro.map(function (p, i) { return '<p style="margin-bottom:0' + (i === 0 ? ';font-size:19px;letter-spacing:-.02em;color:var(--c-ink)' : ';color:var(--c-fog)') + '">' + esc(p) + '</p>'; }).join('') +
    '<div class="small slate">Eli Christiansen, founder of 127</div></div></section>';

  // contents
  h += '<section class="narrow no-print" style="padding-top:22px"><div class="label" style="margin-bottom:12px">Contents</div><div class="toc">' +
    D.layers.map(function (l) { return '<a class="btn pill" href="#layer-' + l.n + '">' + l.n + ' ' + esc(l.name) + '</a>'; }).join('') +
    '<a class="btn pill" href="#layer-06">06 Systems</a><a class="btn pill" href="#prompts">30 prompts</a></div></section>';

  // day zero
  h += '<section class="narrow" style="padding-top:22px"><div class="card accent"><div class="label lilac">Start here</div>' +
    '<h2 class="h3" style="margin:10px 0 6px">' + esc(D.dayZero.title) + '</h2><p class="fog small" style="margin:0 0 14px">' + esc(D.dayZero.body) + '</p>' +
    '<div class="row" style="gap:8px">' + D.dayZero.tools.map(function (t) { return '<a class="chip lilac" style="text-decoration:none" href="#tool-' + t.toLowerCase() + '">' + esc(t) + '</a>'; }).join('') + '</div></div></section>';

  // layers
  D.layers.forEach(function (l) {
    h += '<section class="narrow section layer print-pad" id="layer-' + l.n + '">' +
      '<div class="row" style="justify-content:space-between;align-items:baseline"><span class="label">Layer ' + l.n + '</span><span class="chip">' + esc(l.when) + '</span></div>' +
      '<h2 class="h1 steel" style="margin:14px 0 10px">' + esc(l.name) + '</h2>' +
      '<p class="lede" style="margin-bottom:22px">' + esc(l.why) + '</p>' +
      '<div class="stack-m">' + l.tools.map(toolCard).join('') + '</div></section>';
  });

  // systems
  var S = D.systems;
  h += '<section class="narrow section layer print-pad" id="layer-06">' +
    '<div class="row" style="justify-content:space-between;align-items:baseline"><span class="label">Layer 06</span><span class="chip">' + esc(S.when) + '</span></div>' +
    '<h2 class="h1 steel" style="margin:14px 0 10px">' + esc(S.name) + '</h2>' +
    '<p class="lede" style="margin-bottom:22px">' + esc(S.why) + '</p>' +
    '<div class="stack-s">' + S.flows.map(function (f) {
      return '<div class="card flow">' + f.map(function (s, i) { return '<div class="step"><span class="mono slate" style="flex:0 0 22px">' + (i === 0 ? 'IF' : '→') + '</span><span' + (i === 0 ? ' style="color:var(--c-ink);font-weight:500"' : '') + '>' + esc(s) + '</span></div>'; }).join('') + '</div>';
    }).join('') + '</div>' +
    '<p class="small fog" style="margin-top:16px">' + esc(S.note) + '</p></section>';

  // prompts
  h += '<section class="narrow section layer print-pad" id="prompts">' +
    '<span class="label">The prompts</span>' +
    '<h2 class="h1 steel" style="margin:14px 0 10px">30 prompts. Copy, fill the brackets, run.</h2>' +
    '<p class="lede" style="margin-bottom:8px">Use them in a Claude Project that knows your business. Research prompts work best in Perplexity. Replace every [bracket] with something real.</p>';
  D.prompts.forEach(function (g) {
    h += '<h3 class="label" style="margin:34px 0 12px">' + esc(g.group) + '</h3><div class="stack-s">' + g.items.map(promptCard).join('') + '</div>';
  });
  h += '</section>';

  // founding list (pre-launch only; empty otherwise)
  var founding = K.foundingCard('day-one-stack');
  if (founding) h += '<section class="narrow no-print" style="padding-top:22px">' + founding + '</section>';

  // next
  h += '<section class="narrow section no-print"><div class="card halo">' +
    '<div class="label">What to do next</div>' +
    '<h2 class="h2 steel" style="margin:12px 0 8px">Tools don\'t build businesses. Plans do.</h2>' +
    '<p class="fog" style="margin:0 0 18px">Take the 90-second Founder Score. You\'ll get your archetype, the one move that matters this week and a 30-day roadmap that tells you which of these tools you need now and which can wait.</p>' +
    '<a class="btn block" href="' + K.href('/score') + '\">Get my Founder Score <span class="arrow"></span></a>' +
    '<div class="row" style="justify-content:center;margin-top:14px"><a class="link" href="' + K.href('/idea-test') + '\">Or test an idea free</a></div>' +
  '</div></section>';

  document.getElementById('guide').innerHTML = h;
  if (printMode) document.documentElement.classList.add('print');

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.copy');
    if (!b) return;
    var pre = b.parentNode.querySelector('pre');
    K.copy(pre.textContent);
    K.track('Prompt Copy', { n: b.getAttribute('data-n') });
  });
})();
