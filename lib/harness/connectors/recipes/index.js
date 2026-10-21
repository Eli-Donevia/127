// Connector recipes (BUILD-PLAN W1, Eli Oct 21: "as many integrations as humanly possible"). A recipe is data:
// how a system signs in, the exact calls 127 may make there (Legal K2's allowlist), and its data rules. The
// engine (../recipes.js) turns each into a catalog entry, a "Sign in with" provider where needed, and a client
// with one method per read and per write. Adding a system is a file here plus its Legal line, not new code.
//
// Every endpoint, scope and header follows the system's own docs (Oct 2026); confirm each when 127's app with
// that system is made (v2/turnkey/SIGNUPS.md), since a few move between API versions.

module.exports = [
  require('./hubspot'),
  require('./gohighlevel'),
  require('./pipedrive'),
  require('./attio'),
  require('./close'),
  require('./keap'),
  require('./folk'),
  require('./twenty'),
];
