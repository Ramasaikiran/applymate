import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const ORIGIN = 'https://applymate.in'

// Per-route SEO. Each public page gets its own title, description and
// canonical URL; every other route (app, admin, auth) is set to noindex.
const PUBLIC: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'ApplyMate: We Apply to Jobs for You, Every Day',
    description: 'Get matched to 8–10 relevant jobs a day and let ApplyMate apply for you on official career portals. Free to start. For job seekers worldwide.',
  },
  '/sign-up': {
    title: 'Create your free account | ApplyMate',
    description: 'Sign up free and get matched to relevant jobs. ApplyMate applies on official career portals for job seekers worldwide.',
  },
  '/sign-in': {
    title: 'Sign in | ApplyMate',
    description: 'Sign in to your ApplyMate account to track applications and matched jobs.',
  },
  '/about': {
    title: 'About ApplyMate',
    description: 'ApplyMate helps job seekers around the world apply to relevant jobs faster, with real applications on official career portals.',
  },
  '/contact': {
    title: 'Contact ApplyMate',
    description: 'Questions about ApplyMate? Get in touch with our team.',
  },
  '/terms': { title: 'Terms and Conditions | ApplyMate', description: 'The terms that apply when you use ApplyMate.' },
  '/privacy': { title: 'Privacy Policy | ApplyMate', description: 'How ApplyMate collects, uses and protects your data.' },
  '/refund-policy': { title: 'Refund Policy | ApplyMate', description: 'How refunds work for ApplyMate paid plans.' },
  '/status': { title: 'System Status | ApplyMate', description: 'Live status of ApplyMate services.' },
}

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) { el = create(); document.head.appendChild(el) }
  el.setAttribute(attr, value)
}

export default function RouteMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
    const page = PUBLIC[path]
    const mk = (tag: string, k: string, v: string) => () => {
      const e = document.createElement(tag); e.setAttribute(k, v); return e
    }

    if (page) {
      document.title = page.title
      const url = ORIGIN + (path === '/' ? '/' : path)
      setMeta('meta[name="description"]', mk('meta', 'name', 'description'), 'content', page.description)
      setMeta('link[rel="canonical"]', mk('link', 'rel', 'canonical'), 'href', url)
      setMeta('link[rel="alternate"][hreflang="en"]', mk('link', 'rel', 'alternate'), 'href', url)
      setMeta('meta[property="og:title"]', mk('meta', 'property', 'og:title'), 'content', page.title)
      setMeta('meta[property="og:description"]', mk('meta', 'property', 'og:description'), 'content', page.description)
      setMeta('meta[property="og:url"]', mk('meta', 'property', 'og:url'), 'content', url)
      setMeta('meta[name="robots"]', mk('meta', 'name', 'robots'), 'content', 'index, follow, max-image-preview:large, max-snippet:-1')
    } else {
      setMeta('meta[name="robots"]', mk('meta', 'name', 'robots'), 'content', 'noindex, nofollow')
    }
  }, [pathname])

  return null
}
