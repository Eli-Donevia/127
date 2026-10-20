// README.txt inside the ZIP: how to put the site online for free, turn on the form, swap in photos
// and connect a domain. Plain text a first-time founder can follow. Hosting facts come from
// data/hosting.json (verified, with sources), never from memory.

const hosting = require('../data/hosting.json');

const SIZE_WORD = (w, h) => (w === h ? 'square' : h > w ? 'tall' : 'wide');

// mode: 'me' (the member's own site), 'prospect' (a free sample to show a business) or 'client'
// (a paying client's site, set up on the client's own accounts).
function readme(c, { files = [], rendered = true, today, longDate, mode = 'me', maker = '', blockers = [] } = {}) {
  const n = hosting.netlify;
  const lines = [];
  const L = (s = '') => lines.push(s);
  const host = c.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const onNetlify = /\.netlify\.app$/.test(host);
  if (mode === 'prospect') {
    L(`SAMPLE WEBSITE FOR ${c.name}`);
    L(`Made ${longDate || today}${maker ? ` by ${maker}` : ''} as a free sample. It is not their live website, and the page says so at the top.`);
    L();
    L('BEFORE YOU SHOW IT');
    L('1. Check every line against their own website, Google profile and menu. Fix anything out of date.');
    L('2. The color art stands in for their photos. Neither the art nor any line marked sample is a fact about them.');
    L("3. Show it, don't publish it: send the preview file or a screenshot. If you put it on a Netlify link to show them, delete that site afterwards. Never use their name or domain online without their yes.");
    L();
    L('IF THEY SAY YES');
    L('Build it again as a client site with their real words, photos and prices. Put it on their own Netlify account and domain so they own it, then follow the steps below with them.');
    L();
  } else if (mode === 'client') {
    L(`WEBSITE FOR ${c.name}`);
    L(`Made ${longDate || today}. Set it up on ${c.name}'s own accounts so they own it: their Netlify account, their domain and their email for form messages. Ask them to add you as a team member if you look after it.`);
    L('Wherever the steps below say your account, your email or your name, use theirs.');
    L();
  } else {
    L(`YOUR WEBSITE: ${c.name}`);
    L(`Made ${longDate || today}. Everything in this folder is yours to keep, change and move.`);
    L();
  }
  if (blockers.length) {
    // Legal L76 W1, W3: not online until these are in. The pages show a [bracketed] gap where each one goes.
    L('NOT READY TO GO ONLINE YET');
    blockers.forEach((b, i) => L(`${i + 1}. ${b}`));
    L('Build it again with these filled in before you put it online.');
    L();
  }
  if (mode !== 'prospect') {
    // Legal L76 W1: the starter label shows to the member, never on the page.
    L('YOUR PRIVACY NOTICE (privacy.html)');
    L(require('./privacy').STARTER_LABEL);
    if (c.buy) L('Your shipping and returns page (policies.html) uses your own words. Keep both true as your store changes.');
    if (c.chat) L(`Your privacy notice names 127's site chat, which this site shows. In HQ, Site chat, give ${c.siteUrl.replace(/\/$/, '')}/privacy.html as your privacy page.`);
    L();
  }
  L('PUT IT ONLINE IN 5 MINUTES (free, on Netlify)');
  L(`1. Open ${n.dropUrl} in your browser.`);
  L('2. Drag this whole folder (or the ZIP file itself) onto the page.');
  L('3. Netlify gives you a working link in a few seconds. Sign up free (email, Google or GitHub) to claim it. An unclaimed site stays private behind a password and is deleted after a while.');
  if (onNetlify) {
    L(`4. Give it your name: in your site, open Site configuration, then Change site name, and type ${c.slug}. Your address becomes ${c.siteUrl}`);
    L('   That address is already written into your search and sharing tags. If the name is taken, pick another one and run the workflow again with that address in the Your domain box.');
  } else {
    L(`4. Connect ${host}: in your site, open Domain management, then Add a domain, and follow the steps. Netlify adds free HTTPS.`);
  }
  L();
  const hasForm = /data-netlify/.test(files.find((f) => f.name === 'index.html')?.text || '');
  if (hasForm) {
    L('TURN ON YOUR CONTACT FORM (2 minutes)');
    L('1. In Netlify, open your site, then Forms, then Enable form detection.');
    L("2. Drag this folder onto your site's Deploys page again. (Not the main sites list: that makes a second site.)");
    L('3. Forms, then Submission notifications: add your email so every message lands in your inbox.');
    L(`Form messages are ${n.freePlan.formSubmissions} (checked ${hosting.checked}). Spam is filtered for you, and a hidden trap field catches most bots.`);
    L('Hosting somewhere else? The form only works on Netlify. Run the workflow again with Form set to email and it opens the visitor\'s email app instead.');
    L();
  }
  const imgs = Object.values(c.images || {});
  if (imgs.length) {
    L(mode === 'me' ? 'ADD YOUR PHOTOS' : 'PHOTOS TO ADD (ask them for these)');
    L('The color art is a placeholder. Replace each file in the images folder with your own photo and keep the exact same name:');
    for (const im of imgs) L(`- ${im.src} (${im.w} x ${im.h}, ${SIZE_WORD(im.w, im.h)}): ${im.alt}`);
    if (!rendered) L('These placeholders are .svg files. Save your photos as .jpg with the same name, then change the file names in index.html to match.');
    L("Then drag the folder onto your site's Deploys page again. Use photos you took or have permission to use, and ask before you post anyone's face.");
    L('If a photo shows something different from the description above, update the alt text in index.html (the words after alt=) so screen readers describe it right.');
    L();
  }
  L('CHANGE THE WORDS');
  L('Open index.html in a plain text editor (TextEdit on a Mac, Notepad on Windows), change the words between the tags, save, and drag the folder onto your Deploys page again. Or run the workflow again in 127 and approve new words.');
  L();
  L('WHAT IS IN THIS FOLDER');
  const what = {
    'index.html': 'your website',
    'thanks.html': 'where people land after they send the form',
    '404.html': 'shown when someone types a wrong address',
    'favicon.svg': 'the small icon in browser tabs',
    'favicon.ico': 'the same icon for older browsers',
    'apple-touch-icon.png': 'the icon when someone saves your site to their phone',
    'og-image.png': 'the picture shown when your link is shared in texts and on social media',
    'og-image.svg': 'the same share picture as an editable vector file',
    'robots.txt': 'tells search engines they may read your site',
    'sitemap.xml': 'helps Google find your page',
    _headers: 'safe browser settings that Netlify and Cloudflare Pages read',
    'motion.js': "the small animation library your page's motion uses (Motion, MIT license), kept with your site so nothing loads from another company",
    'motion-LICENSE.txt': 'the license for motion.js; it has to stay with it',
  };
  for (const f of files) if (what[f.name]) L(`- ${f.name}: ${what[f.name]}`);
  if (imgs.length) L('- images/: your photos (placeholders for now)');
  if (files.some((f) => f.name.startsWith('fonts/'))) L("- fonts/: your site's own fonts, so nothing loads from another company. Each font's license file has to stay with it.");
  L();
  L(`FREE HOSTING LIMITS (checked ${hosting.checked})`);
  const fp = n.freePlan;
  L(`Netlify Free: ${fp.creditsPerMonth} credits a month, and it is a hard limit (no surprise bill). Each new version you publish uses ${fp.productionDeployCredits} credits, so save up changes and publish them together. Bandwidth uses ${fp.bandwidthCreditsPerGB} credits per GB and web requests ${fp.webRequestCreditsPer10k} credits per 10,000. If credits run out, ${fp.whenCreditsRunOut}.`);
  L(`Sources: ${fp.sources.join(' , ')}`);
  L();
  L('OTHER FREE HOSTS');
  const cf = hosting.cloudflarePages;
  L(`Cloudflare Pages: ${cf.steps} Drag and drop takes up to ${cf.dragAndDropMaxFiles} files, ${cf.maxFileMiB} MiB each. Static sites are ${cf.freePlan.staticRequests}. ${cf.forms}`);
  const gh = hosting.githubPages;
  L(`GitHub Pages: ${gh.steps} It needs a public repository on the free plan. ${gh.commercialUse} For a business site, use Netlify or Cloudflare Pages.`);
  L(`Sources: ${[...cf.sources, ...gh.sources].join(' , ')}`);
  L();
  L('YOUR OWN DOMAIN (optional, later)');
  L('Buy a .com from any domain registrar. In Netlify: Domain management, then Add a domain, then follow the steps. Then run the workflow again with your domain in the Your domain box so your search and sharing tags use it.');
  return `${lines.join('\n')}\n`;
}

module.exports = { readme };
