-- Server-only submission tickets, atomic completion, and notification delivery claims.
begin;
create table public.application_submissions (
    id uuid primary key,
    token_hash text not null,
    ip_hash text not null,
    email_hash text not null,
    payload jsonb not null,
    manifest jsonb not null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '3 hours'),
    completed_at timestamptz,
    cleaned_at timestamptz,
    application_id uuid references public.applications(id)
);
alter table public.application_submissions enable row level security;
revoke all on public.application_submissions from anon, authenticated;
grant all on public.application_submissions to service_role;
create index application_submissions_created_idx on public.application_submissions(created_at);
alter table public.application_notifications add column locked_at timestamptz;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('application-uploads','application-uploads',false,2097152,array['image/jpeg','image/png','image/webp']);

create function public.start_application_submission(p_id uuid,p_token_hash text,p_ip_hash text,p_email_hash text,p_payload jsonb,p_manifest jsonb)
returns public.application_submissions language plpgsql security definer set search_path='' as $$
declare ticket public.application_submissions; used_bytes bigint;
begin
    perform pg_advisory_xact_lock(hashtextextended('charizma-submission-start',0));
    select * into ticket from public.application_submissions where id=p_id;
    if found then
        if ticket.token_hash<>p_token_hash or ticket.payload<>p_payload or ticket.manifest<>p_manifest then raise exception 'INVALID_TICKET'; end if;
        if ticket.expires_at<now() and ticket.completed_at is null then raise exception 'EXPIRED_TICKET'; end if;
        return ticket;
    end if;
    if (select count(*) from public.application_submissions where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=5
    or (select count(*) from public.application_submissions where email_hash=p_email_hash and created_at>now()-interval '1 day')>=3
    or (select count(*) from public.application_submissions where created_at>now()-interval '1 day')>=50 then raise exception 'RATE_LIMITED'; end if;
    select coalesce(sum((metadata->>'size')::bigint),0) into used_bytes from storage.objects where bucket_id in ('application-digitals','application-uploads');
    if used_bytes + (select count(*)*8388608 from public.application_submissions where completed_at is null and expires_at>now()) + 8388608 > 838860800 then raise exception 'STORAGE_FULL'; end if;
    insert into public.application_submissions(id,token_hash,ip_hash,email_hash,payload,manifest)
    values(p_id,p_token_hash,p_ip_hash,p_email_hash,p_payload,p_manifest) returning * into ticket;
    return ticket;
end;
$$;

create function public.complete_application_submission(p_id uuid,p_token_hash text,p_photos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare ticket public.application_submissions; data jsonb; photo jsonb;
begin
    select * into ticket from public.application_submissions where id=p_id for update;
    if not found or ticket.token_hash<>p_token_hash then raise exception 'INVALID_TICKET'; end if;
    if ticket.completed_at is not null then return ticket.application_id; end if;
    if ticket.expires_at<now() then raise exception 'EXPIRED_TICKET'; end if;
    if jsonb_typeof(p_photos)<>'array' or jsonb_array_length(p_photos)<>4
    or (select count(distinct item->>'kind') from jsonb_array_elements(p_photos) item where item->>'kind' in ('headshot','angle','half','full'))<>4 then raise exception 'INVALID_PHOTOS'; end if;
    data:=ticket.payload;
    insert into public.applications(id,source,full_name,birth_date,location,email,instagram,height,bust_chest,waist,hips,tattoos,piercings,heard_about,portfolio_url)
    values(ticket.id,'Website',data->>'fullName',(data->>'birthDate')::date,data->>'location',data->>'email',data->>'instagram',(data->>'height')::numeric,(data->>'bust')::numeric,(data->>'waist')::numeric,(data->>'hips')::numeric,(data->>'tattoos')::boolean,(data->>'piercings')::boolean,data->>'source',nullif(data->>'portfolio',''));
    for photo in select value from jsonb_array_elements(p_photos) loop
        if photo->>'path' <> 'applications/'||ticket.id::text||'/'||(photo->>'kind')||'.webp' then raise exception 'INVALID_PHOTOS'; end if;
        insert into public.application_photos(application_id,kind,storage_path,mime_type,byte_size)
        values(ticket.id,photo->>'kind',photo->>'path','image/webp',(photo->>'size')::bigint);
    end loop;
    insert into public.application_events(application_id,event_type,details)
    values(ticket.id,'received',jsonb_build_object('source','Website'));
    insert into public.application_notifications(application_id) values(ticket.id);
    update public.application_submissions set completed_at=now(),application_id=ticket.id where id=ticket.id;
    return ticket.id;
end;
$$;

create function public.claim_application_notifications(p_limit integer default 5,p_application_id uuid default null)
returns setof public.application_notifications language plpgsql security definer set search_path='' as $$
begin
    return query update public.application_notifications n
    set state='sending',locked_at=now(),attempts=n.attempts+1
    where n.id in (
        select q.id from public.application_notifications q
        where (p_application_id is null or q.application_id=p_application_id) and q.attempts<10 and ((q.state in ('pending','failed') and q.next_attempt_at<=now()) or (q.state='sending' and q.locked_at<now()-interval '10 minutes'))
        order by q.created_at for update skip locked limit greatest(1,least(p_limit,10))
    ) returning n.*;
end;
$$;
revoke all on function public.start_application_submission(uuid,text,text,text,jsonb,jsonb), public.complete_application_submission(uuid,text,jsonb), public.claim_application_notifications(integer,uuid) from public,anon,authenticated;
grant execute on function public.start_application_submission(uuid,text,text,text,jsonb,jsonb), public.complete_application_submission(uuid,text,jsonb), public.claim_application_notifications(integer,uuid) to service_role;
commit;
