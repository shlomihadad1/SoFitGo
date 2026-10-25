-- Rollback of 20261025000300_sofitgo_admin_accounts.sql. Removes the read-only accounts overview function. No data is touched.
drop function if exists public.cms_accounts_overview();
