-- Grant only the owner's confirmed shared staff account access to review records.
-- Public applicants receive no database or Storage permissions.
begin;
create function public.is_charizma_staff() returns boolean
language sql stable set search_path = '' as $$
    select auth.uid() = 'fa2ee240-caed-42ab-a2be-62ce3bc60306'::uuid
       and lower(auth.jwt()->>'email') = 'info@charizma-mgmt.com';
$$;
revoke all on function public.is_charizma_staff() from public, anon;
grant execute on function public.is_charizma_staff() to authenticated;

grant select on public.applications, public.application_photos,
    public.application_notes, public.application_events to authenticated;
grant update (status) on public.applications to authenticated;
grant insert (application_id, author_id, body) on public.application_notes to authenticated;

create policy staff_read_applications on public.applications for select to authenticated using ((select public.is_charizma_staff()));
create policy staff_update_status on public.applications for update to authenticated
    using ((select public.is_charizma_staff())) with check ((select public.is_charizma_staff()));
create policy staff_read_photos on public.application_photos for select to authenticated using ((select public.is_charizma_staff()));
create policy staff_read_notes on public.application_notes for select to authenticated using ((select public.is_charizma_staff()));
create policy staff_add_notes on public.application_notes for insert to authenticated
    with check ((select public.is_charizma_staff()) and author_id = (select auth.uid()));
create policy staff_read_events on public.application_events for select to authenticated using ((select public.is_charizma_staff()));
create policy staff_view_digitals on storage.objects for select to authenticated
    using (bucket_id = 'application-digitals' and (select public.is_charizma_staff()));

-- Write audit history in the same transaction as each review change.
create function public.audit_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    new.updated_at := now();
    if new.status is distinct from old.status then
        insert into public.application_events (application_id, actor_id, event_type, details)
        values (new.id, auth.uid(), 'status_changed', jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    return new;
end;
$$;
create function public.audit_application_note() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.application_events (application_id, actor_id, event_type, details)
    values (new.application_id, new.author_id, 'note_added', jsonb_build_object('note_id', new.id));
    return new;
end;
$$;
revoke all on function public.audit_application_status(), public.audit_application_note() from public, anon, authenticated;
create trigger audit_application_status before update on public.applications
    for each row execute function public.audit_application_status();
create trigger audit_application_note after insert on public.application_notes
    for each row execute function public.audit_application_note();
commit;
