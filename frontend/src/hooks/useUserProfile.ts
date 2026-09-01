import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { isAuthenticated } from '../lib/auth'

let profileListeners: Array<() => void> = []

/** Notify all subscribers to refetch the current user's profile (e.g. after saving the full name). */
export function notifyProfileUpdated() {
  profileListeners.forEach((fn) => fn())
}

export type UserProfile = {
  id?: number
  username?: string
  full_name?: string
  email: string
  is_superuser?: boolean
  is_staff?: boolean
}

export function displayName(profile: UserProfile | null | undefined) {
  return profile?.full_name?.trim() || profile?.username || 'Scholar'
}

export function firstName(profile: UserProfile | null | undefined) {
  const n = displayName(profile)
  return n.trim().split(/\s+/)[0] || n
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

    const load = () => {
      if (!isAuthenticated()) return
      api.get<UserProfile>('/auth/me/')
        .then(({ data }) => {
          if (active) setProfile(data)
        })
        .catch(() => {
          if (active) setProfile(null)
        })
    }

    load()
    profileListeners.push(load)
    return () => {
      active = false
      profileListeners = profileListeners.filter((fn) => fn !== load)
    }
  }, [])

  return profile
}
