-- Run only after migration 202610280002. All test records roll back.
begin;
insert into public.applications (id,full_name,source)
values ('00000000-0000-4000-8000-000000000001','Dashboard connection test','Website');
select set_config('request.jwt.claims','{"sub":"fa2ee240-caed-42ab-a2be-62ce3bc60306","email":"info@charizma-mgmt.com","role":"authenticated"}',true);
set local role authenticated;
do $test$
begin
    if not public.is_charizma_staff() then raise exception 'Staff identity check failed'; end if;
    if (select count(*) from public.applications where id='00000000-0000-4000-8000-000000000001') <> 1 then raise exception 'Staff read failed'; end if;
    update public.applications set status='Reviewing' where id='00000000-0000-4000-8000-000000000001';
    insert into public.application_notes (application_id,author_id,body)
    values ('00000000-0000-4000-8000-000000000001',auth.uid(),'Temporary verification note');
    if (select count(*) from public.application_events where application_id='00000000-0000-4000-8000-000000000001' and event_type in ('status_changed','note_added')) <> 2 then raise exception 'Audit history failed'; end if;
    if has_column_privilege('authenticated','public.applications','email','UPDATE') then raise exception 'Unnecessary applicant edit privilege'; end if;
    if has_table_privilege('authenticated','public.applications','DELETE') then raise exception 'Unexpected delete privilege'; end if;
    if has_table_privilege('anon','public.applications','SELECT') then raise exception 'Anonymous read must remain denied'; end if;
    if has_table_privilege('authenticated','public.application_notifications','SELECT') then raise exception 'Notification queue must remain server-only'; end if;
end;
$test$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","email":"other@example.com","role":"authenticated"}',true);
set local role authenticated;
do $test$
begin
    if public.is_charizma_staff() then raise exception 'Unexpected staff identity'; end if;
    if (select count(*) from public.applications) <> 0 then raise exception 'Unapproved account can read applications'; end if;
end;
$test$;
reset role;
rollback;
