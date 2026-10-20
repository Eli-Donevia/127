// Site chat, inside a member's website (views/site-chat-frame.ejs). Posts to its own origin only.
(function () {
  var root = document.getElementById('chat');
  if (!root) return;
  var key = root.getAttribute('data-key');
  var page = root.getAttribute('data-page') || '';
  var log = document.getElementById('log');
  var say = document.getElementById('say');
  var text = document.getElementById('text');
  var contact = document.getElementById('contact');
  var leaveWrap = document.getElementById('leave-wrap');
  var chatId = '';
  try { chatId = sessionStorage.getItem('sc:' + key) || ''; } catch (e) { /* storage off: a new chat each load */ }
  var contactOk = true;

  function add(cls, words) {
    var d = document.createElement('div');
    d.className = 'm ' + cls;
    d.textContent = words;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  function post(path, fields) {
    var body = new URLSearchParams();
    Object.keys(fields).forEach(function (k) { body.append(k, fields[k] || ''); });
    return fetch('/site-chat/c/' + key + path, { method: 'POST', body: body, credentials: 'omit', headers: { Accept: 'application/json' } }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j; });
    });
  }
  function setLeave() {
    leaveWrap.style.display = contactOk ? '' : 'none';
    if (!contactOk) contact.classList.remove('open');
  }

  say.addEventListener('submit', function (e) {
    e.preventDefault();
    var words = text.value.trim();
    if (!words) return;
    var btn = say.querySelector('button');
    btn.disabled = true;
    add('me', words);
    text.value = '';
    post('/say', { chat: chatId, text: words, page: page }).then(function (j) {
      chatId = j.chatId || chatId;
      try { sessionStorage.setItem('sc:' + key, chatId); } catch (err) { /* fine */ }
      add('ai', j.answer);
      contactOk = !!j.contactOk;
      setLeave();
      if (j.passOn && contactOk) contact.classList.add('open');
      if (j.done) { text.disabled = true; btn.disabled = true; return; }
      btn.disabled = false;
      text.focus();
    }).catch(function (err) {
      add('note', err.message);
      btn.disabled = false;
    });
  });
  text.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); say.requestSubmit ? say.requestSubmit() : say.dispatchEvent(new Event('submit', { cancelable: true })); }
  });

  document.getElementById('leave').addEventListener('click', function () {
    if (!chatId) { add('note', 'Write your question first, then leave your details.'); text.focus(); return; }
    contact.classList.add('open');
    document.getElementById('c-name').focus();
  });
  document.getElementById('c-cancel').addEventListener('click', function () { contact.classList.remove('open'); });
  contact.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(contact);
    post('/contact', { chat: chatId, name: f.get('name'), email: f.get('email'), phone: f.get('phone') }).then(function (j) {
      contact.classList.remove('open');
      contact.reset();
      contactOk = false;
      setLeave();
      add('note', 'Sent. ' + j.line);
    }).catch(function (err) { add('note', err.message); });
  });
})();
