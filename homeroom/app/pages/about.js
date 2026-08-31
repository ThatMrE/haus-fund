// What Homeroom is, and the rules that make it work.

import { page, setHTML, html } from '../ui.js';
import * as api from '../api.js';

page(async () => {
  const stats = await api.networkStats();
  setHTML('#app', html`
    <div class="doc">
      <h1>About Homeroom</h1>
      <p class="lede">Homeroom is the members-only side of Haus. The public site is the front door;
        this is the back room, where people say what a thing actually cost and which funder wasted
        three months of their life.</p>

      <div class="statstrip">
        <span><b>${stats.members}</b> members</span>
        <span><b>${stats.orgs}</b> labs</span>
        <span><b>${stats.posts}</b> threads</span>
        <span><b>${stats.funders}</b> funders</span>
        <span><b>${stats.reviews}</b> reviews</span>
        <span><b>${stats.deals}</b> deals</span>
        <span><b>${stats.jobs}</b> roles</span>
      </div>

      <h2>The rules</h2>
      <ol class="prose" style="padding-left:20px">
        <li><b>What is said here stays here.</b> No screenshots, and no quoting a member outside
          without asking. The whole value is that people can be specific.</li>
        <li><b>Answer from experience.</b> If you have not done it, say so. Speculation labelled as
          speculation is welcome; speculation dressed as fact is not.</li>
        <li><b>Reviews are about behaviour, not outcomes.</b> A funder who passed politely and fast
          deserves a better review than one who strung you along and then wired.</li>
        <li><b>Anonymity is for candour, not cover.</b> Use it for the awkward question or the honest
          review. Stewards can still see who posted.</li>
        <li><b>Nothing that helps anyone hurt people.</b> No protocols, sequences or acquisition
          routes for agents that could cause mass harm. Same line as the public side.</li>
      </ol>

      <h2>Where things live</h2>
      <p class="prose">Forum for questions, people for expertise, labs for who is building what,
        deals for money you do not have to spend, funders for who to talk to and what happened last
        time, office hours for a real half hour with someone, jobs and events for the rest. Search
        covers all of it at once.</p>

      <h2>What is private</h2>
      <p class="prose">Every page here requires an account and carries a noindex tag. Your pipeline
        notes are visible only to you. An anonymous post does not merely hide your handle in the
        page — the database does not return it. Deal codes are readable only after you claim them.
        None of this is enforced in the browser, which cannot be trusted; it is enforced in Postgres
        by row-level security and column privileges.</p>
    </div>`);
});
