# Write the spec first

The single biggest difference between AI builds that work and ones that wander: a written spec before any code. It takes ten minutes and saves days.

## The spec template

Every piece of 127 starts from a page like this:

```text
# [Feature name]

One line: what it is and who it's for.

What the person can do when it's done:
- [action, in their words]
- [action]

Done when:
- [something anyone can check: "a guest can buy a pack on a phone and open the files"]

What stays the same:
- [things this must not break]

Rules:
- [copy rules, design rules, legal lines that apply]

Open questions, and who answers each:
- [question] (me / a lawyer / the AI can decide)
```

## Talk it, then tidy it

You don't have to type it. Record a voice note describing what you want, rambling is fine, and have the AI turn it into the template. Then read it and fix anything it got wrong. That correction is the most valuable five minutes of the build.

## Prompt: voice note to spec

```text
Here's a voice note transcript describing a feature I want: [paste].

Turn it into a spec with these sections: one line; what the person can do when it's done; done when (checkable); what stays the same; rules; open questions with who answers each.
Don't invent features I didn't mention. List anything you had to guess under open questions.
```
