/* Homeroom progressive enhancement. Everything here also works as a plain
   form POST with JavaScript off — this only skips the reload. */

(function () {
  'use strict';

  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';

  function flash(message) {
    let bar = document.querySelector('.notice.error.js-flash');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'notice error js-flash';
      document.querySelector('main .wrap')?.prepend(bar);
    }
    bar.textContent = message;
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => bar.remove(), 4000);
  }

  /* -------------------------------------------------------------- voting */

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!form.classList.contains('voteform')) return;
    event.preventDefault();

    const button = form.querySelector('button');
    const counter = button.querySelector('b');
    const [kind, id] = String(form.dataset.target || '').split(':');
    const voted = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!voted));

    try {
      const res = await fetch('/homeroom/api/vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ kind, id: Number(id), dir: voted ? 'down' : 'up', csrf }),
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'request failed');
      if (counter) counter.textContent = data.points;
      button.setAttribute('aria-pressed', String(data.voted));
      button.title = data.voted ? 'undo upvote' : 'upvote';
      form.querySelector('input[name="dir"]').value = data.voted ? 'down' : 'up';
    } catch (err) {
      button.setAttribute('aria-pressed', String(voted));
      if (/members only|unauthor/i.test(err.message)) {
        window.location.href = '/homeroom/login?next=' + encodeURIComponent(location.pathname + location.search);
        return;
      }
      flash(err.message);
    }
  });

  /* -------------------------------------------------- comment collapsing */

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('.toggle');
    if (!toggle) return;
    event.preventDefault();
    const comment = toggle.closest('.comment');
    const depth = Number(comment.dataset.depth);
    const collapsing = !comment.classList.contains('collapsed');
    comment.classList.toggle('collapsed', collapsing);

    let hidden = 0;
    let node = comment.nextElementSibling;
    while (node && node.classList.contains('comment') && Number(node.dataset.depth) > depth) {
      node.style.display = collapsing ? 'none' : '';
      node = node.nextElementSibling;
      hidden++;
    }
    toggle.textContent = collapsing ? '[+' + (hidden + 1) + ']' : '[-]';
  });

  /* ------------------------------------------- poll options on the compose form */

  const kindSelect = document.querySelector('#kind');
  const pollBlock = document.querySelector('#polloptions');
  if (kindSelect && pollBlock) {
    const sync = () => { pollBlock.hidden = kindSelect.value !== 'poll'; };
    kindSelect.addEventListener('change', sync);
    sync();
  }

  /* ---------------------------------------------------------------- chat
     Polling, not sockets: a Netlify function cannot hold a connection open,
     and one indexed range query every few seconds costs almost nothing.

     Three things keep it cheap and quiet:
       - the poll stops entirely while the tab is hidden, and fires once
         immediately on return, so a backgrounded tab is free;
       - the interval backs off to 30s after five empty polls and resets the
         moment anything arrives or you type, so an idle room goes quiet;
       - `since` is the last id we hold, so the usual response is `[]`.

     Everything below is enhancement. With JavaScript off, the page still
     posts, still redirects, and still shows every message. */

  const chat = document.querySelector('.chatmain[data-channel]');
  if (chat) {
    const log = chat.querySelector('#chatlog');
    const form = chat.querySelector('#chatform');
    const input = form?.querySelector('textarea');
    const FAST = 5000;
    const SLOW = 30000;
    let last = Number(chat.dataset.last || 0);
    let quiet = 0;
    let timer = null;

    const atBottom = () => !log || log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    const toBottom = () => { if (log) log.scrollTop = log.scrollHeight; };
    toBottom();

    function render(message) {
      const item = document.createElement('li');
      item.className = 'msg fresh' + (message.mine ? ' mine' : '');
      item.id = 'm' + message.id;
      item.dataset.id = String(message.id);
      const who = document.createElement('a');
      who.className = 'who';
      who.href = '/homeroom/p/' + encodeURIComponent(message.author);
      who.textContent = message.author;
      const head = document.createElement('div');
      head.className = 'msghead mono';
      head.append(who);
      const text = document.createElement('div');
      text.className = 'msgbody';
      // textContent, never innerHTML: this is another member's text.
      text.textContent = message.body;
      const grow = document.createElement('div');
      grow.className = 'grow';
      grow.append(head, text);
      item.append(grow);
      return item;
    }

    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch(
          '/homeroom/api/chat/' + encodeURIComponent(chat.dataset.channel) + '?since=' + last,
          { credentials: 'same-origin', headers: { accept: 'application/json' } },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data.ok) return;
        if (data.messages.length) {
          const stick = atBottom();
          for (const message of data.messages) {
            if (!document.getElementById('m' + message.id)) log?.append(render(message));
          }
          last = data.last;
          quiet = 0;
          if (stick) toBottom();
        } else {
          quiet++;
        }
        const pip = document.querySelector('.me a[href="/homeroom/chat"] b');
        if (pip) pip.textContent = data.unread > 99 ? '99+' : String(data.unread);
      } catch {
        // Offline, or the session expired. The next tick tries again; a chat
        // that shows an error banner every time a laptop lid closes is worse
        // than one that quietly catches up.
        quiet++;
      } finally {
        schedule();
      }
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(poll, quiet >= 5 ? SLOW : FAST);
    }

    function wake() {
      quiet = 0;
      clearTimeout(timer);
      if (!document.hidden) poll();
    }

    document.addEventListener('visibilitychange', wake);
    input?.addEventListener('input', () => { quiet = 0; });
    schedule();

    // Enter sends, shift-enter breaks the line. The button still works.
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (input.value.trim()) form.requestSubmit();
      }
    });
  }
})();
