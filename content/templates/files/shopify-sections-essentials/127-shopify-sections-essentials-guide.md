# How to install these sections

About 10 minutes for all eight. You need a computer; the code editor is not in the Shopify phone app.

## Before you start: duplicate your theme

1. In Shopify admin, go to **Online Store > Themes**.
2. Next to your current theme, click the **...** button, then **Duplicate**.
3. Work on the copy. When you're happy, publish it. Your live store stays untouched until then.

## Add a section (repeat for each file)

1. On the copy, click **...** then **Edit code**.
2. In the file list on the left, find the **Sections** folder and click **Add a new section**.
3. Type the file name without `.liquid` (for example `hero-split`) and click **Done**.
4. Select everything in the new file and delete it.
5. Open the matching file from this pack (for example `sections/hero-split.liquid`), copy all of it, and paste it in.
6. Click **Save**. If Shopify shows an error, check you pasted the whole file, from the first line to `{% endschema %}`.

If your theme already has a section with the same name, use a new name in step 3, such as `hero-split-2`.

## Put it on a page

1. Go back to **Online Store > Themes** and click **Customize** on the copy.
2. Pick the page at the top (Home page, a product page, and so on).
3. In the left panel, click **Add section** and choose the section by name (for example **Hero split**).
4. Click into it to change text, images, colors and spacing. Drag it up or down to move it.
5. Click **Save**.

The announcement marquee also works at the very top of the page: add it to the **Header** group with **Add section** there.

## Option for developers: Shopify CLI

If you use Shopify CLI, copy the `sections` folder into your theme folder and push only these files:

```
shopify theme push --only sections/hero-split.liquid --only sections/trust-bar.liquid
```

Add one `--only sections/<name>.liquid` for each section you want. Push to an unpublished theme first (for example with `--unpublished` or `--theme <id>`), check it, then publish.

## After installing

- Replace placeholder images. In each testimonial card, add a real review you have permission to use.
- Test the email signup once with your own email, then find yourself in **Customers**.
- Check each section on a phone using the device toggle at the top of the theme editor.

*Shopify menu names change from time to time. These steps were checked in October 2026.*
