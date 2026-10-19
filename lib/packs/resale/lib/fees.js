// Fee math per platform from data/niche.json (each platform's own fee page, dated). The buyer pays
// shipping equal to the label cost by default, so what you keep is the price minus the fee; on
// Poshmark the buyer pays the label. Sales tax counts only where the platform charges its fee on it.

const round2 = (n) => Math.round(n * 100) / 100;

function feeFor(p, { item, ship = 0, tax = 0, local = false }) {
  if (local && p.local_free) return 0;
  if (p.flat != null && item <= p.flat_max) return p.flat;
  const has = (k) => (p.base || []).includes(k);
  const base = (has('item') ? item : 0) + (has('ship') ? ship : 0) + (has('tax') ? tax : 0);
  let fee = base * p.pct;
  if (p.fixed != null) fee += p.fixed_small != null && item + ship + tax <= p.small_max ? p.fixed_small : p.fixed;
  if (p.min != null) fee = Math.max(p.min, fee);
  return round2(fee);
}

// Every platform at one price: fee, what you keep after the fee, and profit after your cost.
function feeTable(N, { price, weight = '1lb', cost = 0 }) {
  const cls = N.shipping.classes[weight] || N.shipping.classes['1lb'];
  const local = weight === 'local';
  const tax = round2(price * N.tax_rate_example);
  return N.platforms.map((p) => {
    const ship = p.label === 'buyer' || local ? 0 : cls.cost;
    const fee = feeFor(p, { item: price, ship, tax, local });
    const keep = round2(price - fee);
    return { id: p.id, platform: local && p.local_free ? `${p.name} (local pickup)` : p.name, fee, keep, profit: round2(keep - cost), fee_text: p.fee_text, shipping: local ? 'Local pickup' : p.label === 'buyer' ? 'Buyer pays the label' : `Buyer pays about $${cls.cost.toFixed(2)}` };
  });
}

// The lowest price that still leaves `profit` after the fee and your cost on one platform.
function floorPrice(N, platformId, { cost = 0, profit = 5, weight = '1lb' }) {
  const p = N.platforms.find((x) => x.id === platformId) || N.platforms[0];
  for (let price = Math.max(1, Math.ceil(cost)); price < 100000; price += 1) {
    const row = feeTable(N, { price, weight, cost }).find((r) => r.id === p.id);
    if (row.profit >= profit) return price;
  }
  return null;
}

module.exports = { feeFor, feeTable, floorPrice, round2 };
