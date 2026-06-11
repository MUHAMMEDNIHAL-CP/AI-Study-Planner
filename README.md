# FocusFlow AI

AI-powered Study Planner + Focus Coach for students.

- Frontend: React (Vite) + Tailwind + Router + Axios + Framer Motion
- Backend: Django + DRF + PostgreSQL + JWT (SimpleJWT)
- AI: OpenAI or Gemini
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

## Implemented API

- `POST /api/auth/register/`, `POST /api/auth/login/`, `GET /api/auth/me/`
- `GET/POST /api/study/subjects/`, `/api/study/exams/`, `/api/study/tasks/`
- `GET /api/study/dashboard/`, `POST /api/study/plan/generate/`
- `GET/POST /api/productivity/logs/`, `GET /api/productivity/analytics/`
- `POST /api/ai/tutor/`, `GET /api/ai/history/`
- `POST /api/quiz/generate/`, `POST /api/quiz/<id>/submit/`
- `POST /api/burnout/analyze/`, `GET /api/burnout/reports/`

AI responses are deterministic mock responses by default, so the app works without provider keys.

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
