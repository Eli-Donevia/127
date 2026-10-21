# One thread per job, one place that ships

A single long AI conversation forgets things and tangles work together. 127 runs as a project of separate threads, each owning one job, with one coordinator that keeps the whole picture.

## How the work is split

- **A coordinator** talks with the founder, starts threads, and passes decisions between them.
- **One thread per job**: the website, payments, the packs, the member workspace, legal drafts, brand, emails. Each has its own spec and its own branch of the code.
- **One thread ships.** Only one thread merges code and publishes the live site. Every other thread hands over its work as a finished, tested change. Two agents publishing at once is how live sites break.
- **A legal thread** reads anything that makes a promise, takes money, collects data or adds a new outside service, before it goes live.

## The handoff

When a thread finishes, it hands over:

1. What changed, in two or three sentences.
2. How to switch it on, and what stays off.
3. What was tested, and the test results.
4. What still needs a human decision.

## Decisions that need you

Let the AI do anything that can be undone: write code, open a draft, run a test, make a preview. Keep for yourself anything that can't be undone or that speaks for you in public: publishing, spending money, emailing customers, changing live data.

## Prompt: coordinator instructions

```text
You're the coordinator for my project, [product]. Your job: keep the big picture, split work into separate threads (one job each), pass decisions between them, and keep a short memory file of every decision I make.

Rules:
- Only the [website] thread merges code and publishes.
- Anything that spends money, publishes, emails customers or changes live data waits for my explicit yes.
- Anything that adds an outside service or makes a promise to customers gets a legal read first.
- Keep me updated in short messages: what's done, what needs me.

Start by listing the threads you'd create for [product] and one line on what each owns.
```
