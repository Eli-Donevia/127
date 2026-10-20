// Job price calculator: a base service, extra labor, materials with a markup, travel, add-ons,
// a minimum charge and tax. Pure math first (tests run it), then the page.
/* eslint-disable no-var */
function jobPrice(o) {
  var crew = Math.max(1, Math.round(num(o.crew, 1)));
  var labor = round2(num(o.hours) * crew * num(o.rate));
  var materials = round2(num(o.materials) * (1 + num(o.markup) / 100));
  var addons = round2((o.addons || []).reduce(function (s, x) { return s + num(x); }, 0));
  var base = round2(num(o.base));
  var travel = round2(num(o.travel));
  var sub = round2(base + labor + materials + travel + addons);
  var minUp = num(o.min) > sub ? round2(num(o.min) - sub) : 0;
  var before = round2(sub + minUp);
  var tax = round2(before * num(o.tax) / 100);
  return { base: base, labor: labor, materials: materials, travel: travel, addons: addons, sub: sub, minUp: minUp, tax: tax, total: round2(before + tax) };
}

function jobQuoteText(r, o, cfg) {
  var lines = [(cfg.business || 'Quote') + ': price for ' + (o.label || 'your job')];
  if (r.base) lines.push((o.serviceName || 'Service') + ': ' + money(r.base));
  if (r.labor) lines.push('Labor (' + num(o.hours) + ' h x ' + Math.max(1, Math.round(num(o.crew, 1))) + '): ' + money(r.labor));
  if (r.materials) lines.push('Materials: ' + money(r.materials));
  if (r.travel) lines.push('Travel: ' + money(r.travel));
  (o.addonNames || []).forEach(function (n, i) { lines.push(n + ': ' + money((o.addons || [])[i])); });
  if (r.minUp) lines.push('Minimum charge adjustment: ' + money(r.minUp));
  if (r.tax) lines.push('Tax: ' + money(r.tax));
  lines.push('Total: ' + money(r.total));
  if (cfg.validDays) lines.push('This price is good for ' + cfg.validDays + ' days.');
  return lines.join('\n');
}

if (typeof document !== 'undefined') {
  (function () {
    var f = $('#calc');
    var saved = store.get('last', null);
    if (saved) {
      Object.keys(saved).forEach(function (k) {
        var el = f.elements[k];
        if (el && el.type !== 'checkbox' && el.tagName) el.value = saved[k];
      });
      $$('.addon').forEach(function (a) { a.checked = (saved.addonIdx || []).indexOf(a.value) >= 0; });
    }
    function read() {
      var sel = f.elements.service;
      var opt = sel && sel.options[sel.selectedIndex];
      var picked = $$('.addon').filter(function (a) { return a.checked; });
      return {
        base: opt ? num(opt.getAttribute('data-price')) : 0,
        serviceName: opt && num(opt.getAttribute('data-price')) ? opt.textContent.replace(/\s*\(.*\)\s*$/, '') : '',
        label: f.elements.label.value,
        hours: f.elements.hours.value,
        crew: f.elements.crew.value,
        rate: f.elements.rate.value,
        materials: f.elements.materials.value,
        markup: f.elements.markup.value,
        travel: f.elements.travel.value,
        min: f.elements.min.value,
        tax: f.elements.tax.value,
        addons: picked.map(function (a) { return num(a.getAttribute('data-price')); }),
        addonNames: picked.map(function (a) { return a.getAttribute('data-name'); }),
      };
    }
    function render() {
      var o = read();
      var r = jobPrice(o);
      $('#total').textContent = money(r.total);
      var rows = [['Service', r.base], ['Labor', r.labor], ['Materials with markup', r.materials], ['Travel', r.travel], ['Add-ons', r.addons], ['Minimum charge adjustment', r.minUp], ['Tax', r.tax]];
      $('#lines').innerHTML = rows.filter(function (x) { return x[1]; }).map(function (x) { return '<div class="line"><span>' + esc(x[0]) + '</span><span>' + money(x[1]) + '</span></div>'; }).join('') || '<p class="muted small">Pick a service or add hours to see a price.</p>';
      var keep = {};
      ['service', 'label', 'hours', 'crew', 'rate', 'materials', 'markup', 'travel', 'min', 'tax'].forEach(function (k) { keep[k] = f.elements[k].value; });
      keep.addonIdx = $$('.addon').filter(function (a) { return a.checked; }).map(function (a) { return a.value; });
      store.set('last', keep);
      return { o: o, r: r };
    }
    f.addEventListener('input', render);
    f.addEventListener('change', render);
    f.addEventListener('submit', function (e) { e.preventDefault(); });
    $('#copy').addEventListener('click', function () { var x = render(); copyText(jobQuoteText(x.r, x.o, C)); });
    $('#print').addEventListener('click', function () { window.print(); });
    $('#reset').addEventListener('click', function () { store.set('last', null); f.reset(); render(); });
    render();
  })();
}
