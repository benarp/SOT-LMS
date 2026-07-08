-- Migration: cash/check payments recorded by an admin
-- Adds structured fields to billing_events for offline payments (method,
-- who received it, and the date it was actually paid — which may differ
-- from when the admin got around to entering it).

alter table billing_events add column if not exists payment_method text;
alter table billing_events add column if not exists received_by text;
alter table billing_events add column if not exists paid_at date;
