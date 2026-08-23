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

## Database

For local development you can set `AUTO_CREATE_TABLES=true` once to create tables automatically. For production, keep it `false` and apply [migrations/001_initial_schema.sql](/D:/client_projects/blood_managment/backend/migrations/001_initial_schema.sql) in Supabase/Postgres.
