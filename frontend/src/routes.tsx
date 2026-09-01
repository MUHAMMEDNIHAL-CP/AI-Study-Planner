import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import MySubjectsPage from './pages/MySubjectsPage'
import PlannerPage from './pages/PlannerPage'
import TasksPage from './pages/TasksPage'
import ExamsPage from './pages/ExamsPage'
import FocusModePage from './pages/FocusModePage'
import ProgressPage from './pages/ProgressPage'
import AiTutorPage from './pages/AiTutorPage'
import NotesPage from './pages/NotesPage'
import CalendarPage from './pages/CalendarPage'
import QuizCenterPage from './pages/QuizCenterPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import RequireAuth from './routes/RequireAuth'
import { isAuthenticated } from './lib/auth'

/** Public pages redirect authenticated users straight to the dashboard. */
function PublicOnly({ children }: { children: ReactElement }) {
  if (isAuthenticated()) return <Navigate to="/dashboard" replace />
  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnly><LandingPage /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/welcome" element={<OnboardingPage />} />
        <Route path="/subjects" element={<MySubjectsPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/exams" element={<ExamsPage />} />
        <Route path="/focus" element={<FocusModePage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/ai-tutor" element={<AiTutorPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/quiz" element={<QuizCenterPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
