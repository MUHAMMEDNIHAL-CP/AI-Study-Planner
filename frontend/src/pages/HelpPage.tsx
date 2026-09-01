import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentLayout from '../components/DocumentLayout'
import { IconBot, IconFlame, IconFocus, IconPuzzle } from '../components/icons'

const SUPPORT_EMAIL = 'support.flox@gmail.com'

type Faq = {
  id: string
  question: string
  answer: string
  tags: string[]
}

const FAQS: Faq[] = [
  {
    id: 'streak',
    question: 'How does my study streak work?',
    answer:
      'Your streak counts consecutive days where you complete at least 30 minutes of study. A day is marked when any qualifying activity is logged, such as adding a subject, exam, task or note, generating a quiz, using FLOX AI, or completing a focus session. If you have not studied yet today, your streak stays alive as long as you studied yesterday. Milestones unlock at 7, 30, 50, 100, 200 and 365 days.',
    tags: ['streak', 'fire', 'days', 'consecutive', 'milestone'],
  },
  {
    id: 'thirty-min',
    question: 'How is the 30-minute requirement calculated?',
    answer:
      'Short sessions add up throughout the day. Only completed focus sessions contribute their minutes, and completing study tasks and other qualifying activities also add minutes toward the daily 30-minute threshold. Incomplete or abandoned focus sessions do not count. You can check your total on your Progress page.',
    tags: ['streak', '30', 'minutes', 'qualifying', 'focus', 'threshold'],
  },
  {
    id: 'flox-requests',
    question: 'How many FLOX AI requests do I get?',
    answer:
      'You get 5 free FLOX AI requests every day, and they reset daily. Once you have used them, you can watch a short ad to bank up to 3 more requests at a time, up to a maximum of 5 bonus requests per day. Your remaining allowance is shown on the FLOX AI page.',
    tags: ['ai', 'flox', 'limit', 'requests', 'credits', 'usage', 'free', 'ad'],
  },
  {
    id: 'flox-limit',
    question: 'What happens when FLOX reaches its AI limit?',
    answer:
      'When FLOX reaches its daily platform capacity, AI features pause temporarily and you will see a message that FLOX is taking a break. Your study data stays safe and nothing is lost. You can simply try again later. You will not be charged for requests that do not complete.',
    tags: ['ai', 'flox', 'limit', 'quota', 'break', 'capacity', 'error'],
  },
  {
    id: 'password',
    question: 'How do I change my password?',
    answer:
      `You will find a password option under Settings > Security. Automated password changes are coming soon. Until then, email ${SUPPORT_EMAIL} from the address registered to your account and we will help you reset it securely.`,
    tags: ['password', 'security', 'account', 'reset', 'login'],
  },
  {
    id: 'delete-account',
    question: 'How do I delete my account?',
    answer:
      `You can request account deletion from Settings > Data & Privacy. Automated deletion is coming soon, so for now email ${SUPPORT_EMAIL} from your registered address with a request to delete your account, and we will remove your account and data and confirm once it is done.`,
    tags: ['delete', 'account', 'privacy', 'remove', 'data'],
  },
]

const QUICK_HELP = [
  { key: 'flox-ai', icon: IconBot, iconClass: 'tone-violet', title: 'FLOX AI', text: 'AI limits, credits & usage', anchor: '#faq-flox-requests' },
  { key: 'focus', icon: IconFocus, iconClass: 'tone-cyan', title: 'Focus Mode', text: 'Timer, sessions and streaks', to: '/focus' },
  { key: 'streaks', icon: IconFlame, iconClass: 'tone-amber', title: 'Streaks', text: 'How streaks work and reset', anchor: '#faq-streak' },
  { key: 'quizzes', icon: IconPuzzle, iconClass: 'tone-mint', title: 'Quizzes', text: 'Create & take AI quizzes', to: '/quiz' },
]

type QuickHelp = (typeof QUICK_HELP)[number]

function matchesQuery(q: string, haystacks: string[]): boolean {
  if (!q.trim()) return true
  const needle = q.trim().toLowerCase()
  return haystacks.some((text) => text.toLowerCase().includes(needle))
}

function filterQuick(items: QuickHelp[], q: string): QuickHelp[] {
  return items.filter((item) => matchesQuery(q, [item.title, item.text]))
}

export default function HelpPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set(FAQS.map((f) => f.id)))
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const visibleFaqs = useMemo(
    () => FAQS.filter((f) => matchesQuery(query, [f.question, f.answer, ...f.tags])),
    [query],
  )

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submitContact() {
    if (!message.trim()) return
    const subject = encodeURIComponent('Help & Support request')
    const body = encodeURIComponent(
      (email ? `From: ${email}\n\n` : '') + message.trim() + '\n\n— Sent from FocusFlow AI Help & Support',
    )
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
    setSent(true)
  }

  function openGuide(item: QuickHelp) {
    if ('to' in item && item.to) {
      navigate(item.to)
    } else if (item.anchor) {
      const el = document.getElementById(item.anchor.replace('#', ''))
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <DocumentLayout
      eyebrow="Support"
      title="Help & Support"
      subtitle="We're here to help you study better. Find answers, report a problem, or contact us."
    >
      <div className="hl-help">
        {/* Search */}
        <label className="hl-search">
          <span className="hl-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </span>
          <input
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for help..."
            type="search"
            value={query}
          />
        </label>

        {/* Quick help */}
        {filterQuick(QUICK_HELP, query).length > 0 && (
          <section className="hl-section">
            <h2>Quick Help</h2>
            <div className="hl-quick-grid">
              {filterQuick(QUICK_HELP, query).map((item) => {
                const Icon = item.icon
                return (
                  <button className="hl-quick-card" key={item.key} onClick={() => openGuide(item)} type="button">
                    <span className={`hl-quick-icon ${item.iconClass}`}><Icon size={22} /></span>
                    <strong>{item.title}</strong>
                    <span className="hl-quick-text">{item.text}</span>
                    <span className="hl-quick-cta">View guide {'\u2192'}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* FAQ */}
        {visibleFaqs.length > 0 && (
          <section className="hl-section">
            <h2>FAQ</h2>
            <div className="hl-faq">
              {visibleFaqs.map((faq) => {
                const expanded = open.has(faq.id)
                return (
                  <div className={`hl-faq-item${expanded ? ' open' : ''}`} id={`faq-${faq.id}`} key={faq.id}>
                    <button className="hl-faq-q" onClick={() => toggle(faq.id)} type="button" aria-expanded={expanded}>
                      <span>{faq.question}</span>
                      <span className="hl-faq-toggle" aria-hidden="true">{expanded ? '\u2212' : '+'}</span>
                    </button>
                    {expanded && <p className="hl-faq-a">{faq.answer}</p>}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {query.trim() && visibleFaqs.length === 0 && filterQuick(QUICK_HELP, query).length === 0 && (
          <p className="hl-no-results">No results found for &ldquo;{query}&rdquo;. Try a different term, or contact us below.</p>
        )}

        {/* Contact */}
        <section className="hl-section">
          <h2>Still need help?</h2>
          <p className="hl-contact-sub">Tell us what&apos;s happening and we&apos;ll help you. The message opens in your email app.</p>
          <div className="hl-contact">
            <label>
              <span>Your email</span>
              <input
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>Message</span>
              <textarea
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your problem..."
                rows={5}
                value={message}
              />
            </label>
            <div className="hl-contact-actions">
              <button className="hl-send" disabled={!message.trim()} onClick={submitContact} type="button">
                Send message {'\u2192'}
              </button>
              <a className="hl-mail-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </div>
            {sent && <p className="hl-sent">Opening your email app &mdash; just press send to reach us.</p>}
          </div>
        </section>
      </div>
    </DocumentLayout>
  )
}