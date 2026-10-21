# Turn your standards into rules the AI checks

If a rule only lives in your head, the AI will break it. If it lives in a file the tests run, it never will.

## Copy rules as code

127 has a copy checker that runs with every test. It fails the build if any page or email says something 127 never says: income promises, "guarantee", dollar "value" totals, em dashes, and a list of words that sound like ads. It also checks that certain lines appear where they must, like the typicality line next to any real numbers.

Write your own list:

- Words and claims you never use.
- Lines that must appear in certain places (a disclaimer, a refund line, your exact price wording).
- Your spelling of your own name, product names and prices.

Then ask the AI to turn the list into a checker that runs with your tests.

## Design rules against "made by AI" looks

AI-built sites drift toward the same look. 127 keeps a list of tells to avoid and checks every page against it:

- Little rounded "badges" with a coloured dot.
- Glows and blurred colour blobs behind everything.
- Headlines where half the words are a different colour.
- Three identical cards in a row with an icon each.
- Gradients on text.
- Every section centred, every section the same height.
- Vague words: "unlock", "elevate", "seamless", "supercharge".

Instead: one strong idea per page, real images or real product screenshots, one accent colour used for one thing, and type doing most of the work.

## Phone first

Check every page on a phone before a laptop. Most of your visitors are there. The AI can screenshot pages at phone size and tell you where text overflows or buttons get too small.

## Prompt: build your checker

```text
Here are my copy rules: [list words and claims I never use, lines that must appear and where, how I spell my names and prices].

Write a copy checker that scans my site's pages and emails, reports each problem with the file, line and the rule it broke, and runs as part of my tests so the build fails on any blocking problem. Then run it and show me what it finds.
```

## Prompt: design critique

```text
Here's a screenshot of my page at phone width. Critique it against this list of looks that make a site feel AI-made: [paste the list above]. For each problem, say exactly what to change. Then tell me the one change that would make it feel most like a real, premium brand.
```
