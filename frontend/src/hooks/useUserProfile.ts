import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { isAuthenticated } from '../lib/auth'

export type UserProfile = {
  id?: number
  username: string
  email: string
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) return
    let active = true
    api.get<UserProfile>('/auth/me/')
      .then(({ data }) => {
        if (active) setProfile(data)
      })
      .catch(() => {
        if (active) setProfile(null)
      })
    return () => {
      active = false
    }
  }, [])

  return profile
}
