// The deposit on the invoices. The kit's win step and its invoice (C.winSteps) take no deposit, and
// the quote's invoice (made when they say yes) uses the quote's lines but not its deposit. Both get
// the deposit typed in the form here, so a deposit holds the date as the agreement says. When none is
// typed, the reference drops out and the invoice uses the deposit remembered in the money settings.
// Kit change asked for in the report: a `deposit` option on C.winSteps and the deposit passed to the
// invoice in C.quoteWorkflow, after which this helper can go.

const C = require('../../_kit/common');

const withDeposit = (steps, deposit) => steps.map((s) => (s.id === 'invoice' && deposit ? { ...s, input: { ...s.input, deposit } } : s));

function bookingSteps(t, { flag, input, deposit }) {
  return withDeposit(C.winSteps(t, { flag, input }), deposit);
}

function quoteWithDeposit(wf) {
  return { ...wf, steps: withDeposit(wf.steps, '$inputs.deposit') };
}

module.exports = { bookingSteps, quoteWithDeposit };
