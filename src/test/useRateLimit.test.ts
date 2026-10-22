import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRateLimit } from '../hooks/useRateLimit'

const KEY = 'test_rl_key'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRateLimit', () => {
  it('is not blocked on first render with no prior attempts', () => {
    const { result } = renderHook(() => useRateLimit(KEY))
    expect(result.current.blocked).toBe(false)
    expect(result.current.attempts).toBe(0)
  })

  it('does not block the 1st or 2nd attempt — Supabase\'s own throttle covers short-interval spacing', () => {
    const { result } = renderHook(() => useRateLimit(KEY))

    act(() => result.current.recordAttempt()) // 1
    expect(result.current.blocked).toBe(false)

    act(() => result.current.recordAttempt()) // 2
    expect(result.current.blocked).toBe(false)
  })

  it('triggers a 2-hour cooldown after the 3rd attempt', () => {
    const { result } = renderHook(() => useRateLimit(KEY))

    act(() => result.current.recordAttempt()) // 1
    act(() => result.current.recordAttempt()) // 2
    act(() => result.current.recordAttempt()) // 3 — triggers cooldown

    expect(result.current.blocked).toBe(true)
    expect(result.current.blockMessage).toMatch(/too many attempts/i)

    // Cooldown should still be active just before 2 hours pass
    act(() => vi.advanceTimersByTime(2 * 60 * 60 * 1000 - 1000))
    expect(result.current.blocked).toBe(true)

    // And clear once the full 2 hours have passed
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.blocked).toBe(false)
  })

  it('reset() clears attempts and unblocks', () => {
    const { result } = renderHook(() => useRateLimit(KEY))
    act(() => result.current.recordAttempt())
    act(() => result.current.recordAttempt())
    act(() => result.current.recordAttempt())
    expect(result.current.blocked).toBe(true)

    act(() => result.current.reset())
    expect(result.current.blocked).toBe(false)
    expect(result.current.attempts).toBe(0)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('reloads state when the storage key changes (e.g. different email)', () => {
    const { result, rerender } = renderHook(({ key }) => useRateLimit(key), {
      initialProps: { key: KEY },
    })
    act(() => result.current.recordAttempt())
    act(() => result.current.recordAttempt())
    act(() => result.current.recordAttempt())
    expect(result.current.blocked).toBe(true)

    rerender({ key: 'a_different_key' })
    expect(result.current.blocked).toBe(false)
  })

  it('does not immediately re-lock for another 2 hours on the first attempt after a cooldown expires', () => {
    const { result } = renderHook(() => useRateLimit(KEY))

    act(() => result.current.recordAttempt()) // 1
    act(() => result.current.recordAttempt()) // 2
    act(() => result.current.recordAttempt()) // 3 — triggers cooldown
    expect(result.current.blocked).toBe(true)

    // Cooldown fully expires
    act(() => vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 1000))
    expect(result.current.blocked).toBe(false)

    // The next attempt should be treated as a fresh attempt 1, not
    // instantly re-trigger another 2-hour block.
    act(() => result.current.recordAttempt())
    expect(result.current.attempts).toBe(1)
    expect(result.current.blockMessage).toBeNull()
  })
})

describe('useRateLimit with blocked storage', () => {
  it('recordAttempt does not throw when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useRateLimit('oc_test_blocked_storage'))
    expect(() => act(() => result.current.recordAttempt())).not.toThrow()
    spy.mockRestore()
  })
})
