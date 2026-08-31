// Every query Homeroom makes, in one place.
//
// Reads go straight to PostgREST, because row-level security already decides
// what a member may see. Writes that span rows go through the RPC functions
// in supabase/schema.sql, because the browser cannot be trusted to keep those
// rules. If you are adding a write and wondering which it should be: if a
// malicious client calling it directly could break something, it is an RPC.

import { supabase } from './client.js';

const PAGE = 20;

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

/* ── forum ──────────────────────────────────────────────────────────── */

export async function feed({
  sort = 'hot', category = '', kind = '', tag = '', unanswered = false,
  author = '', orgId = 0, page = 1, limit = PAGE,
} = {}) {
  let query = supabase.from('hr_feed').select('*', { count: 'exact' });
  if (category) query = query.eq('category', category);
  if (kind) query = query.eq('kind', kind);
  if (tag) query = query.contains('tags', [tag]);
  if (author) query = query.eq('author_handle', author);
  if (orgId) query = query.eq('org_id', orgId);
  if (unanswered) query = query.eq('comment_count', 0);

  const order = {
    hot: ['score', false],
    new: ['created_at', false],
    active: ['last_active_at', false],
    top: ['points', false],
    discussed: ['comment_count', false],
  }[sort] || ['score', false];

  query = query
    .order('pinned', { ascending: false })
    .order(order[0], { ascending: order[1] })
    .range((page - 1) * limit, page * limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { posts: data ?? [], total: count ?? 0 };
}

export async function post(id) {
  return unwrap(await supabase.from('hr_feed').select('*').eq('id', id).maybeSingle());
}

export async function comments(postId) {
  const rows = unwrap(await supabase
    .from('hr_comments')
    .select('*, author:hr_members!hr_comments_shown_author_fk(handle,name)')
    .eq('post_id', postId)
    .order('points', { ascending: false })
    .order('created_at', { ascending: true }));

  // Flatten into display order: each subtree follows its parent.
  const byParent = new Map();
  for (const row of rows ?? []) {
    const key = row.parent_id ?? 0;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(row);
  }
  const out = [];
  const walk = (parent) => {
    for (const row of byParent.get(parent) ?? []) { out.push(row); walk(row.id); }
  };
  walk(0);
  return out;
}

export const createPost = (fields) => rpc('hr_create_post', {
  p_title: fields.title, p_body: fields.body ?? '', p_kind: fields.kind ?? 'question',
  p_category: fields.category ?? 'general', p_tags: fields.tags ?? [],
  p_org_id: fields.orgId ?? null, p_anonymous: !!fields.anonymous, p_options: fields.options ?? [],
});

export const createComment = (postId, body, parentId = null, anonymous = false) =>
  rpc('hr_create_comment', { p_post_id: postId, p_body: body, p_parent_id: parentId, p_anonymous: anonymous });

export const vote = (kind, id, direction) => rpc('hr_vote', { p_kind: kind, p_id: id, p_direction: direction });
export const acceptAnswer = (postId, commentId) =>
  rpc('hr_accept_answer', { p_post_id: postId, p_comment_id: commentId });
export const castPollVote = (postId, optionId) =>
  rpc('hr_cast_poll_vote', { p_post_id: postId, p_option_id: optionId });
export const bumpViews = (postId) => rpc('hr_bump_views', { p_post_id: postId }).catch(() => {});
export const bumpReads = (entryId) => rpc('hr_bump_reads', { p_entry_id: entryId }).catch(() => {});

export const editPost = (id, fields) => unwrap(
  supabase.from('hr_posts').update({ ...fields, edited_at: new Date().toISOString() }).eq('id', id),
);
export const editComment = (id, body) => unwrap(
  supabase.from('hr_comments').update({ body, edited_at: new Date().toISOString() }).eq('id', id),
);
export const deleteComment = (id) => unwrap(
  supabase.from('hr_comments').update({ deleted: true, body: '' }).eq('id', id),
);

export const pollOptions = async (postId) => unwrap(
  await supabase.from('hr_poll_options').select('*').eq('post_id', postId).order('position'),
);
export const myPollVote = async (postId) => (unwrap(
  await supabase.from('hr_poll_votes').select('option_id').eq('post_id', postId).maybeSingle(),
))?.option_id ?? null;

export async function myVotes(kind, ids) {
  if (!ids.length) return new Set();
  const rows = unwrap(await supabase.from('hr_votes').select('target_id')
    .eq('target_kind', kind).in('target_id', ids));
  return new Set((rows ?? []).map((r) => Number(r.target_id)));
}

export async function toggleMark(table, kind, id, on) {
  if (on) return unwrap(await supabase.from(table).delete().eq('target_kind', kind).eq('target_id', id));
  const { data: user } = await supabase.auth.getUser();
  return unwrap(await supabase.from(table)
    .insert({ member_id: user.user.id, target_kind: kind, target_id: id }));
}

export async function isMarked(table, kind, id) {
  const rows = unwrap(await supabase.from(table).select('target_id')
    .eq('target_kind', kind).eq('target_id', id).limit(1));
  return (rows ?? []).length > 0;
}

export async function savedPosts() {
  const rows = unwrap(await supabase.from('hr_saves').select('target_id')
    .eq('target_kind', 'post').order('created_at', { ascending: false }));
  const ids = (rows ?? []).map((r) => Number(r.target_id));
  if (!ids.length) return [];
  return unwrap(await supabase.from('hr_feed').select('*').in('id', ids)) ?? [];
}

export async function tagCloud(limit = 24) {
  const rows = unwrap(await supabase.from('hr_posts').select('tags').limit(400));
  const counts = new Map();
  for (const row of rows ?? []) for (const tag of row.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export async function categoryCounts() {
  const rows = unwrap(await supabase.from('hr_posts').select('category').limit(1000));
  const counts = {};
  for (const row of rows ?? []) counts[row.category] = (counts[row.category] ?? 0) + 1;
  return counts;
}

/* ── members ────────────────────────────────────────────────────────── */

const MEMBER_FIELDS = '*, expertise:hr_expertise(tag)';

export async function members({ q = '', tag = '', cohort = '', location = '', open = '', page = 1, limit = PAGE } = {}) {
  let ids = null;
  if (tag) {
    const rows = unwrap(await supabase.from('hr_expertise').select('member_id').eq('tag', tag));
    ids = (rows ?? []).map((r) => r.member_id);
    if (!ids.length) return { members: [], total: 0 };
  }
  let query = supabase.from('hr_members').select(MEMBER_FIELDS, { count: 'exact' });
  if (ids) query = query.in('id', ids);
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `handle.ilike.${like},name.ilike.${like},headline.ilike.${like},bio.ilike.${like},` +
      `org.ilike.${like},working_on.ilike.${like},ask_me_about.ilike.${like}`,
    );
  }
  if (cohort) query = query.eq('cohort', cohort);
  if (location) query = query.ilike('location', `%${location}%`);
  const column = { intros: 'open_intros', hours: 'open_hours', collab: 'open_collab', hiring: 'open_hiring' }[open];
  if (column) query = query.eq(column, true);

  const { data, error, count } = await query
    .order('karma', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) throw error;
  return { members: data ?? [], total: count ?? 0 };
}

export const member = async (handle) => unwrap(
  await supabase.from('hr_members').select(MEMBER_FIELDS).eq('handle', handle).maybeSingle(),
);

export const updateMember = (id, fields) => unwrap(
  supabase.from('hr_members').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id),
);

export async function setExpertise(memberId, tags) {
  unwrap(await supabase.from('hr_expertise').delete().eq('member_id', memberId));
  if (!tags.length) return;
  unwrap(await supabase.from('hr_expertise').insert(tags.map((tag) => ({ member_id: memberId, tag }))));
}

export async function expertiseCloud(limit = 30) {
  const rows = unwrap(await supabase.from('hr_expertise').select('tag').limit(1000));
  const counts = new Map();
  for (const row of rows ?? []) counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export async function cohorts() {
  const rows = unwrap(await supabase.from('hr_members').select('cohort').not('cohort', 'is', null).limit(1000));
  const counts = new Map();
  for (const row of rows ?? []) if (row.cohort) counts.set(row.cohort, (counts.get(row.cohort) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export const claimHandle = (handle, name) => rpc('hr_claim_handle', { p_handle: handle, p_name: name ?? '' });
export const topAnswerers = (limit = 6) => rpc('hr_top_answerers', { p_limit: limit });
export const unreadCounts = async () => (await rpc('hr_unread_counts'))?.[0] ?? {};

/* ── labs ───────────────────────────────────────────────────────────── */

export async function orgs({ q = '', kind = '', stage = '', page = 1, limit = PAGE } = {}) {
  let query = supabase.from('hr_orgs').select('*, team:hr_org_members(count)', { count: 'exact' });
  if (q) {
    const like = `%${q}%`;
    query = query.or(`name.ilike.${like},tagline.ilike.${like},description.ilike.${like},location.ilike.${like}`);
  }
  if (kind) query = query.eq('kind', kind);
  if (stage) query = query.eq('stage', stage);
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) throw error;
  return { orgs: data ?? [], total: count ?? 0 };
}

export const org = async (slug) => unwrap(await supabase.from('hr_orgs').select('*').eq('slug', slug).maybeSingle());

export const orgTeam = async (orgId) => unwrap(await supabase.from('hr_org_members')
  .select('*, member:hr_members(handle,name,headline)').eq('org_id', orgId)
  .order('is_admin', { ascending: false })) ?? [];

export const createOrg = async (fields) => unwrap(
  await supabase.from('hr_orgs').insert(fields).select('slug').single(),
);
export const updateOrg = (id, fields) => unwrap(
  supabase.from('hr_orgs').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id),
);
export const joinOrg = async (orgId, memberId, role = '') => unwrap(
  await supabase.from('hr_org_members').insert({ org_id: orgId, member_id: memberId, role }),
);
export const leaveOrg = async (orgId, memberId) => unwrap(
  await supabase.from('hr_org_members').delete().eq('org_id', orgId).eq('member_id', memberId),
);
export const myOrgs = async (memberId) => (unwrap(await supabase.from('hr_org_members')
  .select('role, is_admin, org:hr_orgs(*)').eq('member_id', memberId)) ?? [])
  .map((row) => ({ ...row.org, role: row.role, is_admin: row.is_admin }));

export const orgUpdates = async (orgId, limit = 10) => unwrap(await supabase.from('hr_updates')
  .select('*, author:hr_members(handle,name)').eq('org_id', orgId)
  .order('created_at', { ascending: false }).limit(limit)) ?? [];

export const recentUpdates = async (limit = 4) => unwrap(await supabase.from('hr_updates')
  .select('*, org:hr_orgs(name,slug), author:hr_members(handle,name)')
  .order('created_at', { ascending: false }).limit(limit)) ?? [];

export const createUpdate = async (fields) => unwrap(await supabase.from('hr_updates').insert(fields));

/* ── deals ──────────────────────────────────────────────────────────── */

export async function deals({ category = '', q = '' } = {}) {
  let query = supabase.from('hr_deals').select('*, claims:hr_deal_claims(count)').eq('active', true);
  if (category) query = query.eq('category', category);
  if (q) {
    const like = `%${q}%`;
    query = query.or(`vendor.ilike.${like},title.ilike.${like},summary.ilike.${like}`);
  }
  return unwrap(await query.order('created_at', { ascending: false })) ?? [];
}

export const deal = async (slug) => unwrap(
  await supabase.from('hr_deals')
    .select('*, claims:hr_deal_claims(count), poster:hr_members(handle,name)')
    .eq('slug', slug).maybeSingle(),
);
export const createDeal = async (fields) => unwrap(await supabase.from('hr_deals').insert(fields).select('slug').single());
export const claimDeal = (dealId) => rpc('hr_claim_deal', { p_deal_id: dealId });
export const myDealCode = (dealId) => rpc('hr_my_deal_code', { p_deal_id: dealId });
export const myClaims = async () => (unwrap(await supabase.from('hr_deal_claims').select('deal_id')) ?? [])
  .map((row) => row.deal_id);

/* ── funders ────────────────────────────────────────────────────────── */

export async function funders({ q = '', kind = '', sort = 'rating', page = 1, limit = PAGE } = {}) {
  let query = supabase.from('hr_funder_stats').select('*', { count: 'exact' });
  if (q) {
    const like = `%${q}%`;
    query = query.or(`name.ilike.${like},focus.ilike.${like},description.ilike.${like},location.ilike.${like}`);
  }
  if (kind) query = query.eq('kind', kind);
  const order = {
    rating: ['avg_rating', false], reviews: ['review_count', false],
    name: ['name', true], new: ['created_at', false],
  }[sort] || ['avg_rating', false];
  const { data, error, count } = await query
    .order(order[0], { ascending: order[1], nullsFirst: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) throw error;
  return { funders: data ?? [], total: count ?? 0 };
}

export const funder = async (slug) => unwrap(
  await supabase.from('hr_funder_stats').select('*').eq('slug', slug).maybeSingle(),
);
export const createFunder = async (fields) => unwrap(
  await supabase.from('hr_funders').insert(fields).select('slug').single(),
);
export const funderReviews = async (funderId) => unwrap(await supabase.from('hr_funder_reviews')
  .select('*, author:hr_members!hr_reviews_shown_author_fk(handle,name)')
  .eq('funder_id', funderId).order('created_at', { ascending: false })) ?? [];

export async function upsertReview(fields) {
  const { data: user } = await supabase.auth.getUser();
  return unwrap(await supabase.from('hr_funder_reviews')
    .upsert({ ...fields, member_id: user.user.id }, { onConflict: 'funder_id,member_id' }));
}

export const myReview = async (funderId) => unwrap(await supabase.from('hr_funder_reviews')
  .select('*').eq('funder_id', funderId).maybeSingle());

export const pipeline = async () => unwrap(await supabase.from('hr_pipeline')
  .select('*, funder:hr_funders(name,slug,kind)').order('updated_at', { ascending: false })) ?? [];

export const pipelineEntry = async (funderId) => unwrap(await supabase.from('hr_pipeline')
  .select('*').eq('funder_id', funderId).maybeSingle());

export async function upsertPipeline(fields) {
  const { data: user } = await supabase.auth.getUser();
  return unwrap(await supabase.from('hr_pipeline').upsert(
    { ...fields, member_id: user.user.id, updated_at: new Date().toISOString() },
    { onConflict: 'member_id,funder_id' },
  ));
}

export const removePipeline = async (funderId) => unwrap(
  await supabase.from('hr_pipeline').delete().eq('funder_id', funderId),
);

/* ── office hours ───────────────────────────────────────────────────── */

export const slots = async ({ upcoming = true, hostId = '' } = {}) => {
  let query = supabase.from('hr_slots')
    .select('*, host:hr_members(handle,name), bookings:hr_bookings(count)')
    .eq('canceled', false);
  query = upcoming
    ? query.gte('starts_at', new Date(Date.now() - 3600e3).toISOString()).order('starts_at')
    : query.order('starts_at', { ascending: false });
  if (hostId) query = query.eq('host_id', hostId);
  return unwrap(await query.limit(60)) ?? [];
};

export const slot = async (id) => unwrap(await supabase.from('hr_slots')
  .select('*, host:hr_members(handle,name)').eq('id', id).maybeSingle());
export const slotBookings = async (slotId) => unwrap(await supabase.from('hr_bookings')
  .select('*, member:hr_members(handle,name)').eq('slot_id', slotId)) ?? [];
export const createSlot = async (fields) => unwrap(await supabase.from('hr_slots').insert(fields).select('id').single());
export const bookSlot = (slotId, question) => rpc('hr_book_slot', { p_slot_id: slotId, p_question: question ?? '' });
export const cancelBooking = async (slotId, memberId) => unwrap(
  await supabase.from('hr_bookings').delete().eq('slot_id', slotId).eq('member_id', memberId),
);
export const cancelSlot = (id) => unwrap(supabase.from('hr_slots').update({ canceled: true }).eq('id', id));
export const myBookings = async () => (unwrap(await supabase.from('hr_bookings')
  .select('question, slot:hr_slots(*, host:hr_members(handle,name))')) ?? [])
  .map((row) => ({ ...row.slot, question: row.question }))
  .filter((s) => s && !s.canceled)
  .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

/* ── jobs ───────────────────────────────────────────────────────────── */

export async function jobs({ q = '', discipline = '', remote = false, orgId = 0 } = {}) {
  let query = supabase.from('hr_jobs')
    .select('*, org:hr_orgs(name,slug), applications:hr_applications(count)')
    .eq('closed', false);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (discipline) query = query.eq('discipline', discipline);
  if (remote) query = query.eq('remote', true);
  if (orgId) query = query.eq('org_id', orgId);
  return unwrap(await query.order('created_at', { ascending: false }).limit(60)) ?? [];
}

export const job = async (id) => unwrap(await supabase.from('hr_jobs')
  .select('*, org:hr_orgs(id,name,slug)').eq('id', id).maybeSingle());
export const createJob = async (fields) => unwrap(await supabase.from('hr_jobs').insert(fields).select('id').single());
export const closeJob = (id, closed) => unwrap(supabase.from('hr_jobs').update({ closed }).eq('id', id));
export const applyToJob = (jobId, note) => rpc('hr_apply_to_job', { p_job_id: jobId, p_note: note ?? '' });
export const jobApplicants = async (jobId) => unwrap(await supabase.from('hr_applications')
  .select('*, member:hr_members(handle,name,headline)').eq('job_id', jobId)
  .order('created_at', { ascending: false })) ?? [];
export const myApplications = async () => (unwrap(await supabase.from('hr_applications').select('job_id')) ?? [])
  .map((row) => row.job_id);

/* ── events ─────────────────────────────────────────────────────────── */

export const events = async ({ upcoming = true, kind = '' } = {}) => {
  let query = supabase.from('hr_events')
    .select('*, host:hr_members(handle,name), rsvps:hr_rsvps(count)')
    .eq('canceled', false);
  const now = new Date().toISOString();
  query = upcoming ? query.gte('starts_at', now).order('starts_at')
                   : query.lt('starts_at', now).order('starts_at', { ascending: false }).limit(6);
  if (kind) query = query.eq('kind', kind);
  return unwrap(await query.limit(60)) ?? [];
};

export const event = async (id) => unwrap(await supabase.from('hr_events')
  .select('*, host:hr_members(handle,name)').eq('id', id).maybeSingle());
export const createEvent = async (fields) => unwrap(await supabase.from('hr_events').insert(fields).select('id').single());
export const cancelEvent = (id) => unwrap(supabase.from('hr_events').update({ canceled: true }).eq('id', id));
export const rsvp = (eventId, status) => rpc('hr_rsvp', { p_event_id: eventId, p_status: status });
export const attendees = async (eventId) => unwrap(await supabase.from('hr_rsvps')
  .select('status, member:hr_members(handle,name,headline)').eq('event_id', eventId)) ?? [];
export const myRsvp = async (eventId) => (unwrap(await supabase.from('hr_rsvps')
  .select('status').eq('event_id', eventId).maybeSingle()))?.status ?? null;

/* ── library ────────────────────────────────────────────────────────── */

export async function library({ q = '', kind = '' } = {}) {
  let query = supabase.from('hr_library').select('*');
  if (kind) query = query.eq('kind', kind);
  if (q) query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,body.ilike.%${q}%`);
  return unwrap(await query.order('updated_at', { ascending: false }).limit(60)) ?? [];
}

export const libraryEntry = async (slug) => unwrap(await supabase.from('hr_library')
  .select('*, author:hr_members(handle,name)').eq('slug', slug).maybeSingle());
export const createLibraryEntry = async (fields) => unwrap(
  await supabase.from('hr_library').insert(fields).select('slug').single(),
);

/* ── intros, messages, notifications ────────────────────────────────── */

export const intros = async () => unwrap(await supabase.from('hr_intros')
  .select('*, requester:hr_members!hr_intros_requester_id_fkey(handle,name), target:hr_members!hr_intros_target_id_fkey(handle,name)')
  .order('created_at', { ascending: false })) ?? [];
export const requestIntro = (handle, reason) => rpc('hr_request_intro', { p_handle: handle, p_reason: reason });
export const resolveIntro = (id, decision) => rpc('hr_resolve_intro', { p_intro_id: id, p_decision: decision });

export const threads = async () => unwrap(await supabase.from('hr_threads')
  .select('*, members:hr_thread_members(member_id, last_read_at, member:hr_members(handle,name)), messages:hr_messages(body,created_at,sender_id)')
  .order('last_at', { ascending: false }).limit(60)) ?? [];
export const thread = async (id) => unwrap(await supabase.from('hr_threads')
  .select('*, members:hr_thread_members(member_id, member:hr_members(handle,name))')
  .eq('id', id).maybeSingle());
export const messages = async (threadId) => unwrap(await supabase.from('hr_messages')
  .select('*, sender:hr_members(handle,name)').eq('thread_id', threadId)
  .order('created_at').limit(500)) ?? [];
export const sendMessage = (threadId, body) => rpc('hr_send_message', { p_thread_id: threadId, p_body: body });
export const openDirectThread = (handle) => rpc('hr_open_direct_thread', { p_handle: handle });
export const createGroupThread = (handles, subject) =>
  rpc('hr_create_group_thread', { p_handles: handles, p_subject: subject ?? '' });
export const markThreadRead = (threadId) => rpc('hr_mark_thread_read', { p_thread_id: threadId }).catch(() => {});

export const notifications = async () => unwrap(await supabase.from('hr_notifications')
  .select('*, actor:hr_members(handle,name)').order('created_at', { ascending: false }).limit(50)) ?? [];
export const markNotificationsRead = () => rpc('hr_mark_notifications_read').catch(() => {});

export const search = (query) => rpc('hr_search', { p_query: query });

export async function networkStats() {
  const counted = async (table, filter) => {
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter) query = filter(query);
    const { count } = await query;
    return count ?? 0;
  };
  const [membersCount, orgsCount, postsCount, dealsCount, fundersCount, reviewsCount, jobsCount, libraryCount] =
    await Promise.all([
      counted('hr_members'), counted('hr_orgs'), counted('hr_posts'),
      counted('hr_deals', (q) => q.eq('active', true)), counted('hr_funders'),
      counted('hr_funder_reviews'), counted('hr_jobs', (q) => q.eq('closed', false)),
      counted('hr_library'),
    ]);
  return {
    members: membersCount, orgs: orgsCount, posts: postsCount, deals: dealsCount,
    funders: fundersCount, reviews: reviewsCount, jobs: jobsCount, library: libraryCount,
  };
}

/** Turn a title into a URL-safe slug, uniqueness handled by the database. */
export function slugify(text, fallback = 'x') {
  const base = String(text ?? '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || fallback;
}

export function parseTags(input, max = 6) {
  const seen = new Set();
  for (const piece of String(input ?? '').split(/[,\n]+/)) {
    const tag = slugify(piece.trim(), '');
    if (tag) seen.add(tag);
    if (seen.size >= max) break;
  }
  return [...seen];
}
