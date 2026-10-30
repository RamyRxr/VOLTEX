-- Row Level Security (spec §5). Apply after every migration:
--   pnpm --filter web exec prisma db execute --file prisma/sql/rls.sql --schema prisma/schema.prisma
-- Idempotent: safe to run again.
--
-- Supabase exposes the public schema through its REST API with the anon key.
-- Every table gets RLS with no policy (deny all) so data only flows through
-- our API, which connects as the table owner and is not affected by RLS.
-- The only exception is Message, read and written directly by both apps.

alter table public."Profile"        enable row level security;
alter table public."Doctor"         enable row level security;
alter table public."Patient"        enable row level security;
alter table public."InviteCode"     enable row level security;
alter table public."LinkRequest"    enable row level security;
alter table public."BpSession"      enable row level security;
alter table public."Questionnaire"  enable row level security;
alter table public."RiskAssessment" enable row level security;
alter table public."Alert"          enable row level security;
alter table public."DoctorNote"     enable row level security;
alter table public."Message"        enable row level security;
alter table public."_prisma_migrations" enable row level security;

-- True when the current user is the patient or the doctor of an ACCEPTED link.
-- SECURITY DEFINER so it can read the link tables, which stay closed to clients.
create or replace function public.is_link_participant(link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."LinkRequest" l
    join public."Patient" p on p.id = l."patientId"
    join public."Doctor"  d on d.id = l."doctorId"
    where l.id = link_id
      and l.status = 'ACCEPTED'
      and (p."profileId" = auth.uid() or d."profileId" = auth.uid())
  );
$$;

revoke all on function public.is_link_participant(uuid) from public, anon;
grant execute on function public.is_link_participant(uuid) to authenticated;

drop policy if exists message_select_participants on public."Message";
create policy message_select_participants on public."Message"
  for select to authenticated
  using (public.is_link_participant("linkId"));

drop policy if exists message_insert_participants on public."Message";
create policy message_insert_participants on public."Message"
  for insert to authenticated
  with check ("senderId" = auth.uid() and public.is_link_participant("linkId"));

-- Realtime only on Message.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'Message'
  ) then
    alter publication supabase_realtime add table public."Message";
  end if;
end $$;
