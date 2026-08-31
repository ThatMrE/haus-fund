// One thread: the post, its poll, its replies, and the reply box.

import {
  page, setHTML, html, raw, param, prose, when, plural, labelFor, memberLink, pill,
  flash, readableError, CATEGORIES, POST_KINDS,
} from '../ui.js';
import * as api from '../api.js';
import { voteButton, wireVotes, votedSet } from './_parts.js';

const id = Number(param('id'));

page(async (me) => {
  if (!id) return setHTML('#app', html`<div class="empty">No such thread.</div>`);
  const post = await api.post(id);
  if (!post) return setHTML('#app', html`<div class="empty">No such thread.</div>`);

  api.bumpViews(id);
  const [replies, pollOptions, myOption, saved, following] = await Promise.all([
    api.comments(id),
    post.kind === 'poll' ? api.pollOptions(id) : Promise.resolve([]),
    post.kind === 'poll' ? api.myPollVote(id) : Promise.resolve(null),
    api.isMarked('hr_saves', 'post', id),
    api.isMarked('hr_follows', 'post', id),
  ]);

  const [postVoted, replyVotes] = await Promise.all([
    votedSet('post', [post]),
    votedSet('comment', replies),
  ]);

  const mine = post.shown_author === me.id;
  const totalVotes = pollOptions.reduce((sum, option) => sum + option.votes, 0);

  setHTML('#app', html`
    <article class="thread-head">
      <div class="votecol">${voteButton('post', post, postVoted.has(post.id), me.id)}</div>
      <div class="grow">
        <h1>${post.title}</h1>
        <div class="subline" style="margin-bottom:14px">
          <span class="tag">${labelFor(POST_KINDS, post.kind)}</span>
          <a class="tag" href="/homeroom/forum.html?category=${post.category}">${labelFor(CATEGORIES, post.category)}</a>
          ${(post.tags ?? []).map((tag) => html`<a class="tag" href="/homeroom/forum.html?tag=${tag}">${tag}</a>`)}
          <span class="sep">/</span>
          ${post.anonymous ? html`<span class="anon">anonymous member</span>`
            : memberLink({ handle: post.author_handle, name: post.author_name || post.author_handle })}
          ${post.org_slug ? html`<span class="sep">/</span><a href="/homeroom/lab.html?slug=${post.org_slug}">${post.org_name}</a>` : ''}
          <span class="sep">/</span>${when(post.created_at)}
          ${post.edited_at ? html`<span class="sep">/</span>edited` : ''}
          <span class="sep">/</span>${plural(post.view_count, 'view')}
        </div>
        ${post.body ? html`<div class="prose">${prose(post.body)}</div>` : ''}

        ${pollOptions.length ? html`<div class="poll">
          ${pollOptions.map((option) => {
            const pct = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0;
            return html`<button class="polloption js-poll ${myOption === option.id ? 'mine' : ''}"
              data-option="${option.id}" type="button">
              <span class="bar" style="width:${pct}%"></span>
              <span class="label">${option.label}</span>
              <span class="count">${option.votes} &middot; ${pct}%</span>
            </button>`;
          })}
          <div class="mono">${plural(totalVotes, 'vote')}${myOption ? ' · you voted' : ''}</div>
        </div>` : ''}

        <div class="comment cfoot" style="border:0;padding:0;margin-top:16px">
          <button class="linkish js-follow" type="button">${following ? 'Unfollow' : 'Follow'}</button>
          <button class="linkish js-save" type="button">${saved ? 'Unsave' : 'Save'}</button>
          ${mine ? html`<button class="linkish js-edit" type="button">Edit</button>` : ''}
        </div>
      </div>
    </article>

    ${post.locked
      ? html`<div class="notice">This thread is locked. No new replies.</div>`
      : html`<form class="stack" id="reply" style="max-width:100%;margin:24px 0">
          <div class="field">
            <label for="text">Reply</label>
            <textarea id="text" name="text" rows="5" required
              placeholder="Answer from experience. Numbers, part codes, the failure mode you hit."></textarea>
          </div>
          <label class="check"><input type="checkbox" name="anonymous" value="1"> <span>Reply anonymously</span></label>
          <button class="btn" type="submit">Reply</button>
        </form>`}

    <section class="panel">
      <h2>${plural(post.comment_count, 'reply', 'replies')}</h2>
      <div id="replies">
        ${replies.length ? replies.map((reply) => replyNode(reply, post, replyVotes.has(reply.id), me, mine))
                         : html`<div class="empty">No replies yet.</div>`}
      </div>
    </section>`);

  wireVotes();
  wireThread(post, me, mine, following, saved);
});

function replyNode(reply, post, voted, me, viewerIsAsker) {
  const accepted = post.answer_id === reply.id;
  const mine = reply.shown_author === me.id;
  const indent = Math.min(reply.depth, 8) * 20;
  return html`<div class="comment ${accepted ? 'accepted' : ''}" id="c${reply.id}"
      data-depth="${reply.depth}" style="margin-left:${indent}px">
    <div class="chead">
      ${reply.deleted ? '' : voteButton('comment', reply, voted, me.id)}
      ${reply.anonymous ? html`<span class="anon">anonymous</span>` : memberLink(reply.author)}
      <span class="sep">/</span>${when(reply.created_at)}
      ${reply.edited_at ? html`<span class="sep">/</span>edited` : ''}
      ${accepted ? pill('Accepted answer', 'good') : ''}
      <span class="toggle" data-collapse>[&minus;]</span>
    </div>
    <div class="cbody">${reply.deleted ? html`<i class="dim">deleted</i>` : html`<div class="prose">${prose(reply.body)}</div>`}</div>
    ${reply.deleted ? '' : html`<div class="cfoot">
      ${post.locked ? '' : html`<button class="linkish js-reply" data-parent="${reply.id}" type="button">Reply</button>`}
      ${viewerIsAsker && post.kind === 'question'
        ? html`<button class="linkish js-accept" data-comment="${accepted ? 0 : reply.id}" type="button">${
            accepted ? 'Unaccept' : 'Accept as answer'}</button>`
        : ''}
      ${mine ? html`<button class="linkish js-edit-reply" data-id="${reply.id}" type="button">Edit</button>` : ''}
      ${mine ? html`<button class="linkish js-delete-reply" data-id="${reply.id}" type="button">Delete</button>` : ''}
    </div>`}
  </div>`;
}

function wireThread(post, me, mine, following, saved) {
  const app = document.querySelector('#app');
  let isFollowing = following;
  let isSaved = saved;

  document.querySelector('#reply')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    const button = event.target.querySelector('button');
    button.disabled = true;
    try {
      await api.createComment(post.id, fields.text.trim(), null, fields.anonymous === '1');
      location.reload();
    } catch (error) {
      flash(readableError(error));
      button.disabled = false;
    }
  });

  app.addEventListener('click', async (event) => {
    const target = event.target;

    if (target.closest('[data-collapse]')) {
      const comment = target.closest('.comment');
      const depth = Number(comment.dataset.depth);
      const collapsing = !comment.classList.contains('collapsed');
      comment.classList.toggle('collapsed', collapsing);
      let node = comment.nextElementSibling;
      let hidden = 0;
      while (node?.classList.contains('comment') && Number(node.dataset.depth) > depth) {
        node.style.display = collapsing ? 'none' : '';
        node = node.nextElementSibling;
        hidden++;
      }
      target.textContent = collapsing ? `[+${hidden + 1}]` : '[−]';
      return;
    }

    if (target.classList.contains('js-poll')) {
      try { await api.castPollVote(post.id, Number(target.dataset.option)); location.reload(); }
      catch (error) { flash(readableError(error)); }
      return;
    }

    if (target.classList.contains('js-follow')) {
      try {
        await api.toggleMark('hr_follows', 'post', post.id, isFollowing);
        isFollowing = !isFollowing;
        target.textContent = isFollowing ? 'Unfollow' : 'Follow';
      } catch (error) { flash(readableError(error)); }
      return;
    }

    if (target.classList.contains('js-save')) {
      try {
        await api.toggleMark('hr_saves', 'post', post.id, isSaved);
        isSaved = !isSaved;
        target.textContent = isSaved ? 'Unsave' : 'Save';
      } catch (error) { flash(readableError(error)); }
      return;
    }

    if (target.classList.contains('js-accept')) {
      try {
        await api.acceptAnswer(post.id, Number(target.dataset.comment) || null);
        location.reload();
      } catch (error) { flash(readableError(error)); }
      return;
    }

    if (target.classList.contains('js-reply')) {
      openReplyBox(target, post);
      return;
    }

    if (target.classList.contains('js-edit-reply')) {
      const node = target.closest('.comment');
      const body = node.querySelector('.cbody');
      const current = body.innerText.trim();
      body.innerHTML = '';
      const box = document.createElement('textarea');
      box.rows = 5; box.value = current;
      const save = document.createElement('button');
      save.className = 'btn small'; save.textContent = 'Save';
      save.addEventListener('click', async () => {
        try { await api.editComment(Number(target.dataset.id), box.value.trim()); location.reload(); }
        catch (error) { flash(readableError(error)); }
      });
      body.append(box, save);
      return;
    }

    if (target.classList.contains('js-delete-reply')) {
      if (!confirm('Delete this reply?')) return;
      try { await api.deleteComment(Number(target.dataset.id)); location.reload(); }
      catch (error) { flash(readableError(error)); }
      return;
    }

    if (target.classList.contains('js-edit')) {
      const title = prompt('Title', post.title);
      if (title === null) return;
      const body = prompt('Body', post.body ?? '');
      if (body === null) return;
      try { await api.editPost(post.id, { title: title.trim(), body }); location.reload(); }
      catch (error) { flash(readableError(error)); }
    }
  });
}

function openReplyBox(button, post) {
  const comment = button.closest('.comment');
  if (comment.querySelector('.js-inline')) return comment.querySelector('.js-inline').remove();
  const form = document.createElement('form');
  form.className = 'stack js-inline';
  form.style.marginTop = '10px';
  form.innerHTML = '<div class="field"><textarea name="text" rows="4" required '
    + 'placeholder="Reply"></textarea></div>'
    + '<label class="check"><input type="checkbox" name="anonymous" value="1"> <span>Anonymously</span></label>'
    + '<button class="btn small" type="submit">Reply</button>';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    try {
      await api.createComment(post.id, fields.text.trim(), Number(button.dataset.parent), fields.anonymous === '1');
      location.reload();
    } catch (error) { flash(readableError(error)); }
  });
  comment.append(form);
  form.querySelector('textarea').focus();
}
