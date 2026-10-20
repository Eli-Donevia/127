# How to set up the SOP Wiki in Notion

A home page, an SOP template, six starter SOPs for a service business and an owners and review dates table.

## Import it (about 5 minutes, on a computer)

Notion import is not in the phone app.

1. Download **127-notion-sop-wiki.zip**. Do not unzip it.
2. In Notion, open **Settings**, then **Import**. (You can also click **Import** near the bottom of the sidebar.)
3. Choose **Text & Markdown** and pick the ZIP. Markdown files become pages and CSV files become databases inside them.
4. Wait for the import to finish, then open **SOP Wiki** in your sidebar. Drag it to where you want it in your workspace.

If the ZIP import puts the databases somewhere odd, import each CSV on its own: **Settings > Import > CSV**. Each one becomes its own database. Then drag it onto the home page.

## Set up first (10 minutes)

Open **SOP Owners** and change these property types (click the column name, then **Edit property > Type**):

- Owner and Backup: **Person**. Notion can't import people, so pick each person again.
- Last reviewed: **Date**.
- Status: **Select** (Draft, Live, Needs update).
- Next review: **Formula**. Paste `dateAdd(prop("Last reviewed"), 90, "days")` so the next review date fills in by itself.

Then sort SOP Owners by Next review, so the oldest SOP is at the top.

## Make the starter SOPs yours

1. Open each SOP and replace everything in [brackets] with how you really do it.
2. Delete steps you don't do. Add the ones you do. Keep one action per step.
3. When an SOP is right, set its Status to Live in SOP Owners.
4. For a new SOP, open **SOP Template**, click **...** and choose **Duplicate**, then rename it and add a row to SOP Owners.

Optional: drag each SOP page into the SOP Owners table to make the pages rows of the database, so owner and review date sit on the page itself.

*Notion menu names change. These steps were checked in October 2026.*
