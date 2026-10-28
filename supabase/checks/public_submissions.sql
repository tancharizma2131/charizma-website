-- Rollback-only verification. No photos or permanent applicant records are created.
begin;
set local role service_role;
do $test$
declare
    ticket public.application_submissions;
    app_id uuid;
    expected_id uuid := '00000000-0000-4000-8000-000000000003';
    details jsonb := '{"fullName":"Submission connection test","birthDate":"2004-04-18","location":"Bangkok, Thailand","email":"connection-test@example.com","instagram":"@connection.test","height":175,"bust":82,"waist":60,"hips":90,"tattoos":false,"piercings":false,"source":"Connection test","portfolio":""}'::jsonb;
    manifest jsonb := '[{"kind":"headshot","type":"image/webp","size":100},{"kind":"angle","type":"image/webp","size":100},{"kind":"half","type":"image/webp","size":100},{"kind":"full","type":"image/webp","size":100}]'::jsonb;
    photos jsonb;
    claims integer;
begin
    ticket:=public.start_application_submission(expected_id,repeat('a',64),'connection-test-ip','connection-test-email',details,manifest);
    ticket:=public.start_application_submission(expected_id,repeat('a',64),'connection-test-ip','connection-test-email',details,manifest);
    if (select count(*) from public.application_submissions where id=expected_id)<>1 then raise exception 'Ticket retry duplicated'; end if;
    select jsonb_agg(jsonb_build_object('kind',kind,'path','applications/'||expected_id::text||'/'||kind||'.webp','size',100)) into photos
    from unnest(array['headshot','angle','half','full']) kind;
    app_id:=public.complete_application_submission(expected_id,repeat('a',64),photos);
    app_id:=public.complete_application_submission(expected_id,repeat('a',64),photos);
    if (select count(*) from public.applications where id=expected_id)<>1 then raise exception 'Application retry duplicated'; end if;
    if (select count(*) from public.application_photos where application_id=expected_id)<>4 then raise exception 'Photos missing'; end if;
    if (select count(*) from public.application_events where application_id=expected_id and event_type='received')<>1 then raise exception 'Receipt history missing'; end if;
    if (select count(*) from public.application_notifications where application_id=expected_id)<>1 then raise exception 'Notification duplicated'; end if;
    select count(*) into claims from public.claim_application_notifications(1,expected_id);
    if claims<>1 then raise exception 'Notification claim failed'; end if;
    select count(*) into claims from public.claim_application_notifications(1,expected_id);
    if claims<>0 then raise exception 'Notification claimed twice'; end if;
end;
$test$;
reset role;
do $test$
begin
    if has_table_privilege('anon','public.application_submissions','SELECT') or has_table_privilege('authenticated','public.application_submissions','SELECT') then raise exception 'Submission drafts exposed'; end if;
    if has_function_privilege('anon','public.start_application_submission(uuid,text,text,text,jsonb,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.complete_application_submission(uuid,text,jsonb)','EXECUTE') then raise exception 'Server-only operations exposed'; end if;
    if (select public from storage.buckets where id='application-uploads') then raise exception 'Upload bucket must be private'; end if;
end;
$test$;
rollback;
