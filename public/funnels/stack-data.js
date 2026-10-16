// The Day One Stack: Eli's tool stack (from his founder intake), the order to set it up,
// and 30 copy-paste prompts. Edit content here; stack-guide.js renders it.
// Costs are described loosely on purpose (plans and prices change). No invented numbers.
window.STACK = {
  intro: [
    "The biggest mistake I made was thinking this wasn't possible for me, for way too long. I assumed other people had qualifications I didn't. They didn't. They started.",
    "Most of what made me faster wasn't one big moment. It was years of trying things, money lost on ads, and tools I didn't know existed that made me 10x more productive. This is that list, so you don't have to spend the years.",
    "One rule before you open anything: add a tool only when the pain of not having it is real. Fewer tools, more progress. Day one costs $0.",
  ],

  dayZero: {
    title: 'The $0 day-one stack',
    body: 'If you do nothing else, start here. All four have free plans. Set them up in one afternoon.',
    tools: ['Claude', 'Perplexity', 'Notion', 'CapCut'],
  },

  layers: [
    {
      n: '01', name: 'Think', when: 'Day one',
      why: 'Research and thinking partners. Every other layer gets better when you start here.',
      tools: [
        {
          name: 'Claude', mono: 'Cl', cost: 'Free plan, paid for heavy use',
          job: 'Your thinking partner, writer and builder.',
          eli: 'I use Claude for prompting, workflows and building: offers, copy, and even website-building prompts that get a page live in an afternoon.',
          steps: [
            'Create a free account at claude.ai.',
            'Create a Project for your business. Add a short context doc: who you serve, your offer, your voice, what customers have told you.',
            'Run the prompts in this guide inside that Project, so every answer knows your business.',
            'Save the prompts that work into a Notion page. That becomes your playbook.',
          ],
          rule: 'AI is only as good as the context you give it. Feed it real customer words, not your guesses.',
        },
        {
          name: 'Perplexity', mono: 'Px', cost: 'Free plan',
          job: 'Research with sources you can check.',
          eli: 'Before I commit to anything I ask: is this market growing or shrinking, and how is AI changing it? Perplexity is where that research starts.',
          steps: [
            'Sign up free at perplexity.ai.',
            'Create a Space for your business so your research stays in one place.',
            'Ask the market and competitor prompts below. Open the sources every time.',
            'Copy what holds up into Notion. Throw out anything you could not verify.',
          ],
          rule: 'Never put a number in a pitch you have not checked at the source.',
        },
      ],
    },
    {
      n: '02', name: 'Organize', when: 'Week one',
      why: 'One home for your plans, content and weekly review, so nothing lives only in your head.',
      tools: [
        {
          name: 'Notion', mono: 'N', cost: 'Free plan',
          job: 'Your operating system.',
          eli: 'My content scheduling frameworks and templates live in Notion.',
          steps: [
            'Create a free workspace. Make four pages: Home, Content Calendar, Weekly CEO Review, Ideas.',
            'Make Content Calendar a database with Status, Platform and Publish date.',
            'Add a board view by Status: Idea, Scripted, Filmed, Posted.',
            'Every Monday, fill in the Weekly CEO Review (prompt 28 writes it with you).',
          ],
          rule: 'If it is not written down, it is not a system. It is a memory.',
        },
        {
          name: 'Miro', mono: 'Mi', cost: 'Free plan',
          job: 'Think on a whiteboard.',
          eli: 'I build out templates and plans on Miro boards before they become anything else.',
          steps: [
            'Create a free account and one board per project.',
            'Start from a template: customer journey map, brainstorm, or launch plan.',
            'Map how a stranger becomes a customer, step by step. Circle where people drop off.',
            'Share the board with anyone helping you so you plan in one place.',
          ],
          rule: 'If you cannot draw how a stranger becomes a customer, you do not have a business yet. You have a product.',
        },
      ],
    },
    {
      n: '03', name: 'Sell', when: 'When you start talking to customers',
      why: 'Trust beats everything else in sales. These two make sure no conversation is wasted.',
      tools: [
        {
          name: 'Attio', mono: 'At', cost: 'Free plan',
          job: 'A CRM that builds itself from your email and calendar.',
          eli: 'Attio is the CRM in my stack. Relationships are the business.',
          steps: [
            'Create a workspace and connect your email and calendar. Attio builds your contacts from them.',
            'Create a list called Pipeline with stages: Talked, Interested, Offer sent, Won, Lost.',
            'After every conversation, add a two-line note and move the stage.',
            'Every week, follow up with everyone sitting in Interested.',
          ],
          skip: 'Under about 10 conversations a month? A simple Notion table works until then.',
          rule: 'Your network is your net worth. A CRM is how you stop losing it.',
        },
        {
          name: 'Granola', mono: 'Gr', cost: 'Free to start',
          job: 'Meeting notes that write themselves.',
          eli: 'Granola is how I capture calls without breaking eye contact to type.',
          steps: [
            'Download the app and connect your calendar.',
            'It transcribes from your device, so no bot joins the call. Always tell people you are taking notes.',
            'Jot rough notes during the call. Granola fills in the rest when it ends.',
            'After discovery calls, copy the exact phrases customers used into your offer doc.',
          ],
          rule: 'Ask about their past, never pitch. Their words become your headline.',
        },
      ],
    },
    {
      n: '04', name: 'Create and distribute', when: 'When you start posting',
      why: 'Authenticity and consistency. When something works, make more like it.',
      tools: [
        {
          name: 'CapCut', mono: 'Cc', cost: 'Free, paid extras',
          job: 'Edit short-form video on your phone.',
          eli: 'CapCut on iPhone is how I edit fast. Learning editing and workflows is a big part of how my content passed 25 million views.',
          steps: [
            'Install CapCut. Film vertical (9:16) in good light.',
            'Cut everything before the hook. The first two seconds decide everything.',
            'Turn on auto captions and fix the words it gets wrong.',
            'Save your best edit as your template so every video looks like you.',
          ],
          rule: 'If a video works, use that format again. Do more of what works, not just more.',
        },
        {
          name: 'Higgsfield', mono: 'Hf', cost: 'Free credits to try, then paid',
          job: 'AI video for b-roll and visuals.',
          eli: 'I use Higgsfield for AI video when filming it for real would cost a crew.',
          steps: [
            'Create an account and start from one image plus a short prompt.',
            'Try the camera motion presets for b-roll and hooks.',
            'Use it for visuals and concepts. Never to fake a customer, a result or a review.',
            'Cut the clips into your CapCut template.',
          ],
          skip: 'Get consistent with real, simple content first.',
          rule: 'How you do one thing is how people see you do everything. Integrity in every frame.',
        },
        {
          name: 'ManyChat', mono: 'Mc', cost: 'Free plan',
          job: 'Turn comments into conversations.',
          eli: 'ManyChat turns "comment ROADMAP" into a DM with the link, automatically.',
          steps: [
            'Switch Instagram to a professional account and connect it to ManyChat.',
            'Create an automation: when someone comments your keyword on a post, send a DM.',
            'The DM gives the link and asks one question. Keep it human.',
            'Put the keyword in every post\'s call to action.',
          ],
          skip: 'Posting less than three times a week? Fix consistency first.',
          rule: 'Make the next step so easy it feels rude not to take it.',
        },
      ],
    },
    {
      n: '05', name: 'Sell products', when: 'If you sell a physical or digital product',
      why: 'A real store when you have proof people will buy.',
      tools: [
        {
          name: 'Shopify', mono: 'Sh', cost: 'Free trial, then paid',
          job: 'Your online store.',
          eli: 'Shopify is in my stack for e-commerce. My brand\'s first drop sold out, with customers in 35 of 50 states and 100+ creator ambassadors behind it.',
          steps: [
            'Start a trial and pick a free theme. Do not customize for a week.',
            'Add one product with real photos and a description in your customer\'s words.',
            'Set up payments and shipping, then place a test order yourself.',
            'Launch to your warm list before you spend a dollar on ads.',
          ],
          skip: 'Selling a service? A payment link is enough on day one.',
          rule: 'Quality before growth. A bad product kills a company faster than marketing can grow it.',
        },
      ],
    },
  ],

  systems: {
    n: '06', name: 'Systems', when: 'When you are growing',
    why: 'Your business is only as valuable as it is when you are not there to run it. This is how I build harnesses to run a business: AI coworkers that plug into the stack.',
    flows: [
      ['Granola call ends', 'Claude summarizes it and drafts the follow-up', 'Attio gets the note and the next stage'],
      ['Notion idea marked Ready', 'Claude drafts the script and five hooks', 'CapCut edit, then the post goes in the calendar'],
      ['ManyChat captures an email', 'Your email tool sends the welcome', 'The lead lands in Attio with where they came from'],
      ['Monday morning', 'Your numbers pull into the Weekly CEO Review', 'You pick three priorities, not ten'],
    ],
    note: 'Start with one. Get it running, review the first three runs, then let it go. The Automation Starter Pack inside 127 Builder walks through each step.',
  },

  prompts: [
    {
      group: 'Find and validate',
      items: [
        { t: 'Score my ideas', when: 'You have more than one idea', p: 'I have these business ideas:\n1. [idea]\n2. [idea]\n3. [idea]\n\nAbout me: [skills, experience, network, hours per week, budget].\n\nScore each idea from 1 to 10 on: real pain (do people already pay to fix it?), my unfair advantage, how fast I could get a first paying customer, cost to start, and whether the market is growing. Put it in a table. Then tell me which one to pick and the one reason the others lose. Be blunt. Do not invent market numbers; tell me what to verify instead.' },
        { t: 'The problem in their words', when: 'Before you build anything', p: 'My idea: [idea]. Who it is for: [specific person].\n\nWrite the problem I solve in one sentence, the way that person would say it to a friend. No jargon. Then give me 5 alternate versions, from most emotional to most practical. Then tell me which assumption in my idea is most likely wrong.' },
        { t: 'Discovery interview script', when: 'Before customer conversations', p: 'I am interviewing [type of person] about [problem]. Write a 15-minute discovery interview script.\n\nRules: ask only about their past behavior, never hypotheticals. Never pitch my idea. Include an opener that makes it comfortable, 8 questions that dig into the last time the problem happened, what they tried, what they paid, and what it cost them, plus 3 follow-up questions for when they give a vague answer. End with how to ask for a referral to two more people.' },
        { t: 'Market direction check', when: 'Use in Perplexity', p: 'Research the market for [product or service] for [customer]. With sources:\n1. Is it growing, flat or shrinking? What is driving that?\n2. How is AI changing this market: making the problem bigger, smaller, or easier for anyone to solve?\n3. Who are the 5 biggest players and what do they charge?\n4. What do customers complain about most in reviews?\nFlag anything you are not confident about.' },
        { t: 'Alternatives scan', when: 'Use in Perplexity', p: 'List every way [customer] currently solves [problem], including doing nothing, spreadsheets, hiring someone, and existing products. For each: what it costs, what people like about it, and the top complaint. Then tell me the gap a new option could own. Cite sources.' },
        { t: 'Make sense of my interviews', when: 'After 5+ conversations', p: 'Here are my notes from customer conversations:\n[paste notes or Granola transcripts]\n\nFind: the phrases that came up more than once (quote them exactly), the problems people already spend money on, what they hate about current options, and any signal that someone would pay now. Then tell me honestly: is this a real problem worth building for? What should I ask in the next 5 conversations?' },
        { t: 'Pre-sell test', when: 'Before you build the product', p: 'I want to prove people will pay for [idea] before I build it. Design 3 ways to test it this week with under $50, ranked from strongest to weakest proof: a pre-order, a paid pilot, a deposit, a waitlist with a price, etc. For each: exactly what I say, what counts as a pass, and what counts as a fail.' },
      ],
    },
    {
      group: 'Offer and pricing',
      items: [
        { t: 'One-page offer', when: 'Turn the idea into something you can sell', p: 'Build a one-page offer for [product] for [customer]. Include: the headline result in their words, who it is for and who it is not for, what they get, the timeline to the first result, the price, a guarantee I can actually keep, and the next step. Keep it under 200 words. Then list 3 ways it is still vague.' },
        { t: 'Make it too good to refuse', when: 'Your offer gets "maybe"', p: 'Here is my offer: [offer]. Make it so good people feel they would be crazy to say no, without lying or overpromising. Suggest: bonuses that cost me little but matter to them, a stronger guarantee, a faster first result, removing risk, and better framing. Rank the changes by impact and flag anything I could not deliver.' },
        { t: 'Price it right', when: 'Setting or raising a price', p: 'I sell [offer] to [customer]. It saves or makes them [value, in time or money]. Competitors charge [prices].\n\nGive me 3 pricing options with the reasoning for each. Then rewrite how I present the price: frame the cost as the lowest possible number (per day, per use) and the value as the highest (what it saves or makes over a year). Show the exact words.' },
        { t: 'Do the numbers work?', when: 'Before you spend on growth', p: 'Check my unit economics. Price: [price]. Cost to deliver one: [cost]. How I get customers: [channel]. My best guess at cost to win one customer: [guess]. How often they buy: [frequency].\n\nTell me my margin, how many customers I need to hit [monthly goal], and the one number that breaks this model. Show your math. Do not give financial advice; just check the logic.' },
        { t: 'Handle the objections', when: 'People look but do not buy', p: 'These are the objections I hear: [list]. For each: what they are really worried about, an honest answer that builds trust, and a change to the offer that removes the objection entirely. No pressure tactics.' },
      ],
    },
    {
      group: 'Brand and website',
      items: [
        { t: 'Brand on one page', when: 'Before you design anything', p: 'Create a one-page brand sheet for [business], for [customer]. Include: one-line positioning, 3 personality words with what each means and does not mean, voice rules (5 do, 5 do not), 3 taglines, a color direction and a type direction. Base it on these customer words: [paste phrases from interviews].' },
        { t: 'Name it', when: 'You need a name', p: 'Give me 20 name ideas for [business] that is [personality]. Mix: real words, compound words, invented words and founder-led names. Each must be easy to say after hearing it once. For your top 5, explain why and what to check: domain, social handles and trademark conflicts (tell me to verify, do not assume).' },
        { t: 'Landing page copy', when: 'Before you build the page', p: 'Write landing page copy for [offer] for [customer]. Sections: headline (the result in their words), subhead, 3 problem bullets, how it works in 3 steps, what you get, proof (leave [placeholders] for real proof; never invent testimonials or numbers), FAQ with 5 real objections, and one call to action repeated 3 times. Use these customer phrases: [paste].' },
        { t: 'Build the page', when: 'Get a page live today', p: 'Build a single-file HTML landing page from this copy: [paste copy]. Mobile first, fast, no frameworks. Style: [dark and minimal / light and warm / describe]. Include an email signup form that posts to [form URL or leave a placeholder], a sticky call-to-action button on mobile, and proper meta tags for sharing. Give me the complete file and the steps to publish it.' },
        { t: 'Roast my page', when: 'The page gets visits but no signups', p: 'Here is my landing page: [paste copy or describe it]. Act like a skeptical [customer] seeing it for 5 seconds on their phone. What did you understand? What made you leave? Then give me the 3 changes that would most increase signups, in order.' },
      ],
    },
    {
      group: 'Content',
      items: [
        { t: '30-day content calendar', when: 'Plan a month in one sitting', p: 'Create a 30-day content calendar for [platform] for [business] that helps [customer] with [problem]. Weekly rhythm: lesson, story, behind the scenes, how-to, proof (real only), personal why, recap. For each day: the hook, the idea in one sentence, the format and the call to action. Return it as a table I can paste into a Notion database.' },
        { t: 'Hook bank', when: 'Every video needs a first line', p: 'Write 25 scroll-stopping hooks for [niche] aimed at [customer]. Mix: contrarian takes, mistakes, "how I", numbers (only real ones I give you: [my real numbers]), questions and stories. Under 12 words each. Mark the 5 strongest and say why.' },
        { t: 'Story to script', when: 'Turn your experience into content', p: 'Turn this story from my life into a 45-second vertical video script: [story]. Structure: a hook in the first 2 seconds, the tension, the turning point, the lesson, and a call to action to [action]. Write it the way I talk: [paste a caption or transcript of me talking]. Include on-screen text suggestions.' },
        { t: 'Why did this one work?', when: 'A post beat your average', p: 'This post did far better than my average: [paste caption or script, plus the numbers]. My usual posts look like: [paste 2 examples].\n\nWhat did this one do differently: hook, format, topic, emotion, length? Give me 5 new ideas that use the same winning pattern so I can double down until it stops working.' },
        { t: 'One video, five posts', when: 'Get more from what you make', p: 'Here is the transcript of one of my videos: [paste]. Turn it into: a carousel (slide-by-slide text), a text post, 3 short clips with timestamps and hooks, and an email to my list. Keep my voice.' },
        { t: 'Edit plan for CapCut', when: 'Before you edit', p: 'I filmed this: [describe the footage or paste the script]. Write a shot-by-shot edit plan for a 30 to 45 second vertical video in CapCut: where to cut, when to zoom or punch in, on-screen text for each beat, where b-roll goes, music mood, and caption style. The first 2 seconds must earn the next 10.' },
        { t: 'Comment-to-DM flow', when: 'Setting up ManyChat', p: 'I want people to comment [KEYWORD] on my posts to get [free thing]. Write: the call-to-action line for the post, the public reply to their comment, the DM that delivers the link and asks one question, and a follow-up DM 24 hours later for people who did not click. Friendly, short, never pushy.' },
      ],
    },
    {
      group: 'Sales',
      items: [
        { t: 'Warm outreach', when: 'Your first customers are people you know', p: 'Write 3 short DMs to people I already know, telling them about [offer] for [customer]. One to a close friend, one to someone I have not talked to in a year, one asking for a referral. No pitch in the first line. Make each feel personal and under 60 words. Include where I fill in something specific about them.' },
        { t: 'Prep for a sales call', when: 'Before a call', p: 'I have a call with [person, role, company] about [offer]. What I know about them: [notes]. Give me: 5 questions to understand their situation, the 3 objections they are most likely to raise with honest answers, and how to ask for the next step clearly at the end.' },
        { t: 'Follow up after the call', when: 'Right after you hang up', p: 'Here are my notes from a call: [paste Granola notes]. Write a follow-up email that recaps what they told me in their words, proposes one clear next step with a date, and answers the concern they raised. Under 150 words. Also give me the two-line note to log in my CRM.' },
      ],
    },
    {
      group: 'Systems and CEO',
      items: [
        { t: 'Weekly CEO review', when: 'Every Monday', p: 'Run my weekly CEO review. Last week: revenue [x], new customers [x], leads [x], content posted [x], hours worked [x]. What I did: [list]. What got in the way: [list].\n\nAsk me 3 hard questions about what I am avoiding. Then tell me what to stop, what to keep and what to start, and help me pick 3 priorities for this week. Not ten. Three.' },
        { t: 'Turn a brain dump into a process', when: 'You keep doing the same task', p: 'Here is how I do [task], as a messy brain dump: [paste]. Turn it into a step-by-step process someone else could follow without asking me: purpose, when it happens, tools, steps with checkboxes, what good looks like, and common mistakes. Then mark which steps AI or an automation could do.' },
        { t: 'Find what to automate', when: 'You are the bottleneck', p: 'Last week I spent my time on: [list tasks with rough hours]. My tools: [Notion, Attio, Granola, ManyChat, Shopify, etc.].\n\nRank the top 5 tasks to automate or delegate by hours saved. For each: the simplest way to do it with my tools, roughly how long setup takes, and what could go wrong. Start with the one I could set up today.' },
      ],
    },
  ],
};
