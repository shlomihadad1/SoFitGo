-- SoFitGo · MAKE ME OWNER (run once, AFTER activate_admin.sql and after you registered and confirmed your e-mail in the app).
-- Replace YOUR-EMAIL (twice). Adds exactly one row; a wrong e-mail adds nothing; running it again changes nothing.
insert into public.cms_members (user_id, role)
select id, 'owner' from auth.users where email = 'YOUR-EMAIL'
on conflict (user_id) do nothing;

-- check: one row with your e-mail and 'owner'
select u.email, m.role, m.granted_at from public.cms_members m join auth.users u on u.id = m.user_id where u.email = 'YOUR-EMAIL';
