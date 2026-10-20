<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pitch Deck &middot; {{business.name}}</title>
<style>
:root{--accent:{{brand.color|#111111}};--bg:#E9E8E3}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.viewport{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.stage{position:relative;width:1600px;height:900px;flex:none;transform-origin:center center}
.slide{position:absolute;inset:0;width:1600px;height:900px;background:#FFFFFF;overflow:hidden;
  opacity:0;visibility:hidden;transform:translateY(14px);
  transition:opacity .5s cubic-bezier(.2,.7,.2,1),transform .5s cubic-bezier(.2,.7,.2,1),visibility 0s linear .5s;
  box-shadow:0 1px 2px rgba(0,0,0,.05),0 20px 60px rgba(0,0,0,.08)}
.slide.dark{background:#121214}
.slide.active{opacity:1;visibility:visible;transform:none;transition-delay:0s}
.slide.before{transform:translateY(-14px)}
.t{position:absolute;margin:0;white-space:pre-line;overflow-wrap:break-word}
.r{position:absolute}
.nav{position:fixed;right:18px;bottom:14px;display:flex;gap:6px;align-items:center;font:500 13px/1 Inter,Helvetica,Arial,sans-serif;color:#6E6D67;user-select:none}
.nav button{all:unset;cursor:pointer;width:34px;height:34px;border-radius:17px;display:grid;place-items:center;background:rgba(255,255,255,.75);color:#2A2A27}
.nav button:hover{background:#fff}
.nav button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.nav span{min-width:56px;text-align:center}
.bar{position:fixed;left:0;top:0;height:3px;background:var(--accent);width:0;transition:width .4s ease}
@media (prefers-reduced-motion: reduce){
  .slide,.slide.before{transition:none;transform:none}
  .bar{transition:none}
}
@page{size:1600px 900px;margin:0}
@media print{
  html,body{height:auto;overflow:visible;background:#fff}
  .viewport{position:static;display:block}
  .stage{transform:none !important;width:1600px;height:auto}
  .slide{position:relative;opacity:1 !important;visibility:visible !important;transform:none !important;
    transition:none;box-shadow:none;break-after:page;page-break-after:always}
  .slide:last-child{break-after:auto;page-break-after:auto}
  .nav,.bar{display:none}
}
</style>
</head>
<body>
<div class="bar" id="bar"></div>
<div class="viewport"><div class="stage" id="stage">
<section class="slide" aria-label="Slide 1">
<div class="r" style="left:1440px;top:0px;width:160px;height:900px;background:var(--accent);"></div>
<div class="r" style="left:120px;top:196px;width:72px;height:6px;background:var(--accent);"></div>
<div class="t" style="left:120px;top:236px;width:1200px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:18px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.6px;text-transform:uppercase;">Company overview</div>
<div class="t" style="left:120px;top:282px;width:1240px;font-family:Georgia, 'Times New Roman', serif;font-size:100px;line-height:1.05;font-weight:400;color:#151515;letter-spacing:-2px;">{{business.name}}</div>
<div class="t" style="left:120px;top:500px;width:1100px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:30px;line-height:1.4;font-weight:400;color:#4A4A45;">{{business.what}}</div>
<div class="r" style="left:120px;top:716px;width:1240px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:742px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">Presented by</div>
<div class="t" style="left:120px;top:772px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.25;font-weight:400;color:#151515;">{{owner.first}}</div>
<div class="t" style="left:540px;top:742px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">Contact</div>
<div class="t" style="left:540px;top:772px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.25;font-weight:400;color:#151515;">{{contact.email}}</div>
<div class="t" style="left:960px;top:742px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">Date</div>
<div class="t" style="left:960px;top:772px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.25;font-weight:400;color:#151515;">{{today}}</div>
</section>
<section class="slide" aria-label="Slide 2">
<div class="t" style="left:120px;top:96px;width:900px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:17px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.4px;text-transform:uppercase;">01  The problem</div>
<div class="r" style="left:120px;top:818px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#8A8983;">{{business.name}}</div>
<div class="t" style="left:1180px;top:838px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:400;color:#8A8983;letter-spacing:1px;text-align:right;">02 / 11</div>
<div class="t" style="left:120px;top:156px;width:1220px;font-family:Georgia, 'Times New Roman', serif;font-size:62px;line-height:1.15;font-weight:400;color:#151515;letter-spacing:-1px;">[The problem, in one sentence a customer would actually say.]</div>
<div class="r" style="left:120px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:120px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[Who feels it]</div>
<div class="t" style="left:120px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[The person, and the moment the problem shows up for them.]</div>
<div class="r" style="left:600px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:600px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[What it costs them]</div>
<div class="t" style="left:600px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[Time, money or stress. Use their words, not jargon.]</div>
<div class="r" style="left:1080px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:1080px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[What they try now]</div>
<div class="t" style="left:1080px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[The workarounds people use today, and why they fall short.]</div>
</section>
<section class="slide" aria-label="Slide 3">
<div class="t" style="left:120px;top:96px;width:900px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:17px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.4px;text-transform:uppercase;">02  Who it’s for</div>
<div class="r" style="left:120px;top:818px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#8A8983;">{{business.name}}</div>
<div class="t" style="left:1180px;top:838px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:400;color:#8A8983;letter-spacing:1px;text-align:right;">03 / 11</div>
<div class="t" style="left:120px;top:156px;width:1220px;font-family:Georgia, 'Times New Roman', serif;font-size:80px;line-height:1.15;font-weight:400;color:#151515;letter-spacing:-1px;">{{business.audience}}</div>
<div class="t" style="left:120px;top:400px;width:1100px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:26px;line-height:1.45;font-weight:400;color:#4A4A45;">[One sentence that describes your best customer so clearly they’d recognise themselves.]</div>
<div class="r" style="left:120px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:120px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[Where they are]</div>
<div class="t" style="left:120px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[The place, channel or community where you reach them.]</div>
<div class="r" style="left:600px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:600px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[What they need]</div>
<div class="t" style="left:600px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[The outcome they are looking for, in plain words.]</div>
<div class="r" style="left:1080px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:1080px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[How many there are]</div>
<div class="t" style="left:1080px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[A sourced estimate. Say where the number came from.]</div>
</section>
<section class="slide" aria-label="Slide 4">
<div class="t" style="left:120px;top:96px;width:900px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:17px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.4px;text-transform:uppercase;">03  The solution</div>
<div class="r" style="left:120px;top:818px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#8A8983;">{{business.name}}</div>
<div class="t" style="left:1180px;top:838px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:400;color:#8A8983;letter-spacing:1px;text-align:right;">04 / 11</div>
<div class="t" style="left:120px;top:156px;width:1220px;font-family:Georgia, 'Times New Roman', serif;font-size:80px;line-height:1.15;font-weight:400;color:#151515;letter-spacing:-1px;">{{business.offer}}</div>
<div class="t" style="left:120px;top:400px;width:1100px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:26px;line-height:1.45;font-weight:400;color:#4A4A45;">[One sentence on how it solves the problem on the last slide.]</div>
<div class="r" style="left:120px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:120px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[What it is]</div>
<div class="t" style="left:120px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[Describe it the way you’d explain it to a friend.]</div>
<div class="r" style="left:600px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:600px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[Why it works]</div>
<div class="t" style="left:600px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[The one thing that makes it better than the workaround.]</div>
<div class="r" style="left:1080px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:1080px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[What it replaces]</div>
<div class="t" style="left:1080px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[The tool, habit or service people stop using.]</div>
</section>
<section class="slide" aria-label="Slide 5">
<div class="t" style="left:120px;top:96px;width:900px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:17px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.4px;text-transform:uppercase;">04  How it works</div>
<div class="r" style="left:120px;top:818px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#8A8983;">{{business.name}}</div>
<div class="t" style="left:1180px;top:838px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:400;color:#8A8983;letter-spacing:1px;text-align:right;">05 / 11</div>
<div class="t" style="left:120px;top:156px;width:1200px;font-family:Georgia, 'Times New Roman', serif;font-size:52px;line-height:1.15;font-weight:400;color:#151515;letter-spacing:-1px;">From first hello to done, in three steps.</div>
<div class="r" style="left:120px;top:372px;width:400px;height:350px;background:#F5F4F0;"></div>
<div class="t" style="left:160px;top:408px;width:200px;font-family:Georgia, 'Times New Roman', serif;font-size:56px;line-height:1.25;font-weight:400;color:var(--accent);">01</div>
<div class="r" style="left:160px;top:520px;width:320px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:160px;top:548px;width:320px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:25px;line-height:1.3;font-weight:700;color:#151515;">[Step one]</div>
<div class="t" style="left:160px;top:592px;width:320px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.5;font-weight:400;color:#4A4A45;">[What the customer does, and what you do.]</div>
<div class="r" style="left:600px;top:372px;width:400px;height:350px;background:#F5F4F0;"></div>
<div class="t" style="left:640px;top:408px;width:200px;font-family:Georgia, 'Times New Roman', serif;font-size:56px;line-height:1.25;font-weight:400;color:var(--accent);">02</div>
<div class="r" style="left:640px;top:520px;width:320px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:640px;top:548px;width:320px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:25px;line-height:1.3;font-weight:700;color:#151515;">[Step two]</div>
<div class="t" style="left:640px;top:592px;width:320px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.5;font-weight:400;color:#4A4A45;">[Where the real work happens.]</div>
<div class="r" style="left:1080px;top:372px;width:400px;height:350px;background:#F5F4F0;"></div>
<div class="t" style="left:1120px;top:408px;width:200px;font-family:Georgia, 'Times New Roman', serif;font-size:56px;line-height:1.25;font-weight:400;color:var(--accent);">03</div>
<div class="r" style="left:1120px;top:520px;width:320px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:1120px;top:548px;width:320px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:25px;line-height:1.3;font-weight:700;color:#151515;">[Step three]</div>
<div class="t" style="left:1120px;top:592px;width:320px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.5;font-weight:400;color:#4A4A45;">[What the customer has at the end.]</div>
</section>
<section class="slide" aria-label="Slide 6">
<div class="t" style="left:120px;top:96px;width:900px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:17px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.4px;text-transform:uppercase;">05  Why now</div>
<div class="r" style="left:120px;top:818px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#8A8983;">{{business.name}}</div>
<div class="t" style="left:1180px;top:838px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:400;color:#8A8983;letter-spacing:1px;text-align:right;">06 / 11</div>
<div class="t" style="left:120px;top:156px;width:1220px;font-family:Georgia, 'Times New Roman', serif;font-size:62px;line-height:1.15;font-weight:400;color:#151515;letter-spacing:-1px;">[What changed that makes this the right time.]</div>
<div class="r" style="left:120px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:120px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[A shift in the market]</div>
<div class="t" style="left:120px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[Something you can point to, with a source.]</div>
<div class="r" style="left:600px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:600px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[A change in behaviour]</div>
<div class="t" style="left:600px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[How customers buy or decide differently now.]</div>
<div class="r" style="left:1080px;top:560px;width:56px;height:4px;background:var(--accent);"></div>
<div class="t" style="left:1080px;top:590px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:#151515;">[Why you, why now]</div>
<div class="t" style="left:1080px;top:632px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;line-height:1.5;font-weight:400;color:#4A4A45;">[What you can do today that wasn’t possible before.]</div>
</section>
<section class="slide" aria-label="Slide 7">
<div class="t" style="left:120px;top:96px;width:900px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:17px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.4px;text-transform:uppercase;">06  Traction</div>
<div class="r" style="left:120px;top:818px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#8A8983;">{{business.name}}</div>
<div class="t" style="left:1180px;top:838px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:400;color:#8A8983;letter-spacing:1px;text-align:right;">07 / 11</div>
<div class="t" style="left:120px;top:156px;width:1200px;font-family:Georgia, 'Times New Roman', serif;font-size:52px;line-height:1.15;font-weight:400;color:#151515;letter-spacing:-1px;">Where things stand today.</div>
<div class="r" style="left:120px;top:380px;width:400px;height:2px;background:#151515;"></div>
<div class="t" style="left:120px;top:412px;width:400px;font-family:Georgia, 'Times New Roman', serif;font-size:72px;line-height:1.1;font-weight:400;color:var(--accent);letter-spacing:-1px;">[Number]</div>
<div class="t" style="left:120px;top:530px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.4;font-weight:400;color:#4A4A45;">[Customers served so far]</div>
<div class="r" style="left:600px;top:380px;width:400px;height:2px;background:#151515;"></div>
<div class="t" style="left:600px;top:412px;width:400px;font-family:Georgia, 'Times New Roman', serif;font-size:72px;line-height:1.1;font-weight:400;color:var(--accent);letter-spacing:-1px;">[Number]</div>
<div class="t" style="left:600px;top:530px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.4;font-weight:400;color:#4A4A45;">[Repeat or referral rate]</div>
<div class="r" style="left:1080px;top:380px;width:400px;height:2px;background:#151515;"></div>
<div class="t" style="left:1080px;top:412px;width:400px;font-family:Georgia, 'Times New Roman', serif;font-size:72px;line-height:1.1;font-weight:400;color:var(--accent);letter-spacing:-1px;">[Number]</div>
<div class="t" style="left:1080px;top:530px;width:400px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.4;font-weight:400;color:#4A4A45;">[Monthly revenue, if you share it]</div>
<div class="r" style="left:120px;top:672px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:696px;width:1100px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.5;font-weight:400;color:#8A8983;">[Real numbers only, with the date they’re from. If it’s early, show what you’ve tested and learned instead, and delete the boxes you can’t fill honestly.]</div>
</section>
<section class="slide" aria-label="Slide 8">
<div class="t" style="left:120px;top:96px;width:900px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:17px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.4px;text-transform:uppercase;">07  Business model</div>
<div class="r" style="left:120px;top:818px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#8A8983;">{{business.name}}</div>
<div class="t" style="left:1180px;top:838px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:400;color:#8A8983;letter-spacing:1px;text-align:right;">08 / 11</div>
<div class="t" style="left:120px;top:156px;width:660px;font-family:Georgia, 'Times New Roman', serif;font-size:52px;line-height:1.15;font-weight:400;color:#151515;letter-spacing:-1px;">How the business makes money.</div>
<div class="t" style="left:120px;top:360px;width:700px;font-family:Georgia, 'Times New Roman', serif;font-size:84px;line-height:1.1;font-weight:400;color:var(--accent);letter-spacing:-1px;">{{business.price}}</div>
<div class="t" style="left:120px;top:476px;width:660px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.4;font-weight:400;color:#8A8983;">[Per visit, per order, per month or per project]</div>
<div class="r" style="left:880px;top:170px;width:600px;height:1px;background:#151515;"></div>
<div class="t" style="left:880px;top:196px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">Who pays</div>
<div class="t" style="left:880px;top:228px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.4;font-weight:400;color:#151515;">[The customer, a partner, or both]</div>
<div class="r" style="left:880px;top:340px;width:600px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:880px;top:366px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">How often</div>
<div class="t" style="left:880px;top:398px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.4;font-weight:400;color:#151515;">[Once, monthly, seasonal or on repeat]</div>
<div class="r" style="left:880px;top:510px;width:600px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:880px;top:536px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">Cost to deliver</div>
<div class="t" style="left:880px;top:568px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.4;font-weight:400;color:#151515;">[Roughly what one sale costs you to deliver]</div>
<div class="r" style="left:880px;top:680px;width:600px;height:1px;background:#E4E2DC;"></div>
</section>
<section class="slide" aria-label="Slide 9">
<div class="t" style="left:120px;top:96px;width:900px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:17px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.4px;text-transform:uppercase;">08  Competition</div>
<div class="r" style="left:120px;top:818px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#8A8983;">{{business.name}}</div>
<div class="t" style="left:1180px;top:838px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:400;color:#8A8983;letter-spacing:1px;text-align:right;">09 / 11</div>
<div class="t" style="left:120px;top:156px;width:1200px;font-family:Georgia, 'Times New Roman', serif;font-size:48px;line-height:1.15;font-weight:400;color:#151515;letter-spacing:-1px;">What people use today, and where we fit.</div>
<div class="t" style="left:144px;top:334px;width:380px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">Option</div>
<div class="t" style="left:520px;top:334px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">[What matters 1]</div>
<div class="t" style="left:840px;top:334px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">[What matters 2]</div>
<div class="t" style="left:1160px;top:334px;width:320px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">[What matters 3]</div>
<div class="r" style="left:120px;top:376px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:144px;top:410px;width:356px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.25;font-weight:700;color:#151515;">[Alternative one]</div>
<div class="t" style="left:520px;top:412px;width:280px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#4A4A45;">[Short note]</div>
<div class="t" style="left:840px;top:412px;width:280px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#4A4A45;">[Short note]</div>
<div class="t" style="left:1160px;top:412px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#4A4A45;">[Short note]</div>
<div class="r" style="left:120px;top:474px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:144px;top:508px;width:356px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.25;font-weight:700;color:#151515;">[Alternative two]</div>
<div class="t" style="left:520px;top:510px;width:280px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#4A4A45;">[Short note]</div>
<div class="t" style="left:840px;top:510px;width:280px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#4A4A45;">[Short note]</div>
<div class="t" style="left:1160px;top:510px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#4A4A45;">[Short note]</div>
<div class="r" style="left:120px;top:572px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:144px;top:606px;width:356px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.25;font-weight:700;color:#151515;">Doing it themselves</div>
<div class="t" style="left:520px;top:608px;width:280px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#4A4A45;">[Short note]</div>
<div class="t" style="left:840px;top:608px;width:280px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#4A4A45;">[Short note]</div>
<div class="t" style="left:1160px;top:608px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#4A4A45;">[Short note]</div>
<div class="r" style="left:120px;top:670px;width:1360px;height:98px;background:#F5F4F0;"></div>
<div class="r" style="left:120px;top:670px;width:6px;height:98px;background:var(--accent);"></div>
<div class="t" style="left:144px;top:704px;width:356px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;line-height:1.25;font-weight:700;color:#151515;">{{business.name}}</div>
<div class="t" style="left:520px;top:706px;width:280px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#151515;">[Short note]</div>
<div class="t" style="left:840px;top:706px;width:280px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#151515;">[Short note]</div>
<div class="t" style="left:1160px;top:706px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#151515;">[Short note]</div>
</section>
<section class="slide" aria-label="Slide 10">
<div class="t" style="left:120px;top:96px;width:900px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:17px;line-height:1.25;font-weight:700;color:var(--accent);letter-spacing:2.4px;text-transform:uppercase;">09  The ask</div>
<div class="r" style="left:120px;top:818px;width:1360px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#8A8983;">{{business.name}}</div>
<div class="t" style="left:1180px;top:838px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:400;color:#8A8983;letter-spacing:1px;text-align:right;">10 / 11</div>
<div class="t" style="left:120px;top:156px;width:860px;font-family:Georgia, 'Times New Roman', serif;font-size:66px;line-height:1.12;font-weight:400;color:#151515;letter-spacing:-1px;">[What you’re asking for: an amount, a partner or an introduction.]</div>
<div class="t" style="left:120px;top:470px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.5;font-weight:400;color:#4A4A45;">[What it gets the business to, in one sentence. Name a milestone you control, not a promise.]</div>
<div class="t" style="left:1060px;top:164px;width:420px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#8A8983;letter-spacing:2px;text-transform:uppercase;">What it’s for</div>
<div class="r" style="left:1060px;top:200px;width:420px;height:1px;background:#151515;"></div>
<div class="t" style="left:1060px;top:228px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.25;font-weight:700;color:#151515;">[Use one]</div>
<div class="t" style="left:1060px;top:266px;width:420px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#8A8983;">[Share or amount]</div>
<div class="r" style="left:1060px;top:330px;width:420px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:1060px;top:358px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.25;font-weight:700;color:#151515;">[Use two]</div>
<div class="t" style="left:1060px;top:396px;width:420px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#8A8983;">[Share or amount]</div>
<div class="r" style="left:1060px;top:460px;width:420px;height:1px;background:#E4E2DC;"></div>
<div class="t" style="left:1060px;top:488px;width:300px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;line-height:1.25;font-weight:700;color:#151515;">[Use three]</div>
<div class="t" style="left:1060px;top:526px;width:420px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:19px;line-height:1.25;font-weight:400;color:#8A8983;">[Share or amount]</div>
<div class="r" style="left:1060px;top:590px;width:420px;height:1px;background:#E4E2DC;"></div>
</section>
<section class="slide dark" aria-label="Slide 11">
<div class="r" style="left:120px;top:196px;width:72px;height:6px;background:#FFFFFF;"></div>
<div class="t" style="left:120px;top:236px;width:1300px;font-family:Georgia, 'Times New Roman', serif;font-size:108px;line-height:1.05;font-weight:400;color:#FFFFFF;letter-spacing:-2px;">Thank you.</div>
<div class="t" style="left:120px;top:384px;width:1000px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:26px;line-height:1.45;font-weight:400;color:#B4B3AD;">[One line on what you’d like to happen next, e.g. a second call this month.]</div>
<div class="r" style="left:120px;top:540px;width:600px;height:1px;background:#85847E;"></div>
<div class="t" style="left:120px;top:564px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#85847E;letter-spacing:2px;text-transform:uppercase;">Name</div>
<div class="t" style="left:120px;top:594px;width:640px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:28px;line-height:1.25;font-weight:400;color:#FFFFFF;">{{owner.first}}</div>
<div class="r" style="left:800px;top:540px;width:600px;height:1px;background:#85847E;"></div>
<div class="t" style="left:800px;top:564px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#85847E;letter-spacing:2px;text-transform:uppercase;">Email</div>
<div class="t" style="left:800px;top:594px;width:640px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:28px;line-height:1.25;font-weight:400;color:#FFFFFF;">{{contact.email}}</div>
<div class="r" style="left:120px;top:664px;width:600px;height:1px;background:#85847E;"></div>
<div class="t" style="left:120px;top:688px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#85847E;letter-spacing:2px;text-transform:uppercase;">Phone</div>
<div class="t" style="left:120px;top:718px;width:640px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:28px;line-height:1.25;font-weight:400;color:#FFFFFF;">{{contact.phone}}</div>
<div class="r" style="left:800px;top:664px;width:600px;height:1px;background:#85847E;"></div>
<div class="t" style="left:800px;top:688px;width:600px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;line-height:1.25;font-weight:700;color:#85847E;letter-spacing:2px;text-transform:uppercase;">Website</div>
<div class="t" style="left:800px;top:718px;width:640px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:28px;line-height:1.25;font-weight:400;color:#FFFFFF;">{{links.website}}</div>
<div class="t" style="left:120px;top:838px;width:800px;font-family:Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:1.25;font-weight:600;color:#85847E;">{{business.name}}</div>
</section>
</div></div>
<div class="nav" aria-label="Slide controls">
<button id="prev" aria-label="Previous slide">&#8592;</button><span id="count">1 / 1</span><button id="next" aria-label="Next slide">&#8594;</button>
</div>
<script>
(function(){
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  var stage=document.getElementById('stage'),count=document.getElementById('count'),bar=document.getElementById('bar');
  var i=0;
  function fit(){var s=Math.min(window.innerWidth/1600,window.innerHeight/900);stage.style.transform='scale('+s+')';}
  function show(n){
    i=Math.max(0,Math.min(slides.length-1,n));
    slides.forEach(function(el,k){el.classList.toggle('active',k===i);el.classList.toggle('before',k<i);el.setAttribute('aria-hidden',k===i?'false':'true');});
    count.textContent=(i+1)+' / '+slides.length;
    bar.style.width=((i+1)/slides.length*100)+'%';
    if(history.replaceState)history.replaceState(null,'','#'+(i+1));
  }
  function fromHash(){var n=parseInt((location.hash||'').slice(1),10);return isNaN(n)?0:n-1;}
  document.addEventListener('keydown',function(e){
    var k=e.key;
    if(k==='ArrowRight'||k==='ArrowDown'||k==='PageDown'||k===' '||k==='Enter'){e.preventDefault();show(i+1);}
    else if(k==='ArrowLeft'||k==='ArrowUp'||k==='PageUp'||k==='Backspace'){e.preventDefault();show(i-1);}
    else if(k==='Home'){show(0);}else if(k==='End'){show(slides.length-1);}
  });
  var x0=null,y0=null;
  document.addEventListener('touchstart',function(e){x0=e.touches[0].clientX;y0=e.touches[0].clientY;},{passive:true});
  document.addEventListener('touchend',function(e){
    if(x0===null)return;var dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;
    if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){show(dx<0?i+1:i-1);}x0=null;
  },{passive:true});
  document.getElementById('prev').onclick=function(){show(i-1);};
  document.getElementById('next').onclick=function(){show(i+1);};
  window.addEventListener('resize',fit);
  window.addEventListener('hashchange',function(){var n=fromHash();if(n!==i)show(n);});
  fit();show(fromHash());
})();
</script>
</body>
</html>
