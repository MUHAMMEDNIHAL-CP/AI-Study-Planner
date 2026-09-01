import { useEffect, useRef, useState } from 'react'
import { getErrorMessage } from './api'

export function useAdminData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetcherRef.current()
      .then((d) => {
        if (active) {
          setData(d)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(getErrorMessage(err))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  return { data, error, loading }
}

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat().format(n)
}

export function formatCompact(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n)
}

export function formatHours(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return '—'
  return `${formatCompact(Math.round(minutes / 60))} hrs`
}

export function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}