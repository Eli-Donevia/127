# The setup

Five tools. Most have free tiers to start.

| Tool | What it does | What 127 uses |
|---|---|---|
| An AI coding agent | Reads your code, writes changes, runs tests, explains what it did | Claude (Claude Code, and Claude projects for planning) |
| A code home | Keeps every version of your code, so nothing is ever lost | GitHub |
| A host | Runs your site on the internet | Replit |
| Payments | Takes cards, Apple Pay and Google Pay, handles subscriptions and refunds | Stripe |
| Email | Sends receipts, sign-in links and updates | Resend |

A database comes with most hosts (127 uses Postgres). You don't need to choose one on day one; ask your AI agent to set it up when you have something to store.

## One shared folder, one memory

Make one folder for everything that isn't code: specs, decisions, research, copy rules. Every AI session reads from it. 127 keeps a short memory file of decisions ("Builder includes every pack", "no income claims, ever") so a fresh AI session starts from what's been decided instead of asking again.

## Your job versus the AI's job

| Yours | The AI's |
|---|---|
| What it should do, and for who | How to build it |
| What "done" looks like | Writing the code and the tests |
| Saying yes or no to anything that can't be undone | Proposing, building, checking its own work |
| Taste: does this look and read like you | Following your written rules every time |

## Prompt: start a project

```text
I'm building [product] for [who]. It needs to: [three to five things it must do].
I don't write code. Pick a simple, common stack I can host on [host], and explain each choice in one sentence.
Then create the project, get a "hello" page running, and write a README that tells a future AI session how to run it and test it.
```
