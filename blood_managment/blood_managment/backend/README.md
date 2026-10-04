# Blood Donation Management System Backend

FastAPI backend for connecting blood donors with emergency blood requirements.

## Main Flows

- Donor signs up in Supabase Auth, then calls `POST /api/v1/auth/register`.
- Donor creates or updates donor details at `/api/v1/donors/me`.
- Admin posts requirements at `POST /api/v1/requirements`.
- Donor sees matching open requirements at `GET /api/v1/donors/me/requirements`.
- Donor says "I can donate" via `POST /api/v1/responses`.
- Admin sees matched donors via `GET /api/v1/matching/requirements/{id}/donors`.
- Admin queues notifications via `POST /api/v1/matching/requirements/{id}/notify`.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Open API docs at `http://localhost:8000/docs`.

## Authentication

All protected endpoints expect:

```http
Authorization: Bearer <supabase_access_token>
```

Application roles live in the `profiles.role` column. New registered users are donors by default. Promote trusted admins directly in the database.

The `DONOR` role permits the regular user area; it does not mean a donor record exists. After signup/first login, My Profile lets users save personal details and optionally register as donors. `PUT /api/v1/auth/me` saves personal and donor details in one transaction, preserves existing donor records, and rejects blood-group changes after registration. The older PATCH and donor endpoints remain supported.

### Admin account directory and counts

`GET /api/v1/admin/users?limit=20&offset=0` is admin-only. It joins Supabase `auth.users`, application `profiles`, and `donors`, including unconfirmed signups, accounts awaiting profile setup, and legacy profiles whose login account is missing. Only selected directory fields are returned; Auth metadata never controls roles. The saved application name takes precedence over signup metadata.

The backend `DATABASE_URL` must point to the same Supabase database as Auth. Its server-side database role needs SELECT access to `auth.users` (id, email, raw_user_meta_data, email_confirmed_at, created_at), in addition to application tables. The directory does not create or modify Auth tables, and requires no application schema migration. A standalone Postgres database without Supabase Auth cannot provide this directory. Missing Auth schema/permissions return 503 instead of an empty user list or zero users; check backend database configuration if that happens. Never expose the database connection or service key in frontend variables.

`/admin/stats` returns `totalUsers` (unique Auth/profile accounts), `totalDonors` (saved donor records), and `availableDonors` (availability switched on), plus existing request counts. Availability is a user preference, not a medical eligibility assessment. The UI has separate paginated lists and refresh/retry controls.

Matching uses the exact blood group and available donors across all cities; there is no location/distance filter. Donors can browse active requests while unavailable, but must enable availability before responding. `/donors/me/requirements/page` provides paginated active matches and an exact filtered total; the previous list endpoint remains available. Admin request previews use `active_only=true`. Closed requests cannot send new donor notifications.

JWT verification uses Supabase's `/auth/v1/.well-known/jwks.json` endpoint for asymmetric keys and the Auth `/user` endpoint for legacy HS256 tokens. See [Supabase JWT documentation](https://supabase.com/docs/guides/auth/jwts).

Set `CORS_ORIGINS` to the actual frontend origins (including localhost during development). The frontend `VITE_API_URL` must include `/api/v1`; deployed frontends must use the deployed backend URL rather than localhost. Frontend and backend must reference the same Supabase project.

In Supabase Auth URL Configuration, allow the frontend `/login` and `/reset-password` URLs for confirmation and password recovery. Signup with email confirmation enabled creates the application profile on the first confirmed login.

## Regression checks

Install `requirements-dev.txt`, then run `python -m pytest tests -q`. Tests use a separate in-memory SQLite database and mocked authentication, never production data. Real Supabase email delivery, live Postgres and deployed CORS still require integration verification.

ORM enum names match the SQL migrations below. Databases created with earlier `AUTO_CREATE_TABLES` versions may use names without underscores. No live database changes are applied automatically.

## Database

For local development you can set `AUTO_CREATE_TABLES=true` once to create tables automatically. For production, keep it `false` and apply [migrations/001_initial_schema.sql](migrations/001_initial_schema.sql) in Supabase/Postgres for a new database. Creating tables with `IF NOT EXISTS` does not repair the types of columns that already exist.

### Repair existing enum mismatches

If logs report missing types such as `requirement_status`, or `bloodgroup` versus `blood_group`, run the entire [migrations/002_reconcile_enum_types.sql](migrations/002_reconcile_enum_types.sql) file in the Supabase SQL Editor for the backend's database. It reconciles all seven enum types across eight columns, including databases where the donor blood-group column has already been fixed.

The migration creates missing target enum types, validates existing target labels and stored values, converts legacy blood-group labels such as `A_POS` to `A+`, and preserves existing defaults. Already-correct columns are skipped. It does not delete application records or drop legacy enum types. Missing tables/columns, unknown values, incompatible target enums, or blocking dependencies abort the transaction; inspect the error instead of deleting types or columns. This does not reconstruct previously deleted columns or their data.

Run during a quiet period: the transaction locks the five affected tables, with a five-second lock timeout and a two-minute statement timeout. Successful execution returns eight rows with `status = OK`. Restart the Render backend afterward to clear pooled asyncpg connections/type caches, then retry donor registration, requirements listing, and the admin dashboard. Keep `AUTO_CREATE_TABLES=false` in production; future schema changes need migrations.

To validate the migration locally, install PostgreSQL command-line tools on PATH and run `python tests/check_enum_migration.py`. This uses a new temporary local PostgreSQL cluster and never reads `DATABASE_URL`. It checks legacy and current schemas, partial repairs, repeat execution, defaults, preservation of records, and rollback on incompatible data/schema.
