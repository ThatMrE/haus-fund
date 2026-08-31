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
})();
