# FLOX AI

AI-powered Study Planner + Focus Coach for students.

- Frontend: React (Vite) + Tailwind + Router + Axios + Framer Motion
- Backend: Django + DRF + PostgreSQL + JWT (SimpleJWT)
- AI: Gemini via Google AI Studio, with deterministic fallback responses when no key is configured
- Deploy: Frontend on Vercel, Backend on Render

## Local Setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The backend runs at `http://localhost:8000`.

Create `backend/.env` for Gemini AI and local config:

```env
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_MODELS=gemini-3.5-flash,gemini-3.1-flash-lite
FRONTEND_URL=http://localhost:5173
DEBUG=True
SECRET_KEY=your-dev-secret-key
```

Do not commit `backend/.env`. It is ignored by Git.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

Create `frontend/.env` when your API URL changes:

```env
VITE_API_URL=http://localhost:8000
```

## Social Sign-in (Google + Apple)

The Login and Register pages include "Continue with Google" and "Continue with Apple" buttons. They call `POST /api/auth/social/` with the provider's `id_token`, which the backend verifies before creating or signing in the user (returns the usual `{ access, refresh }` JWT pair plus `is_new`).

### Google (free)

1. Create an **OAuth Client ID (Web application)** at the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add your app origin (e.g. `http://localhost:5173`) under **Authorized JavaScript origins** and the same URL under **Authorized redirect URIs**.
3. Set both backend and frontend variables:

```env
# backend/.env
GOOGLE_OAUTH_CLIENT_ID=xxxx.apps.googleusercontent.com

# frontend/.env
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

### Apple (paid Apple Developer account, $99/yr)

1. In [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list/servicesId), create a **Services ID** (e.g. `com.example.FLOX.signin`) and enable the **Sign in with Apple** capability. Add your domain and a return URL (your app origin).
2. Set the variables on both sides:

```env
# backend/.env
APPLE_CLIENT_ID=com.example.FLOX.signin

# frontend/.env
VITE_APPLE_CLIENT_ID=com.example.FLOX.signin
VITE_APPLE_REDIRECT_URI=http://localhost:5173
```

Restart the backend and reload the frontend Vite dev server after changing `.env` files.

## Implemented API

- `POST /api/auth/register/`, `POST /api/auth/login/`, `POST /api/auth/social/`, `GET /api/auth/me/`
- `GET/POST /api/study/subjects/`, `/api/study/exams/`, `/api/study/tasks/`
- `GET /api/study/dashboard/`, `POST /api/study/plan/generate/`
- `GET/POST /api/productivity/logs/`, `GET /api/productivity/analytics/`
- `POST /api/ai/tutor/`, `GET /api/ai/history/`
- `POST /api/quiz/generate/`, `POST /api/quiz/<id>/submit/`
- `POST /api/burnout/analyze/`, `GET /api/burnout/reports/`

AI responses use Gemini when `GEMINI_API_KEY` is set in `backend/.env`. Without a key, the app uses deterministic fallback responses so development still works.

## Deployment Notes

Frontend on Vercel:

- Set build command to `npm run build`.
- Set output directory to `dist`.
- Set `VITE_API_URL` to the Render backend URL.

Backend on Render:

- Use `backend/requirements.txt`.
- Set start command to `gunicorn config.wsgi:application`.
- Set environment variables: `SECRET_KEY`, `DEBUG=False`, `FRONTEND_URL=https://your-vercel-app.vercel.app`.
- For PostgreSQL, replace `DATABASES` in `config/settings.py` or use `dj-database-url`.

## Security

The backend is hardened with the following controls:

- **HTTPS**: When `DEBUG=False`, Django enforces HTTPS redirects, HSTS, secure cookies, and a strict referrer policy. Terminate TLS at the load balancer/proxy and set `SECURE_PROXY_SSL_HEADER` accordingly (already configured).
- **JWT Authentication**: Stateless bearer tokens via `djangorestframework-simplejwt`. Access tokens are short-lived (default 30 min) and refresh tokens expire after 7 days. Tokens are never stored in cookies — the SPA keeps them in memory/localStorage.
- **Refresh Tokens**: The `/api/auth/token/refresh/` endpoint rotates/refreshes access tokens. The frontend interceptor in `frontend/src/lib/api.ts` automatically attaches a fresh token and redirects to login when refresh fails.
- **Environment Variables**: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `DATABASE_URL`, JWT lifetimes, throttle rates, and Gemini keys are all read from the environment (via `backend/.env` locally, or the hosting provider dashboard in production). The repo contains no real secrets.
- **Rate Limiting**: DRF throttles are enabled globally:
  - `anon`: 100 req/hour
  - `user`: 1000 req/day
  - `auth` (login/register): 10 req/minute
  - `ai` (Gemini endpoints): 30 req/minute
  Override via `THROTTLE_*` environment variables.
- **CORS**: Only explicit origins are allowed (`CORS_ALLOWED_ORIGINS`). Credentials are only sent when exact origins are configured. Never combine `CORS_ALLOW_ALL_ORIGINS` with credentials.
- **CSRF Protection**: The API uses stateless JWT bearer tokens, so CSRF tokens are not needed for API calls. Django's CSRF middleware remains enabled to protect the admin site.
- **Input Validation**: DRF serializers validate all auth payloads. AI endpoints (`backend/ai/views.py`) sanitize and length-cap `prompt`/`topic`/`mode`/`level` inputs (max 8000 chars for prompts) via `sanitize_prompt()` in `backend/ai/gemini.py`.
- **Secure Password Hashing**: Django's default PBKDF2 hashing is used via `User.set_password()`. Passwords are never stored in plaintext.
- **API Key Protection**: The Gemini API key is sent in the `x-goog-api-key` request header (not in the URL query string) so it doesn't leak into proxy/access logs. `GEMINI_API_KEY` is read only from the environment.
- **Logging & Monitoring**: Django logging is configured in `config/settings.py` with rotating file logs (`backend/logs/FLOX.log`) and console output. `django.security` and `django.request` logs are captured at `WARNING` for monitoring anomalies.

### Production Checklist

1. Set a strong random `SECRET_KEY` (e.g. `python -c "import secrets; print(secrets.token_urlsafe(50))"`).
2. Keep `DEBUG=False`.
3. Set `ALLOWED_HOSTS` to your exact backend domain.
4. Set `CORS_ALLOWED_ORIGINS` to your exact frontend origin(s).
5. Set `DATABASE_URL` to a managed PostgreSQL instance.
6. Terminate TLS at your proxy and confirm the `X-Forwarded-Proto: https` header reaches Django.
7. Set a long random `GEMINI_API_KEY` in the environment only.
8. Add `backend/logs/` and any exported log files to `.gitignore` (already done).
