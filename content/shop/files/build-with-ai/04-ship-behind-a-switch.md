# Ship behind a switch, with tests

Every new piece of 127 goes live switched off. The code is on the real site, but nobody sees it until the switch flips. That makes shipping boring, which is the goal.

## Three positions

- **Off**: nobody sees it.
- **Admins**: only you (and anyone you add) see it, on the real site, with real data.
- **On**: everyone sees it.

Look at it yourself in "admins" before it's ever "on". If something goes wrong after "on", flip it back. No rollback, no panic.

## Tests the AI writes and runs

Ask for tests with every change, and ask for them in plain language first: "a guest can buy, gets one purchase recorded even if Stripe sends the message twice, and can't open another pack's files." The AI turns those sentences into test code. Every change runs every test. If anything fails, it doesn't ship.

## Demo mode for anything with money

Payment features get a demo mode that records a purchase without charging anyone, and the payment provider's test mode with test cards. Real money comes last, after the switch has been on "admins" and you've bought it yourself.

## Prompt: add a switch and tests

```text
Add [feature] behind a switch called [NAME] with three settings: off (default), admins, on.
Before writing code, list the tests you'll write in plain sentences, including what must NOT happen. Wait for my OK on the list.
Then build it, write those tests, run the full test suite, and show me the results. Tell me exactly how to view it in admins mode.
```
