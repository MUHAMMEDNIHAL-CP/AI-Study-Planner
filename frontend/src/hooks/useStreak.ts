import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { onStudyActivity } from '../lib/studyActivity'

export type StreakMilestone = { target: number; progress: number; remaining: number }

export type StreakStats = {
  current_streak: number
  longest_streak: number
  total_study_days: number
  last_study_date: string | null
  studied_today: boolean
  today_minutes: number
  week_minutes: number
  next_milestone: StreakMilestone | null
  heatmap?: { date: string; count: number }[]
  streak: number
}

const INITIAL: StreakStats = {
  current_streak: 0,
  longest_streak: 0,
  total_study_days: 0,
  last_study_date: null,
  studied_today: false,
  today_minutes: 0,
  week_minutes: 0,
  next_milestone: null,
  streak: 0,
}

/**
 * Single source of truth for the study streak. Every page (Dashboard, Focus,
 * Progress, Profile, Navigation) must read the streak from THIS hook so the
 * whole app always shows the same value.
 *
 * The backend computes the streak from the daily activity log
 * (backend/study/streak.py -> GET /study/dashboard/). This hook:
 *  - fetches it on mount,
 *  - refetches whenever any study activity fires `flox:streak-update`,
 *  - never resets the value to 0 while loading (loading shows a skeleton),
 *  - keeps the last known valid value when a refresh fails.
 */
export function useStreak() {
  const [data, setData] = useState<StreakStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const mounted = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get<Partial<StreakStats>>('/study/dashboard/')
      if (!mounted.current) return
      setData({ ...INITIAL, ...res.data })
      setError(false)
    } catch {
      if (!mounted.current) return
      // Keep the last known valid value instead of flashing 0.
      setError(true)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void load()
    const off = onStudyActivity(() => void load(true))
    return () => {
      mounted.current = false
      off()
    }
  }, [load])

  const refresh = useCallback(() => load(false), [load])

  return { streak: data, loading, error, refresh }
}