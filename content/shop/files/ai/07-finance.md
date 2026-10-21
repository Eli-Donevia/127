# Finance and forecasting: know your numbers

Simple numbers beat gut feel. These prompts build a forecast, check your unit economics, read your week, and tell you how long your cash lasts. They plan and explain; they are not tax, legal or investment advice.

## 12-month forecast

**Use it when:** You want to see where the business could be in a year under three scenarios, and what has to be true for each.

**Fill in first:**

- `{{offers}}`: Offers and prices (for example: Monthly social video package $450; one-off promo video $250)
- `{{today}}`: Where you are now (for example: 3 monthly clients, $1,350 a month, costs $120 a month)
- `{{channels}}`: Where your buyers come from (for example: Instagram DMs to local gyms, about 100 a week, $0)
- `{{hours}}`: Hours you can work weekly (for example: 25)

```text
Build a simple 12-month forecast for my business as a table I can paste into a spreadsheet.

What I sell and prices: {{offers}}
Where I am today (customers, monthly revenue, monthly costs): {{today}}
Where my buyers come from and what it costs: {{channels}}
Hours I can work: {{hours}}

Make three scenarios: slow, expected, strong. For each month show: new customers, customers lost, total customers, revenue, costs (fixed and variable), profit, and cash at month end.

Rules:
- List every assumption in its own table (conversion rates, churn, price changes, hours per customer) so I can change them. Label each as "my data" or "your guess".
- Flag the month I run out of hours to deliver, if I do, and what I'd need to hire or automate.
- Show the formulas in plain words so I can rebuild them.
- This is a planning tool, not a promise. Say which two assumptions matter most and how to test them in the next 30 days.
```

**What you get back:** Three month-by-month scenarios, an assumptions table you can edit, the month you hit your hour limit, plain-word formulas and the two assumptions to test first.

**Works in:** Google Sheets, Excel, Stripe, QuickBooks

## Unit economics and payback

**Use it when:** Before you spend on ads or tools. You want to know what a customer is worth and what you can afford to pay to get one.

**Fill in first:**

- `{{price}}`: Price and billing (for example: $29 a month subscription)
- `{{delivery_cost}}`: Your cost to serve one customer monthly (for example: $4 in software and AI)
- `{{fees}}`: Payment fees (for example: 2.9% plus 30 cents)
- `{{retention}}`: How long customers stay (for example: About 6 months)
- `{{acquisition}}`: Marketing spend and what it brought in (for example: $300 a month on ads, 12 new signups last month)

```text
Work out my unit economics.

Price and billing: {{price}}
Cost to deliver one month of service: {{delivery_cost}}
Payment fees: {{fees}}
How long customers stay on average (or my guess): {{retention}}
What I spend on marketing now, and what it brought in: {{acquisition}}

Calculate and explain in plain words:
1. Gross profit per customer in the first 30 days.
2. Gross profit over a customer's lifetime.
3. The most I can spend in marketing per new sale and still break even in 30 days.
4. The most I should ever pay (lifetime profit divided by 3).
5. My current cost per customer, if I gave you the numbers, and whether it's healthy.
6. Three ways to raise first-30-day cash (an upfront fee, an annual option, an add-on) and the effect of each.

Show the math step by step. Mark guesses clearly.
```

**What you get back:** About $24 of first-month profit, about $144 lifetime, a $24 break-even and $48 ceiling per customer, your current $25 cost flagged as tight, and three cash-raising options.

## Read my week

**Use it when:** Every Monday. Paste your numbers and get the one move for the week.

**Fill in first:**

- `{{numbers}}`: Your weekly numbers (for example: Week | posts | DMs sent | replies | calls | sales | revenue / W1 | 4 | 60 | 5 | 2 | 1 | $350 / W2 | 3 | 90 | 4 | 0 | 0 | $0)
- `{{goal}}`: Your quarter goal (for example: 8 paying monthly clients)

```text
Here are my numbers for the last few weeks:

{{numbers}}

My goal this quarter: {{goal}}

Tell me:
1. The one number that matters most right now, and whether it's up or down.
2. Where the funnel leaks: the step with the biggest drop (for example messages to replies, replies to calls, calls to sales).
3. Why that might be happening, two likely causes.
4. My one move this week to fix the leak, specific enough to put on a calendar.
5. What to stop, pause or keep.
6. A one-line note to my future self for next Monday.

Keep it under 200 words. Use my numbers, don't invent any.
```

**What you get back:** The leak is replies to calls, two likely causes, one move (ask for the call in your second reply with two time options), a stop list and a note for next week.

## Cash runway and spending check

**Use it when:** You want to know how long your money lasts and which costs to cut first.

**Fill in first:**

- `{{cash}}`: Cash on hand (for example: $2,400)
- `{{revenue}}`: Average monthly revenue (for example: $900)
- `{{costs}}`: Recurring costs (for example: Adobe $60, CapCut Pro $10, ChatGPT $20, Claude $20, Squarespace $23, Canva $15, ads $200)
- `{{upcoming}}`: Upcoming one-off costs (for example: New camera lens $400 in January)

```text
Check my cash and spending.

Cash I have now: {{cash}}
Monthly revenue (average of last 3 months): {{revenue}}
Every recurring cost (name, amount, what it does): {{costs}}
One-off costs coming up: {{upcoming}}

Give me:
1. Monthly burn and runway in months, at today's numbers.
2. Each recurring cost rated keep, cut, or downgrade, with the reason (does it make money, save real time, or neither).
3. Free or cheaper swaps for anything I should downgrade.
4. Runway after the cuts.
5. The revenue I'd need to break even each month.
6. A rule for future spending: what a new tool must do to earn its place.

Use only the numbers I gave you. This is planning help, not financial advice.
```

**What you get back:** Burn and runway, keep-cut-downgrade calls on each tool (for example drop one of the two AI subscriptions), runway after cuts, break-even revenue and a spending rule.

**Works in:** Google Sheets, Your bank export, QuickBooks

## Quote and invoice writer

**Use it when:** A customer said yes or asked for a price, and you need a clean quote or invoice now.

**Fill in first:**

- `{{customer}}`: Customer (for example: Lena Park, homeowner)
- `{{job}}`: The job (for example: Paint two bedrooms and a hallway, walls only, she supplies paint)
- `{{prices}}`: Your prices (for example: $350 per bedroom, $200 hallway, $40 materials)
- `{{terms}}`: Your terms (for example: 30% deposit to book, rest on completion, 48 hours notice to reschedule)
- `{{me}}`: Your business details (for example: Brush & Roll Painting, Ana Torres, (555) 010-2233)

```text
Write a quote for this job that's clear enough that the customer says yes without questions.

Customer: {{customer}}
The job: {{job}}
My prices: {{prices}}
Terms I want (deposit, due date, cancellation): {{terms}}
My business details: {{me}}

Include: a short summary of the job in their words, line items with quantities and prices, what's included and not included, timeline, total, deposit and how to pay, how long the quote is valid, and a one-line yes ("Reply YES and I'll send the deposit link").

Then write the matching invoice text for after they say yes, and a polite reminder for 3 days after the due date. Keep both friendly and short.
```

**What you get back:** A $940 quote with scope, exclusions, timeline, a $282 deposit line and a YES reply prompt, plus the invoice text and a reminder.

**Works in:** Stripe, QuickBooks, Square, Google Docs
