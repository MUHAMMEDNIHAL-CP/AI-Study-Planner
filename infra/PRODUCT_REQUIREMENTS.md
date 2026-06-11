# Product Requirements Document: FocusFlow AI

## 1. Product Overview

FocusFlow AI is an AI-powered study planning and focus coaching web application for students. The product helps students organize subjects, exams, study tasks, revision plans, quizzes, productivity logs, and burnout checks in one workspace.

The application combines a React frontend with a Django REST backend. AI features currently use deterministic mock responses so the product works without external API keys, with future support planned for OpenAI or Gemini.

## 2. Problem Statement

Students often struggle with:

- Creating realistic study timetables.
- Tracking study consistency and productivity.
- Knowing what to revise before exams.
- Practicing with topic-based quizzes.
- Managing stress and burnout during heavy study periods.
- Keeping all study planning tools in one place.

FocusFlow AI solves this by providing a centralized platform that turns study inputs into actionable schedules, quiz practice, analytics, and recovery recommendations.

## 3. Goals

- Help students create structured study plans quickly.
- Provide AI-assisted explanations, summaries, and flashcards.
- Generate topic-based quizzes with instant scoring.
- Track study time, focus score, task completion, and streaks.
- Identify possible burnout risk and suggest recovery actions.
- Provide a simple, responsive, authenticated student dashboard.

## 4. Non-Goals

- The first version will not replace teachers, tutors, or professional medical advice.
- The first version will not include real-time collaboration.
- The first version will not include payment, subscriptions, or marketplace features.
- External AI provider integration is optional for the MVP because mock AI responses are already supported.

## 5. Target Users

### Primary User

Students preparing for school, college, certification, or competitive exams.

### Secondary User

Self-learners who want a structured study routine, quiz practice, and productivity tracking.

## 6. User Personas

### Persona 1: Exam-Focused Student

- Needs a clear daily plan before upcoming exams.
- Wants to track weak topics and revision progress.
- Uses quizzes to test readiness.

### Persona 2: Busy Student

- Has limited study hours each day.
- Needs a realistic timetable.
- Wants reminders of open tasks and upcoming exams.

### Persona 3: Stressed Student

- Studies long hours and feels overloaded.
- Needs burnout risk feedback.
- Wants practical recovery recommendations.

## 7. Key User Stories

- As a student, I want to register and log in securely so my study data is private.
- As a student, I want to add subjects and weak topics so my plan is personalized.
- As a student, I want to add upcoming exams so I can prioritize revision.
- As a student, I want to create study tasks so I can manage my daily workload.
- As a student, I want AI to generate a timetable so I know what to study next.
- As a student, I want to ask an AI tutor for explanations, summaries, and flashcards.
- As a student, I want to generate quizzes by topic and difficulty so I can practice.
- As a student, I want instant quiz scoring so I can identify mistakes.
- As a student, I want to log study time and focus score so I can track productivity.
- As a student, I want burnout analysis so I can adjust my workload.

## 8. Functional Requirements

### 8.1 Authentication

- Users must be able to register using username, email, and password.
- Users must be able to log in using username and password.
- The system must issue JWT access and refresh tokens.
- Protected pages must require authentication.
- Users must be able to view their profile.
- Users must be able to log out.

### 8.2 Dashboard

- Show current study streak.
- Show weekly study time.
- Show task completion rate.
- Show number of open tasks.
- Show upcoming exams.
- Show recent productivity logs.

### 8.3 Study Planner

- Users can create subjects.
- Users can record weak topics for each subject.
- Users can add exams with dates and priority.
- Users can add study tasks.
- Users can generate an AI study timetable.
- Generated plans must include study blocks, revision steps, and focus tips.

### 8.4 AI Tutor

- Users can enter a topic and prompt.
- Users can choose a mode: explanation, summary, or flashcards.
- The system returns structured AI-style responses.
- Responses must be saved in AI history.

### 8.5 Quiz Center

- Users can generate quizzes by topic and difficulty.
- Quizzes must include multiple-choice questions.
- Users can select answers and submit.
- The system must calculate score and return explanations.
- Quiz history must be stored.

### 8.6 Productivity Analytics

- Users can log daily study minutes.
- Users can log focus score.
- Users can log completed tasks and mood.
- Analytics must show total study time, average focus, completed tasks, and daily trend.

### 8.7 Burnout Detector

- Users can input sleep hours, study hours, stress level, and break count.
- The system calculates burnout score and risk level.
- The system provides recommendations.
- Burnout reports must be stored.

### 8.8 Theme Settings

- Users can switch between dark and light theme.
- Theme preference must persist in local storage.

## 9. Non-Functional Requirements

### Performance

- Dashboard and common pages should load within 2 seconds on local development.
- API responses should be lightweight JSON payloads.

### Security

- Passwords must be hashed by Django authentication.
- JWT must be required for protected API endpoints.
- Frontend must not expose secret keys.

### Reliability

- The app must work without OpenAI or Gemini API keys using mock AI responses.
- Validation errors must be returned in a consistent API format.

### Usability

- UI must be responsive for desktop and mobile.
- Forms must show loading, success, and error states.
- Navigation must be available after login.

### Maintainability

- Frontend API calls should use a shared Axios client.
- Backend features should be separated by Django apps.
- Models and serializers should be organized by domain.

## 10. MVP Scope

The MVP includes:

- Register/login/profile/logout.
- Protected dashboard.
- Subject, exam, and task management.
- AI timetable generation using mock provider.
- AI tutor responses.
- Quiz generation and scoring.
- Productivity logging and analytics.
- Burnout analysis.
- Dark/light theme.
- Local setup documentation.

## 11. Future Enhancements

- Real OpenAI/Gemini provider integration.
- Calendar view for study tasks.
- Focus timer and Pomodoro logging.
- Email reminders or push notifications.
- Advanced charts and heatmaps.
- Export study plan as PDF.
- Mobile app version.
- Admin analytics dashboard.
- PostgreSQL production configuration helper.
- Unit and integration test coverage.

## 12. Success Metrics

- User can register, log in, and reach dashboard successfully.
- User can create at least one subject, exam, and task.
- User can generate a study plan without external AI keys.
- User can generate and submit a quiz.
- User can log productivity data and view analytics.
- User can complete burnout analysis and receive recommendations.
- Frontend build and lint pass successfully.
- Django migration and system checks pass successfully.

## 13. Technical Requirements

### Frontend

- React with Vite.
- React Router for routing.
- Axios for API requests.
- JWT token storage and refresh handling.
- Toast notifications.
- Responsive CSS/Tailwind styling.

### Backend

- Django.
- Django REST Framework.
- SimpleJWT authentication.
- SQLite for local development.
- PostgreSQL-compatible deployment path.
- CORS configuration for frontend origin.

### Deployment

- Frontend target: Vercel.
- Backend target: Render.
- Environment variable for frontend API URL: `VITE_API_URL`.
- Backend environment variables: `SECRET_KEY`, `DEBUG`, `FRONTEND_URL`.

## 14. API Summary

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `GET /api/auth/me/`
- `GET/POST /api/study/subjects/`
- `GET/POST /api/study/exams/`
- `GET/POST /api/study/tasks/`
- `GET /api/study/dashboard/`
- `POST /api/study/plan/generate/`
- `GET/POST /api/productivity/logs/`
- `GET /api/productivity/analytics/`
- `POST /api/ai/tutor/`
- `GET /api/ai/history/`
- `POST /api/quiz/generate/`
- `POST /api/quiz/<id>/submit/`
- `POST /api/burnout/analyze/`
- `GET /api/burnout/reports/`

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| External AI API unavailable | AI features fail | Keep deterministic mock provider |
| Students enter incomplete data | Poor study plan quality | Use defaults and validation |
| JWT token expires | User session interruption | Use refresh-token flow |
| UI becomes too complex | Lower usability | Keep pages task-focused |
| Production database setup is incomplete | Deployment issues | Add PostgreSQL setup guide before release |

## 16. Acceptance Criteria

- A new user can register and automatically access the dashboard.
- A returning user can log in and access protected pages.
- Unauthenticated users are redirected from protected pages to login.
- A user can create subjects, exams, and tasks.
- A user can generate a timetable from planner inputs.
- A user can ask the AI tutor for explanation, summary, and flashcards.
- A user can generate a quiz, answer questions, and receive a score.
- A user can add productivity logs and view analytics.
- A user can run burnout analysis and view recommendations.
- The app can run locally using the README setup instructions.
