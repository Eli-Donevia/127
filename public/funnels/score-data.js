// Founder Score: questions, scoring and results copy.
// Edit copy here; the page logic lives in score.js.
// reason: the line under "Why you got this score." (conversion/pages/quiz-results.md §4). The server reads this
// file too, so the result email says the same thing as the page.
// The roadmap weeks mirror lib/roadmap.js in the main site (same tracks and steps),
// so what someone sees here matches what their account builds after signup.
window.SCORE = {
  questions: [
    {
      id: 'stage',
      title: 'Where are you right now?',
      sub: 'Be honest. The score is for you.',
      options: [
        { v: 'exploring', label: 'Exploring', sub: "I want to start something but haven't picked an idea" },
        { v: 'validating', label: 'Validating', sub: "I have an idea and I'm testing if people want it" },
        { v: 'launched', label: 'Launched', sub: "I'm selling, under about $1k a month" },
        { v: 'growing', label: 'Growing', sub: 'About $1k to $10k a month' },
        { v: 'scaling', label: 'Scaling', sub: '$10k+ a month and it needs systems' },
      ],
    },
    {
      id: 'focus',
      dim: 'focus',
      title: 'How many ideas or projects are you juggling?',
      options: [
        { v: 'none', label: 'None yet', pts: 6 , reason: "You haven't picked an idea yet. Week 1 is picking one, on purpose." },
        { v: 'one', label: "One. I'm committed.", pts: 20 , reason: "One idea gets all your hours. Keep it that way." },
        { v: 'few', label: 'Two or three', pts: 10 , reason: "Two or three ideas split your hours. Pick the one you can test this week." },
        { v: 'many', label: 'A new one every week', pts: 4 , reason: "A new idea feels like progress. A test is progress." },
      ],
    },
    {
      id: 'talks',
      dim: 'validation',
      title: 'In the last 30 days, how many potential customers have you talked to about their problem?',
      sub: 'Real conversations. Not posts, not likes.',
      options: [
        { v: '0', label: 'None', pts: 2 , reason: "No buyer has told you about the problem yet. 5 conversations change that." },
        { v: '1-4', label: '1 to 4', pts: 9 , reason: "You've started. A few more and you'll hear the same words twice." },
        { v: '5-14', label: '5 to 14', pts: 16 , reason: "You've heard the problem in real words. Use them in your offer." },
        { v: '15+', label: '15 or more', pts: 20 , reason: "You know the problem in your customers' words." },
      ],
    },
    {
      id: 'paid',
      dim: 'proof',
      title: 'Has anyone paid you yet?',
      options: [
        { v: 'no', label: 'No', pts: 2 , reason: "No one has paid yet. Asking for your first $1 is the next proof." },
        { v: 'asked', label: 'Not yet, but people have asked to', pts: 8 , reason: "People asking to pay is a signal. Give them a way to pay." },
        { v: 'some', label: 'Yes, a handful of sales', pts: 15 , reason: "Someone paid. Find out why they said yes, then ask again." },
        { v: 'monthly', label: 'Yes, every month', pts: 20 , reason: "Sales every month is the strongest proof there is." },
      ],
    },
    {
      id: 'reach',
      dim: 'reach',
      title: 'Where would your next 100 customers come from?',
      options: [
        { v: 'unknown', label: 'No idea yet', pts: 3 , reason: "You don't know where buyers will come from yet. Start with people you already know." },
        { v: 'network', label: 'Friends, family and my network', pts: 10 , reason: "Your network is a real first channel. Plan the next one before it runs out." },
        { v: 'posting', label: 'I post, but not consistently', pts: 12 , reason: "The channel is there. Consistency is the gap." },
        { v: 'channel', label: 'A channel that already brings people in', pts: 20 , reason: "You have a channel that works. Measure it so you can grow it." },
      ],
    },
    {
      id: 'hours',
      dim: 'execution',
      title: 'Last week, how much time did you actually put into it?',
      options: [
        { v: 'none', label: 'Honestly, none', pts: 3, time: 'lt3' , reason: "With no hours, nothing moves. Your roadmap starts with the smallest step that counts." },
        { v: 'lt3', label: 'Under 3 hours', pts: 10, time: 'lt3' , reason: "Under 3 hours works if each hour goes to the step that matters. Your roadmap is trimmed to those." },
        { v: '3to10', label: '3 to 10 hours', pts: 16, time: '3to7' , reason: "That's enough to finish each week's steps." },
        { v: '10plus', label: '10+ hours', pts: 20, time: '8to15' , reason: "Time isn't your gap. Put it on your weakest part." },
      ],
    },
    {
      id: 'blocker',
      title: "What's the biggest thing in your way?",
      sub: 'Pick the one that stings.',
      options: [
        { v: 'where_to_start', label: "I don't know where to start" },
        { v: 'offer', label: "My offer isn't clear" },
        { v: 'attention', label: "I can't get attention" },
        { v: 'sales', label: "People look but don't buy" },
        { v: 'time', label: 'Not enough time' },
        { v: 'tools', label: 'Too many tools, not enough progress' },
        { v: 'accountability', label: 'Staying consistent on my own' },
      ],
    },
  ],

  dims: {
    focus: 'Focus',
    validation: 'Validation',
    proof: 'Proof',
    reach: 'Reach',
    execution: 'Execution',
  },

  // One archetype per stage. Principles are Eli's, from his founder intake.
  archetypes: {
    exploring: {
      name: 'Explorer',
      track: 'start',
      tagline: "You want in. You haven't picked your hill yet.",
      strength: "You're not married to a bad idea. You can still choose on purpose.",
      blind: 'Ideating forever. Research feels like progress until a year goes by.',
      principle: "No idea is perfect. Don't ideate for too long.",
      goal: 'pick_idea',
    },
    validating: {
      name: 'Validator',
      track: 'start',
      tagline: "You've got an idea. Now prove someone will pay for it.",
      strength: "You're past dreaming. There's something real to test.",
      blind: 'Building the product before proving the problem.',
      principle: "Solve problems, don't sell products.",
      goal: 'validate',
    },
    launched: {
      name: 'Launcher',
      track: 'build',
      tagline: "You're selling. Now make it consistent.",
      strength: 'You did the thing most people never do: you shipped.',
      blind: 'Doing more of everything instead of more of what works.',
      principle: 'Do more of what works, not just more.',
      goal: 'first_customers',
    },
    growing: {
      name: 'Amplifier',
      track: 'grow',
      tagline: 'Something works. Find out why, then turn it up.',
      strength: 'You have proof. The market has already said yes.',
      blind: 'Chasing new channels before maxing the one that works.',
      principle: "When something works, ask why. Then double down until it doesn't.",
      goal: 'revenue',
    },
    scaling: {
      name: 'Operator',
      track: 'systems',
      tagline: 'The business works. Now it has to work without you.',
      strength: "You built something real. Most founders never see your problems.",
      blind: 'Being the bottleneck in a business that has outgrown you.',
      principle: "Your business is only as valuable as it is when you aren't there to run it.",
      goal: 'systems',
    },
  },

  // "Your #1 move this week", chosen by the weakest dimension.
  moves: {
    focus: {
      title: 'Pick one. Commit for 90 days.',
      body: "There are a million ways to make money. Choose one, get really good at it, and give it a real run before you judge it. Write the one idea you're committing to at the top of your notes today.",
    },
    validation: {
      title: 'Talk to five people who have the problem.',
      body: 'Not friends being nice. People who live the problem. Ask how they handle it today and what they have already paid for. Never pitch. Their words become your offer.',
    },
    proof: {
      title: 'Ask for money before you build more.',
      body: 'A pre-order, a deposit, a paid pilot. One person paying tells you more than a hundred saying "cool idea". Make the offer so good it almost feels unfair to say no.',
    },
    reach: {
      title: 'Pick one channel and show up daily.',
      body: 'Consistency beats talent. Post one piece a day on one platform for 30 days. When one works, ask why, then make more like it.',
    },
    execution: {
      title: 'Block three hours. Put them on the calendar.',
      body: "Progress doesn't need 40 hours. It needs three protected ones, every week, with one clear task. Make today day one.",
    },
  },

  bands: [
    { min: 75, label: 'Ahead of most', note: "You're doing what most founders skip. Now tighten the weakest link." },
    { min: 50, label: 'In motion', note: 'The foundation is forming. One or two habits stand between you and real traction.' },
    { min: 0, label: 'Groundwork', note: "Everyone starts here. The gap is a few habits, not talent. You'll close it fast." },
  ],

  blockerNotes: {
    where_to_start: "You said you don't know where to start. You don't need the whole staircase. Do this week's steps in order.",
    offer: 'Your offer is the lever. Spend extra care on the offer steps; everything downstream gets easier.',
    attention: 'Attention is your bottleneck, so content and outreach show up early.',
    sales: "People look but don't buy. That's usually clarity or trust, not traffic.",
    time: "Time is tight, so the plan keeps only the steps that matter. Three focused hours beat ten scattered ones.",
    tools: 'Fewer tools, more progress. Ignore anything not on this plan for 30 days.',
    accountability: 'Consistency beats intensity. Tell one person your weekly commitment.',
  },

  // Mirrors lib/roadmap.js TRACKS (titles shortened where noted in the site).
  tracks: {
    start: {
      name: 'Start',
      focus: 'Choose the right idea, prove demand and make a first offer.',
      weeks: [
        { theme: 'Choose on purpose', tasks: [
          ['Score your ideas with the Idea Test', 'Rank every idea on the same criteria so you choose with your head, not your mood.'],
          ['Write the problem you solve in one sentence', 'Use words a customer would say, not industry jargon.'],
          ['List 10 people who have this problem', 'Names, not personas. These are your first conversations.'],
        ] },
        { theme: 'Talk to customers', tasks: [
          ['Book five discovery conversations', 'Use the Customer Discovery Interview Script.'],
          ['Run the interviews and take notes in their words', 'Ask about the past, never pitch.'],
          ['Highlight the phrases that came up more than once', 'These become your headline and your offer.'],
        ] },
        { theme: 'Shape the offer', tasks: [
          ['Draft your one-page offer', 'Who it is for, the result, the price, the guarantee.'],
          ['Check that the numbers can work', 'Business Model Worksheet.'],
          ['Read the offer to three people in your audience', 'If they ask what you actually do, rewrite it.'],
        ] },
        { theme: 'Ask for the sale', tasks: [
          ['Outline a simple landing page', 'Landing Page Brief.'],
          ['Personally offer it to your warm list', 'Warm Outreach Scripts.'],
          ['Write down what you learned and what you will change', 'A "no" with a reason is progress.'],
        ] },
      ],
    },
    build: {
      name: 'Build',
      focus: 'Tighten the offer, look credible and run a real launch.',
      weeks: [
        { theme: 'Sharpen the offer', tasks: [
          ['Rewrite your offer on one page', 'The One-Page Offer.'],
          ['Check your pricing and margins', 'Business Model Worksheet.'],
          ['Interview three recent customers or prospects', 'Ask what almost stopped them from buying.'],
        ] },
        { theme: 'Look the part', tasks: [
          ['Create your one-page brand sheet', 'Brand Basics in an Afternoon.'],
          ['Rebuild your landing page from the brief', 'Landing Page Brief.'],
          ['Trim your tools to the simple stack', 'The Simple Operations Stack.'],
        ] },
        { theme: 'Prepare the launch', tasks: [
          ['Work through the launch checklist', 'First Launch Checklist.'],
          ['Plan 30 days of content', '30-Day Content Calendar.'],
          ['Warm up 20 people personally', 'Warm Outreach Scripts.'],
        ] },
        { theme: 'Launch', tasks: [
          ['Launch and message your warm list', 'Personal messages beat broadcast posts on day one.'],
          ['Log every objection you hear', 'They become your FAQ and your next round of content.'],
          ['Set up your weekly scorecard', 'Founder KPI Dashboard.'],
        ] },
      ],
    },
    grow: {
      name: 'Grow',
      focus: 'Build a content engine and turn attention into customers.',
      weeks: [
        { theme: 'Know your numbers', tasks: [
          ['Fill in your first weekly scorecard', 'Founder KPI Dashboard.'],
          ['Talk to your three best customers', 'Find out exactly why they bought.'],
          ['Rewrite your headline in their words', 'The One-Page Offer.'],
        ] },
        { theme: 'Build the content engine', tasks: [
          ['Map your 30-day content calendar', '30-Day Content Calendar.'],
          ['Write ten hooks for your niche', 'Hook & Caption Bank.'],
          ['Batch-create one full week of posts', 'Two focused hours beat seven scattered days.'],
        ] },
        { theme: 'Turn conversations into customers', tasks: [
          ['Send 20 warm outreach messages', 'Warm Outreach Scripts.'],
          ['Fix the biggest leak on your sales page', 'Landing Page Brief.'],
          ['Set a capped test budget for paid reach', 'Launch Budget Calculator.'],
        ] },
        { theme: 'Double down', tasks: [
          ['Compare this week to week one', 'Founder KPI Dashboard.'],
          ['Cut the one activity that produced nothing', 'Growth is mostly subtraction.'],
          ['Plan your next 30 days around what worked', 'Retake the assessment if your stage has changed.'],
        ] },
      ],
    },
    systems: {
      name: 'Build',
      focus: 'Systemize, automate and delegate so the business grows without you.',
      weeks: [
        { theme: 'See the business clearly', tasks: [
          ['Set up your weekly founder scorecard', 'Founder KPI Dashboard.'],
          ['Audit where your hours went last week', 'Delegate Your First Task.'],
          ['Name the single biggest bottleneck', 'If it disappeared, what would grow fastest?'],
        ] },
        { theme: 'Systemize', tasks: [
          ['Document one repeated process', 'Delegate Your First Task.'],
          ['Consolidate your tools', 'The Simple Operations Stack.'],
          ['Pick your first two automations', 'Automation Starter Pack.'],
        ] },
        { theme: 'Automate and delegate', tasks: [
          ['Get two automations running', 'Automation Starter Pack.'],
          ['Hand off your first documented task', 'Review the first three runs, then let go.'],
          ['Model a capped paid-growth test', 'Launch Budget Calculator.'],
        ] },
        { theme: 'Lead', tasks: [
          ['Make the Monday scorecard a ritual', 'Founder KPI Dashboard.'],
          ["Write next quarter's three priorities", 'Three, not ten.'],
          ['Plan founder-led content for the month', '30-Day Content Calendar.'],
        ] },
      ],
    },
  },
};
