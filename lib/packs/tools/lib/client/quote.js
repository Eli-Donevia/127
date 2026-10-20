// Quote builder from a price list: quantities, a discount, tax and a deposit. Quotes are saved in
// this browser so the member can reopen one. Pure math first (tests run it), then the page.
/* eslint-disable no-var */
function quoteTotals(lines, discountPct, taxPct, depositPct) {
  var rows = (lines || []).filter(function (l) { return num(l.qty) > 0; }).map(function (l) {
    return { name: l.name, unit: l.unit || '', price: num(l.price), qty: num(l.qty), amount: round2(num(l.price) * num(l.qty)) };
  });
  var subtotal = round2(rows.reduce(function (s, r) { return s + r.amount; }, 0));
  var discount = round2(subtotal * Math.min(100, Math.max(0, num(discountPct))) / 100);
  var taxable = round2(subtotal - discount);
  var tax = round2(taxable * num(taxPct) / 100);
  var total = round2(taxable + tax);
  var deposit = round2(total * Math.min(100, Math.max(0, num(depositPct))) / 100);
  return { rows: rows, subtotal: subtotal, discount: discount, taxable: taxable, tax: tax, total: total, deposit: deposit };
}

function quoteText(t, meta, cfg) {
  var out = [(cfg.business || 'Quote') + (meta.customer ? ' quote for ' + meta.customer : ' quote') + (meta.number ? ' (#' + meta.number + ')' : '')];
  t.rows.forEach(function (r) { out.push(r.qty + ' x ' + r.name + (r.unit ? ' (per ' + r.unit + ')' : '') + ': ' + money(r.amount)); });
  out.push('Subtotal: ' + money(t.subtotal));
  if (t.discount) out.push('Discount: -' + money(t.discount));
  if (t.tax) out.push('Tax: ' + money(t.tax));
  out.push('Total: ' + money(t.total));
  if (t.deposit) out.push('Deposit to book: ' + money(t.deposit));
  if (cfg.validDays) out.push('Good for ' + cfg.validDays + ' days.');
  if (cfg.terms) out.push(cfg.terms);
  return out.join('\n');
}

if (typeof document !== 'undefined') {
  (function () {
    var f = $('#quote');
    function lines() {
      return $$('.qline').map(function (row) {
        return { name: row.getAttribute('data-name'), unit: row.getAttribute('data-unit'), price: num(row.getAttribute('data-price')), qty: num($('input', row).value) };
      });
    }
    function meta() {
      return { customer: f.elements.customer.value.trim(), number: f.elements.number.value.trim() };
    }
    function render() {
      var t = quoteTotals(lines(), f.elements.discount.value, f.elements.tax.value, f.elements.deposit.value);
      $('#total').textContent = money(t.total);
      var rows = [['Subtotal', t.subtotal], ['Discount', t.discount ? -t.discount : 0], ['Tax', t.tax], ['Deposit to book', t.deposit]];
      $('#lines').innerHTML = rows.filter(function (x) { return x[1]; }).map(function (x) { return '<div class="line"><span>' + esc(x[0]) + '</span><span>' + money(x[1]) + '</span></div>'; }).join('') || '<p class="muted small">Add a quantity to any line.</p>';
      return t;
    }
    $$('.qline').forEach(function (row) {
      var input = $('input', row);
      $$('button', row).forEach(function (b) {
        b.addEventListener('click', function () {
          input.value = Math.max(0, num(input.value) + num(b.getAttribute('data-step')));
          render();
        });
      });
    });
    f.addEventListener('input', render);
    f.addEventListener('submit', function (e) { e.preventDefault(); });
    function savedList() { return store.get('quotes', []); }
    function drawSaved() {
      var list = savedList();
      $('#saved').innerHTML = list.length ? list.map(function (q, i) {
        return '<div class="line"><span>' + esc((q.number ? '#' + q.number + ' ' : '') + (q.customer || 'No name') + ', ' + q.date) + '</span><span class="row"><b>' + money(q.total) + '</b><button class="btn small" type="button" data-open="' + i + '">Open</button><button class="btn small" type="button" data-del="' + i + '">Delete</button></span></div>';
      }).join('') : '<p class="muted small">Quotes you save show here, on this device only.</p>';
    }
    $('#saved').addEventListener('click', function (e) {
      var o = e.target.getAttribute('data-open');
      var d = e.target.getAttribute('data-del');
      var list = savedList();
      if (o != null) {
        var q = list[num(o)];
        f.elements.customer.value = q.customer || '';
        f.elements.number.value = q.number || '';
        f.elements.discount.value = q.discount || 0;
        f.elements.tax.value = q.tax || 0;
        f.elements.deposit.value = q.deposit || 0;
        $$('.qline').forEach(function (row) { $('input', row).value = (q.qty || {})[row.getAttribute('data-name')] || 0; });
        render();
        window.scrollTo(0, 0);
      }
      if (d != null && window.confirm('Delete this saved quote?')) {
        list.splice(num(d), 1);
        store.set('quotes', list);
        drawSaved();
      }
    });
    $('#save').addEventListener('click', function () {
      var t = render();
      if (!t.rows.length) return toast('Add a quantity first');
      var qty = {};
      lines().forEach(function (l) { if (l.qty) qty[l.name] = l.qty; });
      var m = meta();
      var list = savedList();
      list.unshift({ customer: m.customer, number: m.number, date: todayStr(), total: t.total, qty: qty, discount: f.elements.discount.value, tax: f.elements.tax.value, deposit: f.elements.deposit.value });
      store.set('quotes', list.slice(0, 200));
      drawSaved();
      toast('Saved on this device');
    });
    $('#copy').addEventListener('click', function () { copyText(quoteText(render(), meta(), C)); });
    $('#print').addEventListener('click', function () { window.print(); });
    if (!f.elements.number.value) f.elements.number.value = String(savedList().length + 1001);
    drawSaved();
    render();
  })();
}
