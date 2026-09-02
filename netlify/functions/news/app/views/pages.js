import { html, raw, esc, formatText, timeAgo, plural, u, displayDomain } from '../util.js';
import { TOPICS, topicLabel, PAGE_SIZE } from '../models.js';
import { feed, pager, commentNode, commentForm, storyRow, topicNav, relTime } from './components.js';
import { AWARDS } from '../points.js';
import { TRUST_THRESHOLD } from '../review.js';

/* ------------------------------------------------------------- listings */

export function listingPage(ctx, { heading, blurb, items, page, total, basePath, voted, topic = null, showTopics = false }) {
  return html`
    <div class="page-head">
      <h1>${heading}</h1>
      ${blurb ? html`<p>${blurb}</p>` : ''}
    </div>
    ${showTopics ? topicNav(topic) : ''}
    ${feed(ctx, items, { startRank: (page - 1) * PAGE_SIZE + 1, voted })}
    ${pager(basePath, page, total, PAGE_SIZE)}
  `;
}

export function commentsFeedPage(ctx, { items, page, total, heading, blurb, basePath, voted }) {
  return html`
    <div class="page-head">
      <h1>${heading}</h1>
      ${blurb ? html`<p>${blurb}</p>` : ''}
    </div>
    ${items.length === 0
      ? html`<div class="empty">Nothing here yet.</div>`
      : html`<div class="thread" style="border-top:0;padding-top:0">
          ${items.map((c) =>
            commentNode(ctx, { ...c, depth: 0 }, { voted: voted.has(c.id), indentPx: 0 }),
          )}
        </div>`}
    ${pager(basePath, page, total, PAGE_SIZE)}
  `;
}

/* ------------------------------------------------------------ item page */

export function itemPage(ctx, { story, comments, voted, opId, breadcrumb = [] }) {
  return html`
    ${breadcrumb.length
      ? html`<div class="mono" style="color:var(--muted);margin-bottom:12px">
          ${breadcrumb.map((b) => html`<a href="${u('/item')}?id=${b.id}">${b.label}</a> <span class="sep">/</span> `)}
        </div>`
      : ''}
    <ol class="feed">${storyRow(ctx, story, { rank: null, voted: voted.has(story.id), showText: true })}</ol>
    ${commentForm(ctx, story.id)}
    <div class="thread">
      <div class="mono" style="color:var(--muted);margin-bottom:12px">
        ${plural(comments.length, 'comment')} in thread
      </div>
      ${comments.length === 0
        ? html`<div class="empty">No comments yet.</div>`
        : comments.map((c) => commentNode(ctx, c, { voted: voted.has(c.id), opId }))}
    </div>
  `;
}

/** Permalink view of a single comment plus its subtree. */
export function commentPermalinkPage(ctx, { comment, story, replies, voted, opId }) {
  return html`
    <div class="page-head">
      <h1>Comment</h1>
      <p>on <a href="${u('/item')}?id=${story.id}">${story.title}</a></p>
    </div>
    <div class="thread" style="border-top:0;padding-top:0">
      ${commentNode(ctx, { ...comment, depth: 0 }, { voted: voted.has(comment.id), opId, indentPx: 0 })}
      ${replies.map((r) =>
        commentNode(ctx, { ...r, depth: r.depth - comment.depth }, { voted: voted.has(r.id), opId }),
      )}
    </div>
    ${commentForm(ctx, comment.id, { label: 'Reply' })}
  `;
}

export function replyPage(ctx, { parent, story }) {
  return html`
    <div class="page-head">
      <h1>Reply</h1>
      <p>to ${parent.by} on <a href="${u('/item')}?id=${story.id}">${story.title}</a></p>
    </div>
    <div class="thread" style="border-top:0;padding-top:0">
      ${commentNode(ctx, { ...parent, depth: 0 }, { indentPx: 0 })}
    </div>
    ${commentForm(ctx, parent.id, { label: 'Your reply', autofocus: true })}
  `;
}

/* ---------------------------------------------------------------- forms */

export function submitPage(ctx, { values = {}, error = null } = {}) {
  return html`
    <div class="page-head">
      <h1>Submit</h1>
      <p>Rounds, launches, spinouts, teardowns, hiring notes, policy that moves the field. A link or text, not both. Member submissions lead the front page for 24 hours, then rise or fall on votes.</p>
    </div>
    ${error ? html`<div class="notice error">${error}</div>` : ''}
    <form class="stack" method="post" action="${u('/submit')}">
      <input type="hidden" name="csrf" value="${ctx.csrf}" />
      <div class="field">
        <label for="title">Title</label>
        <input id="title" name="title" type="text" maxlength="120" required
               value="${values.title || ''}" placeholder="What happened, in plain language" />
        <div class="hint">Start the title with "Ask:" or "Show:" to file it in those channels.</div>
      </div>
      <div class="field">
        <label for="url">URL</label>
        <input id="url" name="url" type="text" value="${values.url || ''}"
               placeholder="https://www.biorxiv.org/content/..." />
      </div>
      <div class="field">
        <label for="topic">Channel</label>
        <select id="topic" name="topic">
          <option value="">Select a channel</option>
          ${TOPICS.map(
            (t) => html`<option value="${t.slug}" ${values.topic === t.slug ? raw('selected') : ''}>${t.label}</option>`,
          )}
        </select>
      </div>
      <div class="field">
        <label for="text">Text</label>
        <textarea id="text" name="text" rows="7"
                  placeholder="Leave the URL blank and write here to open a discussion.">${values.text || ''}</textarea>
      </div>
      <button class="btn solid" type="submit">Submit</button>
    </form>
  `;
}

export function editPage(ctx, { item, error = null }) {
  const isStory = item.type === 'story';
  return html`
    <div class="page-head">
      <h1>Edit ${isStory ? 'submission' : 'comment'}</h1>
      <p>Edits are open for two hours after posting.</p>
    </div>
    ${error ? html`<div class="notice error">${error}</div>` : ''}
    <form class="stack" method="post" action="${u('/edit')}">
      <input type="hidden" name="csrf" value="${ctx.csrf}" />
      <input type="hidden" name="id" value="${item.id}" />
      ${isStory
        ? html`<div class="field">
              <label for="title">Title</label>
              <input id="title" name="title" type="text" maxlength="120" required value="${item.title}" />
            </div>
            <div class="field">
              <label for="topic">Channel</label>
              <select id="topic" name="topic">
                <option value="">— none —</option>
                ${TOPICS.map(
                  (t) => html`<option value="${t.slug}" ${item.topic === t.slug ? raw('selected') : ''}>${t.label}</option>`,
                )}
              </select>
            </div>`
        : ''}
      <div class="field">
        <label for="text">Text</label>
        <textarea id="text" name="text" rows="8">${item.text || ''}</textarea>
      </div>
      <div class="more" style="margin-top:0">
        <button class="btn solid" type="submit">Save</button>
        <a class="btn ghost" href="${u('/item')}?id=${isStory ? item.id : item.story_id}">Cancel</a>
      </div>
    </form>
    <form method="post" action="${u('/delete')}" style="margin-top:28px">
      <input type="hidden" name="csrf" value="${ctx.csrf}" />
      <input type="hidden" name="id" value="${item.id}" />
      <button class="btn ghost small" type="submit"
              onclick="return confirm('Delete this permanently?')">Delete</button>
    </form>
  `;
}

export function loginPage(ctx, { error = null, next = '/', mode = 'login', values = {} } = {}) {
  const signupError = mode === 'signup' ? error : null;
  const loginError = mode === 'login' ? error : null;
  return html`
    <div class="page-head">
      <h1>Sign in</h1>
      <p>One handle, one passphrase. No email required.</p>
    </div>

    ${loginError ? html`<div class="notice error">${loginError}</div>` : ''}
    <form class="stack" method="post" action="${u('/login')}">
      <input type="hidden" name="next" value="${next}" />
      <input type="hidden" name="mode" value="login" />
      <div class="field">
        <label for="lid">Handle</label>
        <input id="lid" name="id" type="text" autocomplete="username" required
               value="${mode === 'login' ? values.id || '' : ''}" />
      </div>
      <div class="field">
        <label for="lpw">Passphrase</label>
        <input id="lpw" name="password" type="password" autocomplete="current-password" required />
      </div>
      <button class="btn solid" type="submit">Log in</button>
    </form>

    <div class="page-head" style="margin-top:44px">
      <h1>Create an account</h1>
    </div>
    ${signupError ? html`<div class="notice error">${signupError}</div>` : ''}
    <form class="stack" method="post" action="${u('/login')}">
      <input type="hidden" name="next" value="${next}" />
      <input type="hidden" name="mode" value="signup" />
      <div class="field">
        <label for="sid">Handle</label>
        <input id="sid" name="id" type="text" autocomplete="username" required maxlength="20"
               value="${mode === 'signup' ? values.id || '' : ''}" />
        <div class="hint">2-20 chars: letters, numbers, - and _</div>
      </div>
      <div class="field">
        <label for="spw">Passphrase</label>
        <input id="spw" name="password" type="password" autocomplete="new-password" required minlength="8" />
        <div class="hint">8 characters minimum. Stored as a scrypt hash, never in the clear.</div>
      </div>
      <button class="btn ghost" type="submit">Create account</button>
    </form>
  `;
}

/* ---------------------------------------------------------------- users */

export function userPage(ctx, { profile, stats, isSelf, saved = false }) {
  return html`
    <div class="page-head">
      <h1>${profile.id}</h1>
      <p>Joined ${timeAgo(profile.created_at)}</p>
    </div>
    ${saved ? html`<div class="notice">Profile updated.</div>` : ''}
    <dl class="profile">
      <dt>Karma</dt><dd>${profile.karma}</dd>
      <dt>Submissions</dt><dd><a href="${u('/submitted')}?id=${profile.id}">${stats.stories || 0}</a></dd>
      <dt>Comments</dt><dd><a href="${u('/threads')}?id=${profile.id}">${stats.comments || 0}</a></dd>
      <dt>About</dt><dd>${profile.about ? formatText(profile.about) : html`<span style="color:var(--muted)">—</span>`}</dd>
      ${isSelf ? html`<dt>Favorites</dt><dd><a href="${u('/favorites')}">saved items</a></dd>` : ''}
    </dl>
    ${isSelf
      ? html`<form class="stack" method="post" action="${u('/user')}" style="margin-top:30px">
          <input type="hidden" name="csrf" value="${ctx.csrf}" />
          <div class="field">
            <label for="about">About</label>
            <textarea id="about" name="about" rows="5"
              placeholder="Where you work, what you are building.">${profile.about || ''}</textarea>
          </div>
          <button class="btn solid" type="submit">Save</button>
        </form>`
      : ''}
  `;
}

/* --------------------------------------------------------------- search */

export function searchPage(ctx, { query, items, page, total, voted }) {
  return html`
    <div class="page-head">
      <h1>Search</h1>
      <p>Titles, text, and domains across every channel.</p>
    </div>
    <form class="searchbar" method="get" action="${u('/search')}">
      <input type="search" name="q" value="${query || ''}" placeholder="crispr, seed round, endpts.com" autofocus />
      <button class="btn solid" type="submit">Search</button>
    </form>
    ${query
      ? html`<div class="statstrip"><span><b>${total}</b> results for "${query}"</span></div>
          ${items.length
            ? html`<ol class="feed">
                ${items.map((item) =>
                  item.type === 'story'
                    ? storyRow(ctx, item, { voted: voted.has(item.id) })
                    : html`<li class="story">
                        <span class="rank"></span><span></span>
                        <span class="title-line">
                          <a class="title" href="${u('/item')}?id=${item.id}">comment by ${item.by}</a>
                        </span>
                        <span class="subline">${relTime(item.created_at)}</span>
                        <div class="text-body">${formatText((item.text || '').slice(0, 300))}</div>
                      </li>`,
                )}
              </ol>`
            : html`<div class="empty">No matches.</div>`}
          ${pager(`/search?q=${encodeURIComponent(query)}`, page, total, PAGE_SIZE)}`
      : ''}
  `;
}

export function topicsPage(ctx, { counts }) {
  return html`
    <div class="page-head">
      <h1>Channels</h1>
      <p>The feed, split by field.</p>
    </div>
    <ol class="feed">
      ${TOPICS.map(
        (t) => html`<li class="story">
          <span class="rank"></span>
          <span></span>
          <span class="title-line"><a class="title" href="${u('/topic')}?t=${t.slug}">${t.label}</a></span>
          <span class="subline">${plural(counts[t.slug] || 0, 'submission')}</span>
        </li>`,
      )}
    </ol>
  `;
}

/* --------------------------------------------------------------- static */

export function aboutPage(ctx, { stats }) {
  return html`
    <div class="page-head">
      <h1>About</h1>
      <p>The front page for early-stage biotech.</p>
    </div>
    <div class="statstrip">
      <span><b>${stats.stories}</b> stories</span>
      <span><b>${stats.comments}</b> comments</span>
      <span><b>${stats.votes}</b> upvotes</span>
      <span><b>${stats.users}</b> members</span>
    </div>
    <div class="text-body">
      <p>Early-stage biotech news is scattered across trade press, press wires, and the
      timelines of people who happened to see it first. We read the sources every morning so
      the day starts with one page: seed and Series A rounds, spinouts, launches out of
      stealth, and the tools that make them possible.</p>
      <p>Two kinds of story appear here. Ones marked <span class="tag agent">Auto</span> were
      selected by a program that reads a fixed list of feeds at 7am and keeps what looks like
      early-stage company news. Everything else was posted by a member. Member submissions
      lead the front page for 24 hours, then rise or fall on votes like anything else —
      a person who saw it first should beat a crawler that saw it second.</p>
      <p>Ranking is points decaying against age, with a nudge for real discussion and a
      penalty for any one outlet dominating the page. The formula is 20 lines and is in the
      repository; nothing about the order is hand-tuned per story.</p>
      <p>Run by <a href="/">Haus Fund</a>, a $20M deeptech fund backing founders out of
      structured residency programs. We invest in this field, which is a reason to read us
      and a reason to check our work. Posting here buys nothing from us.</p>
    </div>
  `;
}

export function guidelinesPage() {
  return html`
    <div class="page-head">
      <h1>Guidelines</h1>
      <p>Short, and enforced by the people who read here.</p>
    </div>
    <div class="text-body">
      <p><b>On topic.</b> Companies at the beginning: seed and Series A rounds, spinouts,
      launches, founding teams, the instruments and software they depend on, and the policy
      and biosecurity decisions that shape what they can build. Honest write-ups of things
      that did not work are welcome and rare.</p>
      <p><b>Off topic.</b> Phase 3 readouts, large-cap pharma earnings, undisclosed
      promotion, health misinformation, and press releases wearing a lab coat.</p>
      <p><b>Disclose.</b> If you are an investor, founder, or employee of the company in the
      story, say so in a comment. Nobody minds that you are close to it; they mind finding
      out later.</p>
      <p><b>Titles.</b> Use the original, unless it is clickbait or misleading. No
      editorialising, no added punctuation.</p>
      <p><b>Comments.</b> Respond to the strongest version of the argument. Cite numbers.
      Asking for a source is fair; sneering is not. Disagreement about data is the point.</p>
      <p><b>Safety.</b> Do not post protocols, sequences, or acquisition routes for agents
      that could cause mass harm. This is the one rule with no discussion attached — such
      posts are removed and the account is banned.</p>
      <p><b>Voting.</b> Upvote what taught you something. Voting rings get the whole cluster
      removed. Flag spam rather than arguing with it.</p>
    </div>
  `;
}

export function apiPage() {
  const endpoints = [
    ['GET', '/api/stories', 'Ranked front page. ?page, ?limit, ?topic, ?sort=top|new|best|ask|show'],
    ['GET', '/api/item/:id', 'One story or comment, with its comment tree when it is a story.'],
    ['GET', '/api/user/:id', 'Public profile: karma, about, counts.'],
    ['GET', '/api/search?q=', 'Full listing search.'],
    ['GET', '/api/topics', 'Channels and their submission counts.'],
    ['POST', '/api/vote', '{ id, dir: "up"|"down" } — session cookie + X-CSRF-Token required.'],
    ['POST', '/api/submit', '{ title, url?, text?, topic? } — returns the new item.'],
    ['POST', '/api/comment', '{ parent, text } — returns the new comment.'],
    ['GET', '/rss', 'RSS 2.0 of the current front page.'],
  ];
  return html`
    <div class="page-head">
      <h1>API</h1>
      <p>JSON over the same data the pages render. Read endpoints are open; writes need a session.</p>
    </div>
    <div class="text-body" style="max-width:720px">
      <ol class="feed">
        ${endpoints.map(
          ([method, path, note]) => html`<li class="story">
            <span class="rank mono">${method}</span>
            <span></span>
            <span class="title-line"><code>${u(path)}</code></span>
            <span class="subline">${note}</span>
          </li>`,
        )}
      </ol>
      <p style="margin-top:20px">Rate limit: 240 requests/minute per IP on reads, tighter on writes.</p>
    </div>
  `;
}

export function notFoundPage() {
  return html`
    <div class="page-head">
      <h1>Not found</h1>
      <p>That page does not exist.</p>
    </div>
    <div class="more"><a class="btn solid" href="${u('/')}">Back to the feed</a></div>
  `;
}

export function errorPage(message) {
  return html`
    <div class="page-head">
      <h1>Something went wrong</h1>
      <p>${message || 'The server could not complete that request.'}</p>
    </div>
    <div class="more"><a class="btn solid" href="${u('/')}">Back to the feed</a></div>
  `;
}

export { esc };

/* ------------------------------------------------------ review and scouts */

/** The reviewer's queue: everything waiting, oldest first. */
export function reviewPage(ctx, { items }) {
  if (items.length === 0) {
    return html`<section class="panel">
      <h1 class="page-title">Review queue</h1>
      <p class="blurb">Nothing waiting. Submissions from untrusted accounts land here first.</p>
    </section>`;
  }

  return html`<section class="panel">
    <h1 class="page-title">Review queue</h1>
    <p class="blurb">
      ${plural(items.length, 'submission')} waiting. Approving puts an item on the board dated from
      now, so its first day at the top is a day of actually being seen.
    </p>
    <ul class="queue">
      ${raw(items.map((item) => reviewRow(ctx, item)).join(''))}
    </ul>
  </section>`;
}

function reviewRow(ctx, item) {
  const domain = item.domain || displayDomain(item.url);
  return html`<li class="queue-item">
    <div class="queue-head">
      <a class="title" href="${item.url || `${u('/item')}?id=${item.id}`}"
         rel="nofollow noopener ugc" target="_blank">${item.title}</a>
      ${domain ? html` <span class="sitebit">(${domain})</span>` : ''}
    </div>
    <div class="subline">
      <a href="${u('/user')}?id=${item.by}">${item.by}</a>
      <span class="sep">|</span>${relTime(item.created_at)}
      ${item.topic ? html`<span class="sep">|</span>${item.topic}` : ''}
    </div>
    ${item.text ? html`<div class="text-body">${formatText(item.text.slice(0, 600))}</div>` : ''}
    <form class="queue-actions" method="post" action="${u('/review')}">
      <input type="hidden" name="csrf" value="${ctx.csrf}" />
      <input type="hidden" name="id" value="${item.id}" />
      <input class="note" type="text" name="note" placeholder="Note (optional)" maxlength="200" />
      <button class="btn" type="submit" name="verdict" value="approve">Approve</button>
      <button class="btn ghost" type="submit" name="verdict" value="reject">Reject</button>
    </form>
  </li>`;
}

/** What a member sees while their own submissions wait. */
export function queuePage(ctx, { items }) {
  return html`<section class="panel">
    <h1 class="page-title">Your queue</h1>
    <p class="blurb">
      New accounts have their first few submissions read before they go up. After
      ${raw(String(TRUST_THRESHOLD))} cleared submissions yours post straight to the board.
    </p>
    ${items.length === 0
      ? html`<p class="blurb">Nothing waiting.</p>`
      : html`<ul class="itemlist">${raw(items.map((item) => storyRow(ctx, item)).join(''))}</ul>`}
  </section>`;
}

/** The standings, and what points are for. */
export function scoutsPage(ctx, { leaders, rewards }) {
  return html`<section class="panel">
    <h1 class="page-title">Scouts</h1>
    <p class="blurb">
      Points are earned by putting things on the board that turn out to matter, and they convert
      into things that exist in the world.
    </p>

    <h2 class="section-title">Standing</h2>
    ${leaders.length === 0
      ? html`<p class="blurb">No points awarded yet.</p>`
      : html`<ol class="standings">
          ${raw(
            leaders
              .map(
                (leader) => html`<li>
                  <a href="${u('/user')}?id=${leader.id}">${leader.id}</a>
                  <span class="pts">${plural(leader.points, 'point')}</span>
                </li>`,
              )
              .join(''),
          )}
        </ol>`}

    <h2 class="section-title">What points are worth</h2>
    <table class="grid">
      <tbody>
        ${raw(
          Object.entries(AWARDS)
            .filter(([, award]) => award.points > 0)
            .map(([, award]) => html`<tr><td>${award.label}</td><td class="num">+${award.points}</td></tr>`)
            .join(''),
        )}
      </tbody>
    </table>

    <h2 class="section-title">What they convert into</h2>
    <table class="grid">
      <tbody>
        ${raw(
          rewards
            .map(
              (reward) => html`<tr>
                <td><strong>${reward.label}</strong><br /><span class="blurb">${reward.blurb}</span></td>
                <td class="num">${reward.cost}</td>
              </tr>`,
            )
            .join(''),
        )}
      </tbody>
    </table>
    ${ctx.user ? html`<p><a class="btn" href="${u('/points')}">Your points</a></p>` : ''}
  </section>`;
}

/** One scout's ledger and the redemption form. */
export function pointsPage(ctx, { balance, ledger, rewards, redemptions, error = null }) {
  return html`<section class="panel">
    <h1 class="page-title">Your points</h1>
    <p class="blurb">Balance: <strong>${plural(balance, 'point')}</strong></p>
    ${error ? html`<div class="notice error">${error}</div>` : ''}

    <h2 class="section-title">Redeem</h2>
    <form class="redeem" method="post" action="${u('/redeem')}">
      <input type="hidden" name="csrf" value="${ctx.csrf}" />
      <select name="reward" aria-label="Reward">
        ${raw(
          rewards
            .map((r) => html`<option value="${r.key}" ${balance < r.cost ? raw('disabled') : ''}>
              ${r.label} — ${raw(String(r.cost))} points
            </option>`)
            .join(''),
        )}
      </select>
      <input type="text" name="note" maxlength="200" placeholder="Shipping note, size, anything we need" />
      <button class="btn" type="submit">Redeem</button>
    </form>

    ${redemptions.length
      ? html`<h2 class="section-title">Requested</h2>
          <table class="grid">
            <tbody>
              ${raw(
                redemptions
                  .map(
                    (r) => html`<tr>
                      <td>${r.reward}</td>
                      <td>${r.state}</td>
                      <td class="num">${relTime(r.created_at)}</td>
                    </tr>`,
                  )
                  .join(''),
              )}
            </tbody>
          </table>`
      : ''}

    <h2 class="section-title">Ledger</h2>
    ${ledger.length === 0
      ? html`<p class="blurb">Nothing yet. Surface something.</p>`
      : html`<table class="grid">
          <tbody>
            ${raw(
              ledger
                .map(
                  (row) => html`<tr>
                    <td class="num ${row.delta < 0 ? 'neg' : ''}">${raw(row.delta > 0 ? `+${row.delta}` : String(row.delta))}</td>
                    <td>
                      ${AWARDS[row.reason]?.label ?? row.reason}
                      ${row.item_title ? html`<br /><a href="${u('/item')}?id=${row.item_id}">${row.item_title}</a>` : ''}
                    </td>
                    <td class="num">${relTime(row.created_at)}</td>
                  </tr>`,
                )
                .join(''),
            )}
          </tbody>
        </table>`}
  </section>`;
}

/* ------------------------------------------------------------- the agents */

export function agentsPage(ctx, { agents, status }) {
  const byKey = new Map(status.map((row) => [row.agent, row]));
  return html`<section class="panel">
    <h1 class="page-title">The agents</h1>
    <p class="blurb">
      Half the board comes from here. Each agent watches one kind of source, posts under its own
      handle, and is capped so no single one can take the page.
    </p>
    <table class="grid">
      <thead><tr><th>Agent</th><th>Watches</th><th class="num">Posted</th><th class="num">Last run</th></tr></thead>
      <tbody>
        ${raw(
          agents
            .map((agent) => {
              const row = byKey.get(agent.key);
              return html`<tr>
                <td><a href="${u('/agent')}?key=${agent.key}">${agent.label}</a></td>
                <td class="blurb">${agent.about}</td>
                <td class="num">${raw(String(row?.posted ?? 0))}</td>
                <td class="num">${row?.last_run ? relTime(row.last_run) : '—'}</td>
              </tr>`;
            })
            .join(''),
        )}
      </tbody>
    </table>
  </section>`;
}

/* ---------------------------------------------------------------- issues */

export function digestIndexPage(ctx, { kind, spec, issues }) {
  return html`<section class="panel">
    <h1 class="page-title">${spec.title}</h1>
    <p class="blurb">${spec.blurb}</p>
    ${issues.length === 0
      ? html`<p class="blurb">No issues yet. The first one goes out on the next run.</p>`
      : html`<ul class="issues">
          ${raw(
            issues
              .map(
                (issue) => html`<li>
                  <a href="${u(`/${kind}`)}?i=${issue.slug}">${issue.title}</a>
                  <span class="blurb">${issue.intro}</span>
                </li>`,
              )
              .join(''),
          )}
        </ul>`}
  </section>`;
}

export function digestPage(ctx, { spec, issue, items, voted }) {
  return html`<section class="panel">
    <h1 class="page-title">${issue.title}</h1>
    <p class="blurb">${issue.intro}</p>
    <ul class="itemlist">
      ${raw(items.map((item, i) => storyRow(ctx, item, { rank: i + 1, voted: voted.has(item.id) })).join(''))}
    </ul>
    <p class="blurb"><a href="${u(`/${spec.key}`)}?i=all">All ${spec.title} issues</a></p>
  </section>`;
}
