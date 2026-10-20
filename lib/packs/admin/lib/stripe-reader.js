// The Stripe reader for invoice chasing, kept apart from everything else on purpose.
//
// HELD: this pack reads unpaid invoices from a CSV the member uploads (or lines they paste). It
// lists `wants: ['stripe']` so the harness can show that a Stripe connection would fill the list,
// but reading the member's Stripe stays off (READ_STRIPE = false) until the Stripe reader is
// reviewed. When it is turned on it only reads: open invoices, the customer's name and email,
// amount still owed and due date, for this run only. It never sends, changes or voids an invoice.
// The billing pack's chase flow is where Stripe itself emails a reminder.

const READ_STRIPE = false;

// Stripe invoice objects (amounts in cents, due_date in seconds) to the rows the chase list uses.
function fromStripeInvoices(list, toRow, today) {
  return (Array.isArray(list) ? list : [])
    .filter((i) => i && i.status === 'open' && Number(i.amount_remaining) > 0)
    .map((i) => {
      const dueMs = (i.due_date || i.created || 0) * 1000;
      const d = new Date(dueMs);
      const due = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      return toRow({ customer: i.customer_name || i.customer_email || 'Customer', email: i.customer_email || '', number: i.number || '', owed: Number(i.amount_remaining) / 100, due, guessed: !i.due_date }, today);
    });
}

// Returns the rows, or null when Stripe is not to be read (always, while held).
async function readStripe(ctx, toRow, today) {
  if (!READ_STRIPE) return null;
  const s = ctx && typeof ctx.secret === 'function' ? ctx.secret('stripe') : null;
  if (!s || typeof s.invoices !== 'function') return null;
  const list = await s.invoices({ status: 'open' });
  return fromStripeInvoices(list, toRow, today);
}

module.exports = { readStripe, fromStripeInvoices, READ_STRIPE };
