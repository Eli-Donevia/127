# Website and store: look like the real thing

A site that looks cheap costs you buyers. These prompts build animated landing pages, steal good ideas from great sites, fix a weak hero, and launch a store that converts.

## Build an animated landing page

**Use it when:** You want a real, working one-page site with motion that feels premium, built by an AI that writes code (Claude, ChatGPT, Replit, Lovable, v0).

**Fill in first:**

- `{{business}}`: Your business (for example: Pressure washing for driveways and storefronts in Tampa)
- `{{copy}}`: Your copy or the key facts (for example: Same-week service, before and after photos, from $129, fully insured)
- `{{colors}}`: Brand colors (for example: near-black #0B0B0C, white, accent #3BA7FF)
- `{{feel}}`: Feel (for example: clean, sharp, confident)
- `{{cta}}`: Primary action (for example: Get a free quote)
- `{{cta_link}}`: Where the button goes (for example: https://cal.com/yourname/quote)

```text
Build me a single-file landing page (HTML, CSS and vanilla JavaScript in one file, no build step) that I can publish today.

Business: {{business}}
Copy (or write it for me from this): {{copy}}
Brand: colors {{colors}}, feel {{feel}}
Primary action: {{cta}}

Design bar: it should feel like a premium, funded product, not a template. Minimal, lots of space, big confident type, one accent color.

Sections: hero, the problem, what you get, how it works (3 steps), proof or demonstration, FAQ, final call to action, footer.

Motion (tasteful, fast, never in the way):
- Hero headline reveals word by word on load (under 900ms total).
- Elements fade and rise 16px as they scroll into view (IntersectionObserver).
- A subtle animated background in the hero (slow gradient drift, grain, or a canvas particle field), under 5% CPU.
- Buttons have a magnetic hover and a press state.
- Numbers count up when they come into view.
- Respect prefers-reduced-motion: no movement, everything visible.

Technical: mobile first, loads in under 2 seconds, semantic HTML, alt text, visible focus states, contrast AA, no external libraries unless from a CDN with a pinned version. The call to action button links to {{cta_link}}.

After the code, list: what to replace (images, links), and three ways to make it 10x better next.
```

**What you get back:** One HTML file with word-by-word hero reveal, scroll fades, a drifting gradient, magnetic buttons, a before-and-after section and reduced-motion support, plus a replace list and three upgrade ideas.

**Works in:** Claude artifacts, Replit, Lovable, v0, Cursor

## Make the hero 10x better

**Use it when:** Your homepage top section feels flat, generic or "AI". You want it to hook a stranger in five seconds.

**Fill in first:**

- `{{headline}}`: Current headline (for example: Elevate your brand with stunning visuals)
- `{{subhead}}`: Current subhead (for example: We help businesses grow through creative content solutions)
- `{{button}}`: Current button text (for example: Learn more)
- `{{visual}}`: What the hero shows (for example: Stock photo of a camera on a desk)
- `{{audience}}`: Who it is for (for example: Restaurants and cafes in Denver)

```text
Here's my current homepage hero (the first screen people see):

Headline: {{headline}}
Subhead: {{subhead}}
Button: {{button}}
Visual: {{visual}}
Who it's for: {{audience}}

Critique it hard:
1. The 5-second test: what would a stranger think this business does? Is that right?
2. What feels generic, vague or "AI-made", line by line.
3. What's missing: a concrete outcome, who it's for, proof, a reason to act now.

Then give me three new heroes, each a different direction:
A. Outcome-led (the result they get).
B. Demonstration-led (show the product working in the hero).
C. Bold and brand-led (a strong line, premium feel).
For each: headline under 10 words, subhead under 20, button text, the visual described precisely (layout, motion, imagery), and a one-line reason it works.

Rules: no buzzwords (unlock, revolutionize, seamless, supercharge), no claims I can't prove, no invented numbers. Pick the one you'd ship and say why.
```

**What you get back:** A line-by-line teardown and three new heroes (for example "Your menu, filmed this week." over an autoplaying 6-second food reel), with a pick.

## Learn from a great site

**Use it when:** You found a site, brand or studio you love and want to borrow what makes it great without copying it.

**Fill in first:**

- `{{references}}`: Links or names of sites you love (for example: linear.app, stripe.com, a design studio portfolio I like)
- `{{business}}`: Your business (for example: Freelance brand designer for local restaurants)
- `{{current}}`: Your current site or plan (for example: A Squarespace template with a big photo and a contact form)

```text
I want my site to feel as good as these references:

{{references}}

My business: {{business}}
My current site or plan: {{current}}

For each reference, break down:
1. Layout and spacing: grid, whitespace, section rhythm.
2. Typography: fonts or similar free alternatives, sizes, weights, case.
3. Color and texture.
4. Motion: what moves, when, and how fast.
5. Copy style: how they talk.
6. The single detail that makes it feel premium.

Then:
- A list of 10 specific moves to apply to my site, ranked by impact for effort.
- What not to copy (things that fit their brand but not mine, or would look like a knockoff).
- A one-paragraph design brief I can hand to a designer or an AI site builder.
```

**What you get back:** A breakdown of each reference, ten ranked moves for your site, a do-not-copy list and a designer-ready brief.

## Homepage mock-up for a prospect

**Use it when:** You sell websites and want to show a business what their new homepage could look like before they pay.

**Fill in first:**

- `{{business}}`: The business (for example: Ramirez Plumbing)
- `{{problems}}`: What their site gets wrong (for example: No phone number on mobile, no prices, last updated 2019)
- `{{jobs}}`: What customers need to do (for example: Call for an emergency, book a quote, see service area)
- `{{info}}`: Their public info (for example: Services from their Facebook page, hours, 3 Google reviews they posted on their site)
- `{{me}}`: Your name or business (for example: Sam Lee Web)

```text
Make a homepage mock-up for a business I want to pitch. It's a sample to show them, not their live site.

Business: {{business}}
What their current site gets wrong: {{problems}}
What their customers need to do on the site: {{jobs}}
Their public info I can use (services, hours, area, photos): {{info}}

Build a single HTML file with: a hero that says what they do and where, a clear booking or call button, services with prices if public, proof (their real public reviews only, quoted with the source, or leave a placeholder), service area, hours, and a footer. Mobile first. Fast. Clean.

Put a small banner at the top: "Sample homepage made for {{business}} by {{me}}."

After the code, write a 3-line message to send them with a screenshot, pointing to the two biggest improvements.
```

**What you get back:** A clearly labeled sample homepage with a tap-to-call hero and service area, plus a 3-line pitch message.

## Store launch plan

**Use it when:** You are opening a Shopify, Etsy or similar store and want it set up to sell from day one.

**Fill in first:**

- `{{products}}`: What you sell (for example: Three heavyweight blank tees and a hoodie, small batch)
- `{{platform}}`: Platform (for example: Shopify)
- `{{buyer}}`: Who buys (for example: College athletes and gym-goers 18 to 28)
- `{{date}}`: Launch date (for example: December 5)
- `{{budget}}`: Budget (for example: $1,200 for inventory and launch)

```text
Plan my store launch.

What I sell: {{products}}
Platform: {{platform}}
Who buys: {{buyer}}
Launch date: {{date}}
Budget: {{budget}}

Give me:
1. Store structure: pages, collections, navigation.
2. Product page template: title formula, the first three lines of the description, what photos to shoot (list of 6), size or spec details, shipping and returns in plain words.
3. Pricing check: cost, price, margin per item, and the free-shipping threshold that makes sense.
4. Apps or settings to turn on first (reviews, email capture, abandoned cart, analytics), only the essentials.
5. A drop-style launch: 14-day countdown plan with content each day, an early-access list, and launch day steps.
6. The 10 things to check before going live (checkout test, tax, shipping zones, policies, mobile speed).

Rules: no fake scarcity or fake reviews. If I say "limited", it has to be true.
```

**What you get back:** Store map, a product page template with a shot list, margin math, a short app list, a 14-day drop plan and a go-live checklist.

**Works in:** Shopify, Etsy, Stripe, Canva

## Why is my site not converting?

**Use it when:** People visit but don't buy, book or sign up.

**Fill in first:**

- `{{site}}`: Your URL or page text (for example: https://example-cleaning.com)
- `{{goal}}`: What visitors should do (for example: Book a first cleaning)
- `{{numbers}}`: Your numbers (for example: 400 visits a month, 3 bookings)

```text
Audit my site for conversion. Be direct.

Site URL or pasted page text: {{site}}
What I want visitors to do: {{goal}}
Traffic and numbers, if I have them: {{numbers}}

Check:
1. Clarity: in 5 seconds, can a stranger tell what it is, who it's for, and what to do next?
2. Value: is the end result clear and concrete?
3. Friction: steps, form fields, load time, mobile layout, broken links.
4. Trust: proof, real photos, contact info, policies.
5. Call to action: is there one main action, repeated, above the fold?

Give me the top 10 fixes ranked by impact for effort, each with the exact new copy or change. Then one A/B test to run first and how long to run it.
```

**What you get back:** A five-point audit and ten ranked fixes with rewritten copy (for example a price-from line and a booking button above the fold), plus a first A/B test.
