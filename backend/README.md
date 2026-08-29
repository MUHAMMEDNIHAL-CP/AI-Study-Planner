# FLOX AI - Backend

Tech: Django + Django REST Framework + PostgreSQL + JWT (SimpleJWT)

## Gemini Setup

Create `backend/.env` from `.env.example`:

```env
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_MODELS=gemini-3.5-flash,gemini-3.1-flash-lite
FRONTEND_URL=http://localhost:5173
```

Restart Django after changing `.env`.
