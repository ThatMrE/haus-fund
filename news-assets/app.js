/* Progressive enhancement. Every control here also works as a plain form
   POST when JavaScript is unavailable — this just avoids the page reload. */

(function () {
  'use strict';

  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const base = document.querySelector('meta[name="base-path"]')?.content || '';
  const url = (path) => base + path;

  /* ------------------------------------------------------------- voting */

  async function send(url, payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'request failed');
    return data;
  }

  function setPoints(id, points) {
    document.querySelectorAll('[data-points="' + id + '"]').forEach((el) => {
      el.textContent = points + (points === 1 ? ' point' : ' points');
    });
  }

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!form.classList.contains('voteform')) return;
    event.preventDefault();

    const button = form.querySelector('button');
    const id = Number(form.dataset.item);
    const voted = button.getAttribute('aria-pressed') === 'true';

    button.setAttribute('aria-pressed', String(!voted));
    button.classList.remove('pulse');
    void button.offsetWidth; // restart the animation
    if (!voted) button.classList.add('pulse');

    try {
      const data = await send(url('/api/vote'), { id, dir: voted ? 'down' : 'up' });
      setPoints(id, data.points);
      button.setAttribute('aria-pressed', String(data.voted));
      button.title = data.voted ? 'undo upvote' : 'upvote';
    } catch (err) {
      button.setAttribute('aria-pressed', String(voted));
      if (/sign in|log in|unauthor/i.test(err.message)) {
        window.location.href = url('/login') + '?next=' + encodeURIComponent(location.pathname + location.search);
        return;
      }
      flash(err.message);
    }
  });

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
    toggle.textContent = collapsing ? `[+${hidden + 1}]` : '[–]';
  });

  /* ------------------------------------------------------- inline replies */

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-reply]');
    if (!link) return;
    const comment = link.closest('.comment');
    const existing = comment.querySelector('.inline-reply');
    if (existing) {
      existing.remove();
      return;
    }
    event.preventDefault();
    const form = document.createElement('form');
    form.className = 'inline-reply';
    form.method = 'post';
    form.action = url('/comment');
    form.style.marginTop = '10px';
    form.innerHTML =
      '<input type="hidden" name="csrf" value="' + csrf + '">' +
      '<input type="hidden" name="parent" value="' + link.dataset.reply + '">' +
      '<textarea name="text" rows="4" placeholder="Add context, prior art, numbers, or a disagreement." required></textarea>' +
      '<div style="margin-top:8px"><button class="btn solid small" type="submit">Reply</button></div>';
    comment.appendChild(form);
    form.querySelector('textarea').focus();
  });

  /* ------------------------------------------- relative time, live update */

  function tick() {
    const now = Date.now() / 1000;
    document.querySelectorAll('time[data-ts]').forEach((el) => {
      el.textContent = ago(now - Number(el.dataset.ts));
    });
  }

  function ago(delta) {
    delta = Math.max(0, delta);
    if (delta < 60) return Math.floor(delta) + ' seconds ago';
    const units = [
      ['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60],
    ];
    for (const [label, size] of units) {
      if (delta >= size) {
        const n = Math.floor(delta / size);
        return n + ' ' + label + (n === 1 ? '' : 's') + ' ago';
      }
    }
    return 'just now';
  }

  setInterval(tick, 60000);
})();
