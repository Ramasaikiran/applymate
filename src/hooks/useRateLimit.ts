/**
 * useRateLimit — abuse-prevention lockout, layered on top of (not duplicating)
 * Supabase's own server-side email throttle.
 *
 * Supabase already enforces its own short-interval cooldown between emails
 * and returns an accurate, live "you can only request this after N seconds"
 * error when hit — that message is authoritative and shown as-is by the
 * caller. This hook does NOT try to guess or replicate that timing (an
 * earlier version did, with a client-only 0s/30s/60s schedule, which just
 * showed a second, unsynchronized countdown next to Supabase's real one).
 *
 * What this hook adds instead: after 3 attempts, a 2-hour lockout — a
 * longer-horizon abuse guard Supabase's per-request throttle doesn't cover.
 */

import { useState, useEffect, useCallback } from 'react'

interface RateLimitState {
  attempts: number        // total attempts made
  lastAttemptAt: number  // epoch ms of last attempt
  cooledAt: number | null // epoch ms when 3rd attempt was made (starts 2hr block)
}

const COOLDOWN_MS = 2 * 60 * 60 * 1000  // 2 hours after 3rd attempt

function load(key: string): RateLimitState {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { attempts: 0, lastAttemptAt: 0, cooledAt: null }
}

function save(key: string, state: RateLimitState) {
  try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* storage blocked: lockout just won't persist */ }
}

export function useRateLimit(storageKey: string) {
  const [state, setState] = useState<RateLimitState>(() => load(storageKey))
  const [now, setNow] = useState(Date.now())

  // Reload state whenever the key changes (e.g. user switches email)
  useEffect(() => {
    setState(load(storageKey))
  }, [storageKey])

  // Tick every second to update the cooldown countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // During 2-hr cooldown?
  const inCooldown = state.cooledAt !== null && (now - state.cooledAt) < COOLDOWN_MS
  const cooldownSecondsLeft = state.cooledAt
    ? Math.max(0, Math.ceil((COOLDOWN_MS - (now - state.cooledAt)) / 1000))
    : 0

  const blocked = inCooldown

  function humanCooldown(seconds: number) {
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600)
      const m = Math.ceil((seconds % 3600) / 60)
      return m > 0 ? `${h}h ${m}m` : `${h}h`
    }
    if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`
    return `${seconds}s`
  }

  const blockMessage = inCooldown
    ? `Too many attempts. Try again in ${humanCooldown(cooldownSecondsLeft)}.`
    : null

  const recordAttempt = useCallback(() => {
    // If a previous cooldown has fully expired, this is a fresh start —
    // otherwise `attempts` stays stuck at 3+ forever and every future
    // attempt re-triggers another full 2-hour block the instant someone
    // tries again, with no way out.
    const cooldownExpired = state.cooledAt !== null && (Date.now() - state.cooledAt) >= COOLDOWN_MS
    const baseAttempts = cooldownExpired ? 0 : state.attempts
    const next: RateLimitState = {
      attempts: baseAttempts + 1,
      lastAttemptAt: Date.now(),
      cooledAt: baseAttempts + 1 >= 3 ? Date.now() : null,
    }
    setState(next)
    save(storageKey, next)
  }, [state, storageKey])

  const reset = useCallback(() => {
    const next: RateLimitState = { attempts: 0, lastAttemptAt: 0, cooledAt: null }
    setState(next)
    try { localStorage.removeItem(storageKey) } catch { /* storage blocked */ }
  }, [storageKey])

  return { blocked, blockMessage, recordAttempt, reset, attempts: state.attempts }
}
