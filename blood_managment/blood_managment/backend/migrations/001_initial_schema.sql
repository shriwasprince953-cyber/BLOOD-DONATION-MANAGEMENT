create extension if not exists "pgcrypto";

do $$ begin
    create type user_role as enum ('DONOR', 'ADMIN');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type blood_group as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type urgency_level as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type requirement_status as enum ('OPEN', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type response_status as enum ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'NO_SHOW');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type notification_channel as enum ('IN_APP', 'SMS', 'EMAIL');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type notification_status as enum ('QUEUED', 'SENT', 'FAILED');
exception
    when duplicate_object then null;
end $$;

create table if not exists profiles (
    id uuid primary key,
    full_name varchar(255) not null,
    email varchar(255) not null unique,
    phone_number varchar(20),
    role user_role not null default 'DONOR',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists donors (
    profile_id uuid primary key references profiles(id) on delete cascade,
    blood_group blood_group not null,
    is_available boolean not null default true,
    city varchar(100),
    last_donation_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists blood_requirements (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references profiles(id),
    blood_group blood_group not null,
    units_required integer not null check (units_required > 0 and units_required <= 50),
    urgency_level urgency_level not null,
    patient_name varchar(255) not null,
    hospital_name varchar(255) not null,
    location varchar(255) not null,
    notes text,
    status requirement_status not null default 'OPEN',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists donation_responses (
    id uuid primary key default gen_random_uuid(),
    donor_id uuid not null references donors(profile_id) on delete cascade,
    requirement_id uuid not null references blood_requirements(id) on delete cascade,
    status response_status not null default 'PENDING',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_donor_requirement_response unique (donor_id, requirement_id)
);

create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    donor_id uuid not null references donors(profile_id) on delete cascade,
    requirement_id uuid not null references blood_requirements(id) on delete cascade,
    channel notification_channel not null default 'IN_APP',
    status notification_status not null default 'QUEUED',
    message text not null,
    provider_message_id varchar(255),
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_notification_donor_requirement_channel unique (donor_id, requirement_id, channel)
);

create index if not exists ix_profiles_email on profiles(email);
create index if not exists ix_donors_blood_group on donors(blood_group);
create index if not exists ix_donors_is_available on donors(is_available);
create index if not exists ix_donors_city on donors(city);
create index if not exists ix_blood_requirements_admin_id on blood_requirements(admin_id);
create index if not exists ix_blood_requirements_blood_group on blood_requirements(blood_group);
create index if not exists ix_blood_requirements_urgency_level on blood_requirements(urgency_level);
create index if not exists ix_blood_requirements_status on blood_requirements(status);
create index if not exists ix_blood_requirements_hospital_name on blood_requirements(hospital_name);
create index if not exists ix_donation_responses_donor_id on donation_responses(donor_id);
create index if not exists ix_donation_responses_requirement_id on donation_responses(requirement_id);
create index if not exists ix_donation_responses_status on donation_responses(status);
create index if not exists ix_notifications_donor_id on notifications(donor_id);
create index if not exists ix_notifications_requirement_id on notifications(requirement_id);
create index if not exists ix_notifications_status on notifications(status);
