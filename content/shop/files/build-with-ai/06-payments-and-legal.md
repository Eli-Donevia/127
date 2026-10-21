# Payments and the legal basics

The parts where guessing costs real money. This is how 127 approaches them, not legal advice. Have a lawyer read your terms before you take money at scale.

## Payments

- **Test mode first.** Stripe has a full test mode with test cards. Build and buy everything there.
- **Webhooks are the source of truth.** The page someone lands on after paying can fail to load. The payment provider also sends your server a message (a webhook) when a payment succeeds. Record the purchase from that, and make sure recording it twice does nothing.
- **Refunds end access.** When you refund, whatever they bought should switch off automatically.
- **Price wording in one place.** Your price, billing and cancel terms come from one file, so the checkout, the pricing page and the emails never disagree.
- **Taxes.** Turn on the provider's tax tools, or sell through a platform that handles sales tax for you, before you sell across states or countries.

## The legal basics

- **Terms and privacy pages** before anyone signs up. Your AI can draft them from your spec; a lawyer should read them.
- **A legal read before any new outside service.** Every service that sees your customers' data (email, analytics, AI) gets listed in your privacy policy.
- **No claims you can't back.** No income promises. Real numbers only, with a typicality line.
- **Email rules.** Marketing email needs consent, an unsubscribe link and your postal address.
- **Age.** Decide your minimum age and say it at sign-up.

## Prompt: payments review

```text
Review my payments code for: purchases recorded from the webhook (not only the success page); a duplicate webhook recording nothing new; refunds ending access; prices coming from one place; test mode working end to end. List anything missing, then write the tests that would catch each problem.
```
