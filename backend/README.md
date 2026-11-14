# Backend authentication setup

Authentication uses PostgreSQL through SQLAlchemy, Argon2id password hashes, and opaque server-side sessions stored in `auth_sessions`. Set `DATABASE_URL` before running the API; startup creates the additive `users` and `auth_sessions` tables. There was no migration framework in this project, so this is an additive schema initializer and never drops tables.

Copy `.env.example` to `.env`, replace the database URL, then install and run:

```powershell
python -m pip install -r requirements.txt
python app.py
```

For production, set `APP_ENV=production`, a PostgreSQL `DATABASE_URL`, a long random `SESSION_TOKEN_SECRET`, and `FRONTEND_ORIGIN` to the exact deployed frontend origin. Use `SESSION_COOKIE_SAMESITE=None` only for cross-site frontend/backend deployments; production then requires HTTPS and sets the cookie `Secure` and `HttpOnly`. Browser clients must send credentialed requests and pass the `csrf_token` returned by registration or login in `X-CSRF-Token` for `POST /auth/logout`.

```text
POST /auth/register  {"email":"user@example.com","password":"StrongPassword123!"}
POST /auth/login     {"email":"user@example.com","password":"StrongPassword123!"}
GET  /auth/me
POST /auth/logout    X-CSRF-Token: <csrf token>
```

Example requests (the browser retains the `iki_session` cookie):

```powershell
curl.exe -i -c cookies.txt -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"StrongPassword123!"}' http://localhost:5000/auth/register
curl.exe -i -c cookies.txt -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"StrongPassword123!"}' http://localhost:5000/auth/login
curl.exe -i -b cookies.txt http://localhost:5000/auth/me
curl.exe -i -b cookies.txt -H "X-CSRF-Token: <csrf_token_from_login_or_register>" -X POST http://localhost:5000/auth/logout
```

Passwords must be 12–128 characters and contain upper-case, lower-case, number, and symbol characters. Registration and login establish a seven-day session by default and return the public user record plus a CSRF token; password hashes are never returned.

`/upload` and `/chat` deliberately remain public during this phase. Existing uploaded PDFs live on disk and the existing Chroma collection is global, with no ownership records to migrate safely. A future document-isolation rollout needs a `documents` ownership table, per-user Chroma metadata/collections, migration/backfill policy for legacy data, and authenticated ownership checks before these endpoints can be protected.
