import { html, raw, esc, timeAgo, plural, formatText, displayDomain, u } from '../util.js';
import { topicLabel, TOPICS } from '../models.js';

/** The upvote control. Falls back to a plain form POST without JavaScript. */
export function voteButton(ctx, item, { voted = false } = {}) {
  if (!ctx.user) {
    const next = encodeURIComponent(ctx.fullPath || '/');
    return html`<a class="voter" href="${u('/login')}?next=${raw(next)}" title="Log in to upvote" aria-label="Log in to upvote">&#9650;</a>`;
  }
  if (item.by === ctx.user.id) {
    return html`<button class="voter" disabled title="Your own post" aria-label="Your own post">&#9650;</button>`;
  }
  return html`<form class="voteform" method="post" action="${u('/vote')}" data-item="${item.id}">
    <input type="hidden" name="csrf" value="${ctx.csrf}" />
    <input type="hidden" name="id" value="${item.id}" />
    <input type="hidden" name="dir" value="${voted ? 'down' : 'up'}" />
    <input type="hidden" name="goto" value="${ctx.fullPath || '/'}" />
    <button class="voter" type="submit" aria-pressed="${voted ? 'true' : 'false'}"
            title="${voted ? 'Undo upvote' : 'Upvote'}" aria-label="Upvote">&#9650;</button>
  </form>`;
}

export function relTime(seconds) {
  return html`<time data-ts="${seconds}" datetime="${new Date(seconds * 1000).toISOString()}">${timeAgo(seconds)}</time>`;
}

function kindTag(item) {
  if (item.kind === 'ask') return html`<a class="tag ask" href="${u('/ask')}">Ask</a>`;
  if (item.kind === 'show') return html`<a class="tag show" href="${u('/show')}">Show</a>`;
  return '';
}

/** Machine-posted stories say so, on the row itself. */
function sourceTag(item) {
  if (item.source !== 'agent') return '';
  const label = item.agent ? `Auto · ${item.agent}` : 'Auto';
  return html`<a class="tag agent" href="${u('/agent')}?key=${item.agent ?? ''}"
     title="Filed by an agent, not a member">${label}</a>`;
}

/**
 * Who put this on the board. Agents credit the agent; people credit the person,
 * and the credit follows whoever surfaced it rather than whoever posted it.
 */
export function surfacedCredit(item) {
  if (item.source === 'agent') return '';
  // When the byline already is the credit, saying it twice adds nothing. The
  // credit earns its place when they differ: posted on someone's behalf, or
  // pulled in from a channel.
  const parts = [];
  if (item.surfaced_by && item.surfaced_by !== item.by) {
    parts.push(html`surfaced by <a href="${u('/user')}?id=${item.surfaced_by}">${item.surfaced_by}</a>`);
  }
  if (item.channel) parts.push(html`via ${item.channel}`);
  if (parts.length === 0) return '';
  return html`<span class="sep">|</span><span class="credit">${raw(parts.join(', '))}</span>`;
}

/** A submission still waiting on a reviewer says so to the person who sent it. */
function reviewTag(item) {
  if (item.review_state === 'pending') {
    return html`<span class="tag pending" title="Waiting on a reviewer">In review</span>`;
  }
  if (item.review_state === 'rejected') {
    return html`<span class="tag dead" title="Not accepted">Not accepted</span>`;
  }
  return '';
}

function topicTag(item) {
  if (!item.topic) return '';
  return html`<a class="tag" href="${u('/topic')}?t=${item.topic}">${topicLabel(item.topic) || item.topic}</a>`;
}

/**
 * One row of the feed.
 * @param {object} opts { rank, voted, showText }
 */
export function storyRow(ctx, item, { rank = null, voted = false, showText = false } = {}) {
  const domain = item.domain || displayDomain(item.url);
  const href = item.url || `${u('/item')}?id=${item.id}`;
  const external = Boolean(item.url);
  const canDelete = ctx.user && (ctx.user.id === item.by || ctx.user.is_admin);

  return html`<li class="story ${item.dead ? 'is-dead' : ''}">
    <span class="rank">${rank === null ? '' : raw(`${rank}.`)}</span>
    ${voteButton(ctx, item, { voted })}
    <span class="title-line">
      <a class="title" href="${href}" ${external ? raw('rel="nofollow noopener ugc" target="_blank"') : ''}>${item.title}</a>
      ${domain ? html` <span class="sitebit">(<a href="${u('/from')}?site=${domain}">${domain}</a>)</span>` : ''}
      ${kindTag(item)}${topicTag(item)}${sourceTag(item)}${reviewTag(item)}${item.dead ? html`<span class="tag dead">flagged</span>` : ''}
    </span>
    <span class="subline">
      <span class="pts" data-points="${item.id}">${plural(item.points, 'point')}</span>
      <span class="sep">|</span>
      <a href="${u('/user')}?id=${item.by}">${item.by}</a>
      <span class="sep">|</span>
      ${relTime(item.created_at)}${surfacedCredit(item)}
      <span class="sep">|</span>
      <a href="${u('/item')}?id=${item.id}">${item.comment_count > 0 ? plural(item.comment_count, 'comment') : 'discuss'}</a>
      ${ctx.user ? html`<span class="sep">|</span>${actionForm(ctx, '/flag', item.id, item.flagged ? 'unflag' : 'flag')}` : ''}
      ${ctx.user ? html`<span class="sep">|</span>${actionForm(ctx, '/favorite', item.id, item.favorited ? 'unfave' : 'fave')}` : ''}
      ${canDelete ? html`<span class="sep">|</span><a href="${u('/edit')}?id=${item.id}">edit</a>` : ''}
    </span>
    ${showText && item.text ? html`<div class="text-body">${formatText(item.text)}</div>` : ''}
  </li>`;
}

function actionForm(ctx, action, id, label) {
  return html`<form method="post" action="${u(action)}">
    <input type="hidden" name="csrf" value="${ctx.csrf}" />
    <input type="hidden" name="id" value="${id}" />
    <input type="hidden" name="goto" value="${ctx.fullPath || '/'}" />
    <button class="linkish" type="submit">${label}</button>
  </form>`;
}

export function feed(ctx, items, { startRank = 1, voted = new Set(), numbered = true } = {}) {
  if (!items.length) {
    return html`<div class="empty">Nothing in this channel yet.</div>`;
  }
  return html`<ol class="feed">
    ${items.map((item, i) =>
      storyRow(ctx, item, { rank: numbered ? startRank + i : null, voted: voted.has(item.id) }),
    )}
  </ol>`;
}

/** A single comment in a thread view. */
export function commentNode(ctx, comment, { voted = false, opId = null, indentPx = 22 } = {}) {
  const canEdit = ctx.user && (ctx.user.id === comment.by || ctx.user.is_admin);
  const isOp = opId && comment.by === opId;

  if (comment.deleted) {
    return html`<div class="comment deleted" data-depth="${comment.depth}"
      style="margin-left:${comment.depth * indentPx}px">
      <div class="chead"><span class="toggle">[&ndash;]</span><span>Removed</span></div>
      <div class="cbody">This comment was removed by its author.</div>
    </div>`;
  }

  return html`<div class="comment ${isOp ? 'op' : ''}" data-depth="${comment.depth}"
    style="margin-left:${comment.depth * indentPx}px" id="c${comment.id}">
    <div class="chead">
      <span class="toggle" role="button" tabindex="0" title="Collapse">[&ndash;]</span>
      ${voteButton(ctx, comment, { voted })}
      <a class="who" href="${u('/user')}?id=${comment.by}">${comment.by}</a>
      ${isOp ? html`<span class="tag op">Author</span>` : ''}
      <span class="sep">|</span>
      <span data-points="${comment.id}">${plural(comment.points, 'point')}</span>
      <span class="sep">|</span>
      ${relTime(comment.created_at)}
      ${comment.edited_at ? html`<span class="sep">|</span><span>edited</span>` : ''}
      <a href="${u('/item')}?id=${comment.id}">link</a>
      ${comment.story_title
        ? html`<span class="sep">|</span>on
            <a href="${u('/item')}?id=${comment.story_id}">${comment.story_title}</a>`
        : ''}
    </div>
    <div class="cbody">${formatText(comment.text)}</div>
    <div class="cfoot">
      <a href="${u('/reply')}?id=${comment.id}" data-reply="${comment.id}">reply</a>
      ${ctx.user ? actionForm(ctx, '/flag', comment.id, comment.flagged ? 'unflag' : 'flag') : ''}
      ${canEdit ? html`<a href="${u('/edit')}?id=${comment.id}">edit</a>` : ''}
      ${canEdit ? html`<a href="${u('/delete')}?id=${comment.id}">delete</a>` : ''}
    </div>
  </div>`;
}

export function commentForm(ctx, parentId, { label = 'Add to the discussion', autofocus = false } = {}) {
  if (!ctx.user) {
    return html`<p class="empty compact" style="margin-top:18px">
      <a href="${u('/login')}?next=${raw(encodeURIComponent(ctx.fullPath || '/'))}">Log in</a> to join the thread.
    </p>`;
  }
  return html`<form class="stack" method="post" action="${u('/comment')}" style="margin-top:18px">
    <input type="hidden" name="csrf" value="${ctx.csrf}" />
    <input type="hidden" name="parent" value="${parentId}" />
    <div class="field">
      <label for="ctext">${label}</label>
      <textarea id="ctext" name="text" rows="5" required
        placeholder="Add context, prior art, numbers, or a disagreement." ${autofocus ? raw('autofocus') : ''}></textarea>
    </div>
    <button class="btn solid" type="submit">Post comment</button>
  </form>`;
}

export function pager(basePath, page, total, pageSize) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return '';
  const link = (p, label) => {
    const sep = basePath.includes('?') ? '&' : '?';
    return html`<a class="btn ghost small" href="${raw(esc(u(basePath)))}${raw(sep)}p=${p}">${raw(label)}</a>`;
  };
  return html`<div class="more">
    ${page > 1 ? link(page - 1, '&larr; Back') : ''}
    ${page < pages ? link(page + 1, 'More &rarr;') : ''}
    <span class="mono" style="align-self:center;color:var(--muted)">page ${page} / ${pages}</span>
  </div>`;
}

export function topicNav(active = null) {
  return html`<div class="topics">
    <a href="${u('/')}" class="${active ? '' : 'on'}">all</a>
    ${TOPICS.map(
      (t) => html`<a href="${u('/topic')}?t=${t.slug}" class="${active === t.slug ? 'on' : ''}">${t.label}</a>`,
    )}
  </div>`;
}
