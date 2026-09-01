import { api } from './api'

export type AdminOverview = {
  total_users: number
  active_today: number
  studying_today: number
  retention_rate: number
  new_today: number
  new_this_week: number
  new_this_month: number
  active_week: number
  active_month: number
  total_study_minutes_today: number
  focus_sessions_today: number
  completed_focus_today: number
  tasks_created_today: number
  tasks_completed_today: number
  overdue_tasks: number
  quizzes_today: number
  ai_today: number
  notes_today: number
  upcoming_exams: number
  most_used_features: Array<{ name: string; count: number; pct: number }>
  platform_activity: {
    sessions: number
    quizzes: number
    tasks: number
    ai_messages: number
    notes: number
  }
  user_growth: Array<{ date: string; count: number }>
  funnel: {
    registered: number
    active_this_month: number
    studied_this_week: number
    studied_today: number
    retention_rate: number
  }
}

export type AdminUser = {
  id: number
  username: string
  email: string
  full_name: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
  subject_count: number
  task_count: number
  quiz_count: number
  note_count: number
  focus_session_count: number
  last_active: string | null
}

export type AdminUsersResponse = {
  total: number
  page: number
  page_size: number
  results: AdminUser[]
}

export type EngagementData = {
  dau: number
  wau: number
  mau: number
  total_users: number
  dau_trend: Array<{ date: string; dau: number }>
  new_today: number
  returning_today: number
  activation_rate: number
  churn_rate: number
  churned_users: number
}

export type StreaksData = {
  average_streak: number
  active_streak_users: number
  streak_7plus: number
  streak_30plus: number
  longest_streak: number
  distribution: Array<{ range: string; count: number }>
  completed_30min_today: number
  completed_30min_pct: number
  total_users_with_logs: number
}

export type StudyActivityData = {
  total_study_minutes_today: number
  total_study_minutes_week: number
  focus_sessions_today: number
  completed_sessions_today: number
  average_session_minutes: number
  completed_30min_goal: number
  goal_completion_pct: number
  popular_subjects: Array<{ name: string; user_count: number; session_count: number }>
  daily_study: Array<{ date: string; minutes: number }>
}

export type QuizData = {
  created_today: number
  created_this_week: number
  total_quizzes: number
  average_score: number
  ai_generated_pct: number
  ai_generated_count: number
  difficulty_stats: Array<{
    difficulty: string
    count: number
    avg_score: number | null
    total_questions: number | null
  }>
  top_topics: Array<{ topic: string; count: number }>
  quiz_daily: Array<{ date: string; count: number }>
}

export type ExamData = {
  upcoming: number
  added_this_week: number
  total_exams: number
  upcoming_by_subject: Array<{ subject: string | null; count: number }>
  priority_breakdown: Array<{ priority: string; count: number }>
  average_exams_per_user: number
}

export type NotesData = {
  created_today: number
  created_this_week: number
  active_note_users: number
  total_notes: number
  average_per_user: number
  daily_trend: Array<{ date: string; count: number }>
}

export type TasksData = {
  created_today: number
  completed_today: number
  total_tasks: number
  overdue: number
  completion_rate: number
  by_status: Array<{ status: string; count: number }>
  by_priority: Array<{ priority: string; count: number }>
  daily_trend: Array<{ date: string; created: number; completed: number }>
}

export type AIProjectStatus = {
  requests_used: number
  requests_limit: number
  tokens_used: number
  tokens_limit: number
  requests_pct: number
  tokens_pct: number
  combined_pct: number
  warning: 'ok' | 'approaching' | 'critical' | 'exhausted'
  date: string
}

export type AIData = {
  conversations_today: number
  active_ai_users: number
  total_conversations: number
  average_messages_per_user: number
  feature_breakdown: Array<{ feature: string; count: number; pct: number }>
  provider_breakdown: Array<{ provider: string; count: number }>
  daily_usage: Array<{ date: string; count: number }>
  project: AIProjectStatus
}

export type HealthData = {
  overall: 'healthy' | 'warning' | 'critical'
  services: Record<
    string,
    { status: string; response_ms?: number; provider?: string; error?: string }
  >
  counts: Record<string, number>
}

export type AuditLogItem = {
  id: number
  admin_username: string
  target_username: string
  action: string
  detail: Record<string, unknown>
  created_at: string
}

export type AuditLogsResponse = {
  total: number
  page: number
  page_size: number
  results: AuditLogItem[]
}

export type ReportData = {
  type: string
  days: number
  data: Record<string, number>
}

export const adminApi = {
  overview: () => api.get<AdminOverview>('/admin/overview/').then((r) => r.data),

  users: (params: Record<string, string | number>) =>
    api.get<AdminUsersResponse>('/admin/users/', { params }).then((r) => r.data),

  userDetail: (id: number | string) => api.get<Record<string, unknown>>(`/admin/users/${id}/`).then((r) => r.data),

  suspend: (userId: number, action: 'suspend' | 'unsuspend') =>
    api.post<{ ok: boolean; is_active: boolean }>('/admin/users/', { user_id: userId, action }).then((r) => r.data),

  engagement: () => api.get<EngagementData>('/admin/engagement/').then((r) => r.data),
  streaks: () => api.get<StreaksData>('/admin/streaks/').then((r) => r.data),
  studyActivity: () => api.get<StudyActivityData>('/admin/study-activity/').then((r) => r.data),
  quizzes: () => api.get<QuizData>('/admin/quizzes/').then((r) => r.data),
  exams: () => api.get<ExamData>('/admin/exams/').then((r) => r.data),
  notes: () => api.get<NotesData>('/admin/notes/').then((r) => r.data),
  tasks: () => api.get<TasksData>('/admin/tasks/').then((r) => r.data),
  ai: () => api.get<AIData>('/admin/ai/').then((r) => r.data),
  devices: () => api.get<Record<string, unknown>>('/admin/devices/').then((r) => r.data),
  health: () => api.get<HealthData>('/admin/health/').then((r) => r.data),

  auditLogs: (params: Record<string, string | number>) =>
    api.get<AuditLogsResponse>('/admin/audit-logs/', { params }).then((r) => r.data),

  logAction: (action: string, targetUserId?: number, detail?: Record<string, unknown>) =>
    api.post<{ ok: boolean }>('/admin/audit-logs/', { action, target_user_id: targetUserId, detail }).then((r) => r.data),

  report: (type: string, days: number) =>
    api.get<ReportData>('/admin/reports/', { params: { type, days } }).then((r) => r.data),
}