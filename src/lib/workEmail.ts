// Mirrors public.blocked_email_domains for instant UX feedback.
// The database is the source of truth (trigger + RPC enforce it); this
// list only avoids a round-trip for the obvious cases.
const FREE_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'aol.com',
  'proton.me', 'protonmail.com', 'tutanota.com',
  'rediffmail.com', 'zoho.com', 'mail.com', 'gmx.com', 'yandex.com',
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
])

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function isWorkEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return false
  return !FREE_DOMAINS.has(e.split('@')[1])
}

export function workEmailError(email: string): string | null {
  const e = email.trim()
  if (!e) return 'Enter your work email.'
  if (!EMAIL_RE.test(e)) return 'Enter a valid email address.'
  if (!isWorkEmail(e)) return 'Use your company email. Gmail, Yahoo and other free providers are not allowed.'
  return null
}
