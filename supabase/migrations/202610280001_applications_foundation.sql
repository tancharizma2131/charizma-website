-- Charizma Applications foundation. All applicant data is server-only.
-- Run in the Charizma Applications project, never another portfolio project.
begin;

create table public.applications (
    id uuid primary key default gen_random_uuid(),
    source text not null default 'Website' check (source in ('Website', 'Google Form')),
    external_id text,
    submitted_at timestamptz not null default now(),
    imported_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    status text not null default 'New' check (status in ('New', 'Reviewing', 'Contacted', 'Archived')),
    full_name text not null check (length(full_name) between 1 and 200),
    birth_date date,
    location text,
    email text,
    instagram text,
    height numeric(5,1) check (height > 0 and height <= 300),
    bust_chest numeric(5,1) check (bust_chest > 0 and bust_chest <= 300),
    waist numeric(5,1) check (waist > 0 and waist <= 300),
    hips numeric(5,1) check (hips > 0 and hips <= 300),
    tattoos boolean,
    piercings boolean,
    heard_about text,
    portfolio_url text,
    legacy_photo_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(legacy_photo_urls) = 'array'),
    legacy_response jsonb,
    unique (source, external_id)
);

create table public.application_photos (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications(id),
    kind text not null check (kind in ('headshot', 'angle', 'half', 'full')),
    storage_path text not null unique,
    mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
    byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
    created_at timestamptz not null default now(),
    unique (application_id, kind)
);

create table public.application_notes (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications(id),
    author_id uuid not null references auth.users(id),
    body text not null check (length(trim(body)) between 1 and 2000),
    created_at timestamptz not null default now()
);

create table public.application_events (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications(id),
    actor_id uuid references auth.users(id),
    event_type text not null check (event_type in ('received', 'imported', 'status_changed', 'note_added')),
    details jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now()
);

-- A durable queue lets email delivery retry without resubmitting an application.
create table public.application_notifications (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null unique references public.applications(id),
    state text not null default 'pending' check (state in ('pending', 'sending', 'sent', 'failed')),
    attempts integer not null default 0 check (attempts >= 0),
    next_attempt_at timestamptz not null default now(),
    sent_at timestamptz,
    provider_message_id text,
    last_error text,
    created_at timestamptz not null default now()
);

create index applications_submitted_idx on public.applications (submitted_at desc);
create index applications_status_submitted_idx on public.applications (status, submitted_at desc);
create index application_notes_application_idx on public.application_notes (application_id, created_at desc);
create index application_events_application_idx on public.application_events (application_id, occurred_at desc);
create index application_notifications_retry_idx on public.application_notifications (state, next_attempt_at);

alter table public.applications enable row level security;
alter table public.application_photos enable row level security;
alter table public.application_notes enable row level security;
alter table public.application_events enable row level security;
alter table public.application_notifications enable row level security;

-- No browser role may read or write records directly. The backend must validate
-- staff sessions before using its server-only credential for dashboard actions.
revoke all on table public.applications, public.application_photos,
    public.application_notes, public.application_events,
    public.application_notifications from anon, authenticated;
grant all on table public.applications, public.application_photos,
    public.application_notes, public.application_events,
    public.application_notifications to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-digitals', 'application-digitals', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp']);
-- No public Storage policies. Upload and viewing links must be issued by the backend.

commit;
