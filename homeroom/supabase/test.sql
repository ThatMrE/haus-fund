\set ON_ERROR_STOP on
\pset pager off
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'lin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'nosy@example.com');

create or replace function act_as(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;

create or replace function must_fail(stmt text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % was allowed', label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'ok  | % refused: %', label, sqlerrm;
end $$;

set role authenticated;
select act_as('11111111-1111-1111-1111-111111111111'); select handle from hr_claim_handle('ada','Ada Fell');
select act_as('22222222-2222-2222-2222-222222222222'); select handle from hr_claim_handle('lin','Lin Marek');
select act_as('33333333-3333-3333-3333-333333333333'); select handle from hr_claim_handle('nosy','Nosy Parker');

\echo ''
\echo '--- membership gate ---'
select act_as('11111111-1111-1111-1111-111111111111');
select count(*) as "members visible to a member" from hr_members;
select act_as('');
select count(*) as "members visible when logged out" from hr_members;

\echo ''
\echo '--- anonymity ---'
select act_as('11111111-1111-1111-1111-111111111111');
select hr_create_post('What does a -80 cost to run per month?','Electricity and contract.','question','space',array['freezer']) as open_post \gset
select hr_create_post('What are freelancers really charging?','Asking anonymously.','question','hiring',array['rates'],null,true) as anon_post \gset
select id, anonymous, shown_author is null as "author hidden" from hr_posts order by id;
select must_fail('select author_id from hr_posts limit 1', 'reading author_id directly');

\echo ''
\echo '--- voting ---'
select must_fail(format('select hr_vote(''post'', %s, ''up'')', :open_post), 'upvoting your own post');
select act_as('22222222-2222-2222-2222-222222222222');
select hr_vote('post', :open_post, 'up') as "points after 1 vote";
select hr_vote('post', :open_post, 'up') as "points after voting twice";
select karma as "ada karma" from hr_members where handle='ada';
select hr_vote('post', :open_post, 'down') as "points after unvote";
select karma as "ada karma back" from hr_members where handle='ada';

\echo ''
\echo '--- accepted answers ---'
select hr_create_comment(:open_post, 'Ours is EUR 41/month plus a contract.') as answer_id \gset
select comment_count as "reply counted" from hr_posts where id = :open_post;
select must_fail(format('select hr_accept_answer(%s, %s)', :open_post, :answer_id), 'a non-asker accepting');
select act_as('11111111-1111-1111-1111-111111111111');
select hr_accept_answer(:open_post, :answer_id);
select answer_id is not null as "answer accepted" from hr_posts where id = :open_post;
select act_as('22222222-2222-2222-2222-222222222222');
select kind, body from hr_notifications;

\echo ''
\echo '--- locked threads ---'
set role postgres; update hr_posts set locked = true where id = :open_post; set role authenticated;
select must_fail(format('select hr_create_comment(%s, ''let me in'')', :open_post), 'replying to a locked thread');
set role postgres; update hr_posts set locked = false where id = :open_post; set role authenticated;

\echo ''
\echo '--- deal codes ---'
select act_as('11111111-1111-1111-1111-111111111111');
insert into hr_deals (slug, vendor, title, category, worth, code, posted_by)
  values ('helvex','Helvex Reagents','30% off enzymes','reagents','EUR 2,400/yr','SECRET-CODE-42', auth.uid());
select must_fail('select code from hr_deals limit 1', 'reading a deal code directly');
select act_as('22222222-2222-2222-2222-222222222222');
select coalesce(hr_my_deal_code((select id from hr_deals)), '(hidden)') as "code before claiming";
select hr_claim_deal((select id from hr_deals)) as "code on claiming";

\echo ''
\echo '--- pipeline is private ---'
select act_as('11111111-1111-1111-1111-111111111111');
insert into hr_funders (slug, name, kind, added_by) values ('cold-chain','Cold Chain Capital','vc', auth.uid());
insert into hr_pipeline (member_id, funder_id, status, notes)
  values (auth.uid(), (select id from hr_funders), 'diligence', 'They asked for the cap table twice.');
select count(*) as "rows the owner sees" from hr_pipeline;
select act_as('33333333-3333-3333-3333-333333333333');
select count(*) as "rows anyone else sees" from hr_pipeline;

\echo ''
\echo '--- office hours capacity ---'
select act_as('11111111-1111-1111-1111-111111111111');
insert into hr_slots (host_id, title, starts_at, capacity) values (auth.uid(), 'Scale-up clinic', now() + interval '2 days', 1);
select act_as('22222222-2222-2222-2222-222222222222');
select hr_book_slot((select id from hr_slots), 'Foam control above 300L?');
select act_as('33333333-3333-3333-3333-333333333333');
select must_fail('select hr_book_slot((select id from hr_slots))', 'booking a full session');
select act_as('11111111-1111-1111-1111-111111111111');
select must_fail('select hr_book_slot((select id from hr_slots))', 'booking your own session');

\echo ''
\echo '--- intros open a thread only its two members can read ---'
select act_as('22222222-2222-2222-2222-222222222222');
select hr_request_intro('ada','You have shipped the thing I am about to ship and I would like twenty minutes.') as intro \gset
select must_fail(format('select hr_resolve_intro(%s, ''accepted'')', :intro), 'resolving someone else''s intro');
select act_as('11111111-1111-1111-1111-111111111111');
select hr_resolve_intro(:intro, 'accepted') as thread \gset
select count(*) as "messages the target sees" from hr_messages;
select act_as('22222222-2222-2222-2222-222222222222');
select count(*) as "messages the requester sees" from hr_messages;
select act_as('33333333-3333-3333-3333-333333333333');
select count(*) as "messages an outsider sees" from hr_messages;

\echo ''
\echo '--- feed ranking lifts an unanswered question ---'
select act_as('11111111-1111-1111-1111-111111111111');
select title, round(score::numeric, 3) as score from hr_feed order by score desc;

\echo ''
\echo '--- search ---'
select jsonb_pretty(hr_search('freezer')) as search;

\echo ''
\echo '--- slugs are minted by the database, and the founder becomes an admin ---'
select act_as('11111111-1111-1111-1111-111111111111');
insert into hr_orgs (name, tagline, created_by) values ('Cultura Aberta', 'A community lab', auth.uid());
insert into hr_orgs (name, tagline, created_by) values ('Cultura Aberta', 'A different one', auth.uid());
select slug from hr_orgs order by id;
select o.name, m.handle, om.role, om.is_admin
  from hr_org_members om join hr_orgs o on o.id = om.org_id join hr_members m on m.id = om.member_id
 order by o.id;

\echo ''
\echo '--- a member cannot promote themselves in someone else s lab ---'
select act_as('33333333-3333-3333-3333-333333333333');
insert into hr_org_members (org_id, member_id, role) values ((select min(id) from hr_orgs), auth.uid(), 'volunteer');
-- Row-level security refuses by matching no rows rather than by raising, so
-- this checks the value afterwards rather than expecting an exception.
update hr_org_members set is_admin = true
 where org_id = (select min(id) from hr_orgs) and member_id = auth.uid();
select is_admin as "self-promotion took effect (must be false)" from hr_org_members
 where org_id = (select min(id) from hr_orgs) and member_id = auth.uid();

\echo ''
\echo '--- but a real admin can promote someone ---'
select act_as('11111111-1111-1111-1111-111111111111');
update hr_org_members set is_admin = true
 where org_id = (select min(id) from hr_orgs)
   and member_id = '33333333-3333-3333-3333-333333333333';
select is_admin as "admin promoted them (must be true)" from hr_org_members
 where org_id = (select min(id) from hr_orgs)
   and member_id = '33333333-3333-3333-3333-333333333333';
