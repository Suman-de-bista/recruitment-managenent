# TechKraft Recruiter Dashboard

A full-stack internal recruiter dashboard for managing candidates, reviewer scores, role-based access, and AI-assisted candidate summaries. The app uses FastAPI, React/Vite, SQLite, and Docker Compose.

## Run Locally

Create an environment file from the example and adjust local values:

```bash
cp .env.example .env
```

Build and start the app:

```bash
docker compose up -d --build
```

The `--build` flag tells Docker Compose to rebuild the backend and frontend images before starting containers.

Seed the database before using the dashboard:

```bash
docker compose exec backend python scripts/dummy_candidates.py
```

This step is required for the default admin account, a reviewer account, and demo candidates. Safe to re-run — it skips seeding whenever data already exists. The seeded admin login is:

```text
email: admin@example.com
password: admin@123
```

Open:

```text
http://localhost:5173
```

The FastAPI API is served at:

```text
http://localhost:8000/api/v1
```

Swagger docs:

```text
http://localhost:8000/docs
```

## Useful Commands

Run backend tests:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m pytest tests -q
```

Seed demo data again if needed:

```bash
docker compose exec backend python scripts/dummy_candidates.py
```

Stop containers:

```bash
docker compose down
```

## Example API Calls

Register a reviewer:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"reviewer2@example.com","password":"password123"}'
```

Login with the seeded admin account:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin@123"}'
```

List candidates with a token:

```bash
curl "http://localhost:8000/api/v1/candidates?status=new&page=1&page_size=20" \
  -H "Authorization: Bearer <access_token>"
```

Admin: create a candidate:

```bash
curl -X POST http://localhost:8000/api/v1/candidates \
  -H "Content-Type: application/json" -H "Authorization: Bearer <admin_token>" \
  -d '{"name":"Grace Hopper","email":"grace@example.com","role_applied":"Backend Engineer","skills":["Python","SQL"]}'
```

Submit a score (category must be one of the candidate's skills):

```bash
curl -X POST http://localhost:8000/api/v1/candidates/1/scores \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"category":"Python","score":4,"note":"Strong on system design"}'
```

Trigger AI summary generation (mocked, ~2s delay):

```bash
curl -X POST http://localhost:8000/api/v1/candidates/1/summary -H "Authorization: Bearer <token>"
```

Admin: archive (soft-delete) a candidate:

```bash
curl -X DELETE http://localhost:8000/api/v1/candidates/1 -H "Authorization: Bearer <admin_token>"
```

## Architecture Decision Record

### 1. FastAPI For The Backend

**Context:** The assignment needed a working API quickly with authentication, filtering, validation, and a small test surface.

**Decision:** I used FastAPI because it is easy to get a project running quickly, provides request validation through Pydantic, and needs fewer extra package dependencies for a clean API compared with heavier alternatives.

**Trade-off:** FastAPI keeps the backend lightweight, but more production concerns like migrations, background workers, and observability still need explicit setup.

### 2. SQLite With Relational Candidate And Score Tables

**Context:** Candidates and reviewer scores have clear relationships, and reviewers must only see their own scores while admins see all scores.

**Decision:** I modeled candidates and scores as separate relational tables with indexes on common query fields like candidate status, role, candidate ID, and reviewer ID.

**Trade-off:** SQLite is simple for local/demo use, but a hosted production version should move to PostgreSQL for stronger concurrency and operational reliability.

### 3. Manual JWT Authentication (Single Access Token)

**Context:** The project needed email/password auth, reviewer/admin roles, and a rule that registration never accepts role from the client.

**Decision:** I implemented JWT handling manually (HMAC-SHA256 signed header.payload.signature) instead of relying on `python-jose`, and PBKDF2-HMAC password hashing instead of bcrypt, to keep the auth flow visible and dependency-light. New registrations are hardcoded to the reviewer role. The token itself is delivered to the browser as an httpOnly, `SameSite=Lax` cookie set by `POST /auth/login` — never stored in localStorage or read by frontend JS — so it isn't directly exposed to an XSS payload the way a JS-readable token would be. `GET /auth/me` lets the frontend confirm/refresh the current user without touching the token. The API also still accepts a `Authorization: Bearer` header (checked first when present) for curl/Swagger use, matching the examples below.

**Trade-off:** This avoids hiding the auth flow behind a large dependency, but I deliberately scoped this down to a single access token (no refresh-token rotation). That means tokens can't be revoked before they expire without adding a blocklist — acceptable for a 60-minute-expiry internal tool, but a gap a production app handling sensitive data would want to close.

## Debugging Signal

The bug in the sample query is that it loads every candidate first:

```python
all_candidates = db.execute("SELECT * FROM candidates").fetchall()
```

Then filtering and pagination happen in Python. This matters at scale because the database must send the full table to the application, memory usage grows with total candidate count, and each page gets slower as the table grows — the `candidates.status`/`role_applied` indexes go completely unused since filtering never touches SQL.

The correct approach is to push filtering, search, ordering, limit, and offset into the database query:

```sql
SELECT *
FROM candidates
WHERE status = :status
  AND (name LIKE :keyword OR email LIKE :keyword)
ORDER BY created_at DESC
LIMIT :page_size OFFSET :offset;
```

That lets the database use indexes and return only the requested page. This project's actual implementation does exactly this — see [`backend/services/candidate_service.py`](backend/services/candidate_service.py), which builds the `WHERE` conditions and applies `.offset()/.limit()` via SQLAlchemy before executing the query (the one exception is the `skill` filter against the JSON `skills` column, which SQLite can't index/query portably through the ORM, so it's filtered in Python only for that one predicate — documented inline in the code).

## Learning Reflection

One thing I tried more deliberately here was implementing JWT authentication manually instead of relying on a full auth package (`python-jose`/`passlib`) — hand-rolling the base64url encoding, HMAC signing, and PBKDF2 password hashing made the token lifecycle much easier to reason about end-to-end. Given more time, I would explore rotating refresh tokens, the SSE stretch goal for live score updates, and replacing SQLite with PostgreSQL for a deployment-ready setup.

## Notes

- Registration always creates reviewer accounts; the client cannot choose an admin role (there is no `role` field on the registration schema at all).
- Real credentials should stay out of git. Use `.env.example` for placeholder values only.
- Candidate deletion is handled as a soft archive (`status=archived` + `deleted_at` timestamp) rather than a hard delete.
- Candidate creation (`POST /candidates`) and editing (`PATCH /candidates/{id}`) are admin-only; reviewers can view, filter, and score candidates but not create or edit them.
