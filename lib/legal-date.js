// The date the legal pages show as "Last updated": the day the site was published (LEGAL_EFFECTIVE_DATE,
// YYYY-MM-DD), else the first-publish date in Legal's drafts. HQ keeps the same date with a member's OK to a
// Terms line, as the Terms version they agreed under (Legal L71), so both read it here.

const FIRST_PUBLISH = '2026-10-16';

// YYYY-MM-DD.
function legalDate() {
  const raw = process.env.LEGAL_EFFECTIVE_DATE || '';
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : FIRST_PUBLISH;
}

// As the pages show it: "October 16, 2026".
function legalDateText() {
  return new Date(legalDate() + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
}

module.exports = { legalDate, legalDateText, FIRST_PUBLISH };
