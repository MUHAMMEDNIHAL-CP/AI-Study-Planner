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
import RequireAdmin from './routes/RequireAdmin'
import AdminLayout from './components/admin/AdminLayout'
import AdminOverview from './pages/admin/AdminOverview'
import AdminUsers from './pages/admin/AdminUsers'
import AdminUserDetail from './pages/admin/AdminUserDetail'
import AdminEngagement from './pages/admin/AdminEngagement'
import AdminStreaks from './pages/admin/AdminStreaks'
import AdminStudyActivity from './pages/admin/AdminStudyActivity'
import AdminSubjects from './pages/admin/AdminSubjects'
import AdminTasks from './pages/admin/AdminTasks'
import AdminQuizzes from './pages/admin/AdminQuizzes'
import AdminExams from './pages/admin/AdminExams'
import AdminNotes from './pages/admin/AdminNotes'
import AdminAI from './pages/admin/AdminAI'
import AdminDevices from './pages/admin/AdminDevices'
import AdminHealth from './pages/admin/AdminHealth'
import AdminAuditLogs from './pages/admin/AdminAuditLogs'
import AdminReports from './pages/admin/AdminReports'
import AdminSettings from './pages/admin/AdminSettings'
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

      {/* Super Admin — server-side enforced via is_superuser on every endpoint
          AND guarded on the client with RequireAdmin. */}
      <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:userId" element={<AdminUserDetail />} />
        <Route path="engagement" element={<AdminEngagement />} />
        <Route path="streaks" element={<AdminStreaks />} />
        <Route path="study" element={<AdminStudyActivity />} />
        <Route path="subjects" element={<AdminSubjects />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="quizzes" element={<AdminQuizzes />} />
        <Route path="exams" element={<AdminExams />} />
        <Route path="notes" element={<AdminNotes />} />
        <Route path="ai" element={<AdminAI />} />
        <Route path="devices" element={<AdminDevices />} />
        <Route path="health" element={<AdminHealth />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  )
}
