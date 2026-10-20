# How to set up the CRM in Notion

Contacts, Deals and Activities as Notion databases, with a home page that links them.

## Import it (about 5 minutes, on a computer)

Notion import is not in the phone app.

1. Download **127-notion-crm.zip**. Do not unzip it.
2. In Notion, open **Settings**, then **Import**. (You can also click **Import** near the bottom of the sidebar.)
3. Choose **Text & Markdown** and pick the ZIP. Markdown files become pages and CSV files become databases inside them.
4. Wait for the import to finish, then open **CRM** in your sidebar. Drag it to where you want it in your workspace.

If the ZIP import puts the databases somewhere odd, import each CSV on its own: **Settings > Import > CSV**. Each one becomes its own database. Then drag it onto the home page.

## Set up first (10 minutes)

Notion brings every CSV column in as text. Change these property types by clicking the column name, then **Edit property > Type**.

**Contacts**
- Email: **Email**. Phone: **Phone**. Last contacted: **Date**.
- Source: **Select** (Referral, Walk-in, Instagram, Website, Google, add your own).
- Tags: **Multi-select** (Lead, Client, Partner).

**Deals**
- Stage: **Select**. Use exactly these options in this order: New, Talking, Proposal sent, Won, Lost.
- Value: **Number**, then pick your currency under Number format.
- Next step date: **Date**. Source: **Select**, with the same options as Contacts.
- Contact: **Relation** to Contacts. Notion can't import relations, so check each row links to the right person.

**Activities**
- Type: **Select** (Call, Email, Message, Meeting). Date and Follow-up date: **Date**.
- Contact: **Relation** to Contacts. Deal: **Relation** to Deals.

## Then add two views

1. In Deals, click **+** next to the view name, choose **Board**, and group by Stage. Drag cards as deals move.
2. Add a **Table** view called "Due this week": filter Stage is not Won or Lost, sort by Next step date.

## Last step

Delete the rows marked (example) once you've added a few real ones.

*Notion menu names change. These steps were checked in October 2026.*
