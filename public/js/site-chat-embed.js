// 127 site chat for a member's website. Add once per page:
//   <script src="https://127group.io/js/site-chat-embed.js" data-chat="YOUR-CODE" async></script>
// A button opens the chat in a frame served by 127. Nothing else is loaded, and nothing runs until it's opened.
(function () {
  var me = document.currentScript || document.querySelector('script[data-chat]');
  if (!me || window.__site127chat) return;
  window.__site127chat = true;
  var key = me.getAttribute('data-chat') || '';
  if (!/^[a-f0-9]{32}$/.test(key)) return;
  var origin = new URL(me.src, location.href).origin;
  var page = location.origin + location.pathname;

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Chat';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Open chat (AI assistant)');
  btn.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483000;border:0;border-radius:999px;padding:12px 18px;font:600 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#16171a;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.25);cursor:pointer';

  var box = null;
  btn.addEventListener('click', function () {
    if (!box) {
      box = document.createElement('iframe');
      box.title = 'Chat (AI assistant)';
      box.src = origin + '/site-chat/c/' + key + '?page=' + encodeURIComponent(page);
      box.style.cssText = 'position:fixed;right:18px;bottom:76px;z-index:2147483000;width:min(380px,calc(100vw - 36px));height:min(560px,calc(100vh - 110px));border:1px solid rgba(0,0,0,.12);border-radius:16px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.25)';
      document.body.appendChild(box);
      btn.textContent = 'Close';
      btn.setAttribute('aria-expanded', 'true');
      return;
    }
    var open = box.style.display !== 'none';
    box.style.display = open ? 'none' : '';
    btn.textContent = open ? 'Chat' : 'Close';
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
  });
  (document.body || document.documentElement).appendChild(btn);
})();
