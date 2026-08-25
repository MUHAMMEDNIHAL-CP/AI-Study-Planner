import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'

/* ── Types ─────────────────────────────────────────────────── */

type Note = {
  id: number
  title: string
  content: string
  subject: number | null
  subject_name: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

type Subject = { id: number; name: string; color: string }

type ListFilter = 'all' | 'favorites' | 'recent' | 'shared'

type AiPanel = {
  open: boolean
  mode: 'menu' | 'result' | 'chat'
  tool?: string
  text?: string
  loading?: boolean
}

const AI_CLOSED: AiPanel = { open: false, mode: 'menu', text: '', loading: false }

type Flashcard = { front: string; back: string }

const TAG_PRESETS = ['#important', '#exam', '#revision', '#formula', '#definition', '#question', '#weak-topic']

const TEMPLATES: { key: string; label: string; icon: string; content: string }[] = [
  { key: 'blank', label: 'Blank Note', icon: '\uD83D\uDCDD', content: '' },
  { key: 'lecture', label: 'Lecture Notes', icon: '\uD83D\uDCD6', content: '<h2>Topic</h2><p></p><h2>Key Points</h2><ul><li></li></ul><h2>Summary</h2><p></p>' },
  { key: 'exam', label: 'Exam Notes', icon: '\uD83C\uDF93', content: '<h2>Topic</h2><p></p><h2>Definition</h2><p></p><h2>Important Points</h2><ul><li></li></ul><h2>Types</h2><ul><li></li></ul><h2>Advantages</h2><ul><li></li></ul><h2>Disadvantages</h2><ul><li></li></ul><h2>Examples</h2><p></p><h2>Important Questions</h2><ol><li></li></ol><h2>Exam Tip</h2><p></p>' },
  { key: 'revision', label: 'Revision Notes', icon: '\uD83D\uDCCB', content: '<h2>Chapter</h2><p></p><h2>Key Formulas</h2><ul><li></li></ul><h2>Quick Summary</h2><p></p><h2>Must Remember</h2><ul><li></li></ul>' },
  { key: 'summary', label: 'Topic Summary', icon: '\uD83E\uDDE0', content: '<h2>Definition</h2><p></p><h2>Important Points</h2><ul><li></li></ul><h2>Examples</h2><p></p>' },
  { key: 'questions', label: 'Important Questions', icon: '\u2753', content: '<h2>Questions</h2><ol><li></li></ol><h2>Answers</h2><ol><li></li></ol>' },
]

const AI_MENU: { key: string; label: string; icon: string }[] = [
  { key: 'summarize', label: 'Summarize', icon: '\uD83E\uDDE0' },
  { key: 'explain', label: 'Explain Simply', icon: '\uD83D\uDCA1' },
  { key: 'keypoints', label: 'Find Important Points', icon: '\u2B50' },
  { key: 'quiz', label: 'Generate Quiz', icon: '\uD83D\uDCDD' },
  { key: 'flashcards', label: 'Create Flashcards', icon: '\uD83C\uDCCF' },
  { key: 'weaktopics', label: 'Find Weak Topics', icon: '\uD83D\uDD0D' },
  { key: 'improve', label: 'Improve My Notes', icon: '\u2728' },
  { key: 'ask', label: 'Ask AI About This Note', icon: '\uD83D\uDCAC' },
]

const TOOL_PROMPTS: Record<string, string> = {
  summarize: 'Summarize this note concisely with a short paragraph followed by bullet key points.',
  explain: 'Explain this note in simple English that a beginner can understand.',
  keypoints: 'Extract the most important points from this note as a numbered list.',
  weaktopics: 'Analyze this note and identify which topics look weakest or most confusing for the student. Give revision advice.',
  improve: 'Improve the structure and clarity of these notes. Return the improved version using HTML headings and lists.',
}

/* ── Helpers ───────────────────────────────────────────────── */

function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return '1h ago'
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return days + 'd ago'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h1|h2|h3|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function noteText(note: Note) {
  return htmlToText(note.content)
}

function snippet(text: string, query: string, radius = 64) {
  if (!query) return text.slice(0, 140)
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, 140)
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + query.length + radius)
  return (start > 0 ? '\u2026' : '') + text.slice(start, end).trim() + (end < text.length ? '\u2026' : '')
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const parts: ReactNode[] = []
  let pos = 0
  let idx = lower.indexOf(qLower)
  let k = 0
  while (idx !== -1 && k < 6) {
    if (idx > pos) parts.push(text.slice(pos, idx))
    parts.push(<mark key={k}>{text.slice(idx, idx + query.length)}</mark>)
    pos = idx + query.length
    idx = lower.indexOf(qLower, pos)
    k++
  }
  parts.push(text.slice(pos))
  return <>{parts}</>
}

/** Plain-text legacy notes get <br>; rich notes pass through. */
function toEditorHtml(raw: string) {
  if (!raw) return ''
  if (raw.includes('<')) return raw
  return raw.split('\n').map((l) => l || '<br>').join('<br>')
}

function extractFlashcards(reply: string): Flashcard[] {
  const match = reply.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      const arr = JSON.parse(match[0]) as Array<{ front?: string; back?: string; q?: string; a?: string }>
      const cards = arr
        .map((c) => ({ front: (c.front ?? c.q ?? '').trim(), back: (c.back ?? c.a ?? '').trim() }))
        .filter((c) => c.front)
      if (cards.length) return cards
    } catch {
      /* fall through */
    }
  }
  const blocks = reply.split(/\n\s*\n/).filter(Boolean)
  const cards: Flashcard[] = []
  for (const b of blocks) {
    const lines = b.split('\n').map((x) => x.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean)
    if (lines.length >= 2) cards.push({ front: lines[0], back: lines.slice(1).join(' ') })
  }
  return cards
}

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = () => setMatches(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return matches
}

/* ── Page ──────────────────────────────────────────────────── */

export default function NotesPage() {
  const navigate = useNavigate()

  const [notes, setNotes] = useState<Note[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ListFilter>('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [view, setView] = useState<'list' | 'editor'>('list')

  const [editId, setEditId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedTick, setSavedTick] = useState(false)

  const [showTemplates, setShowTemplates] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [aiPanel, setAiPanelState] = useState<AiPanel>(AI_CLOSED)
  const [askInput, setAskInput] = useState('')

  function setAiPanel(p: AiPanel) { setAiPanelState(p) }
  function closeAi() { setAiPanelState(AI_CLOSED) }

  const [quizOpen, setQuizOpen] = useState(false)
  const [quizSource, setQuizSource] = useState<'note' | 'subject' | 'all'>('note')
  const [quizCount, setQuizCount] = useState('10')
  const [quizDifficulty, setQuizDifficulty] = useState('medium')
  const [quizBusy, setQuizBusy] = useState(false)

  const [deck, setDeck] = useState<Flashcard[] | null>(null)
  const [deckIdx, setDeckIdx] = useState(0)
  const [deckFlipped, setDeckFlipped] = useState(false)

  const wide = useMedia('(min-width: 1201px)')
  const editorRef = useRef<HTMLDivElement | null>(null)
  const draftHtml = useRef('')
  const pendingHtml = useRef('')
  const [nowTs] = useState(() => Date.now())

  /* ── Load ── */

  async function loadData() {
    const [notesRes, subjectsRes] = await Promise.all([
      api.get<Note[]>('/notes/'),
      api.get<Subject[]>('/study/subjects/'),
    ])
    setNotes(notesRes.data)
    setSubjects(subjectsRes.data)
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        await loadData()
      } catch (err) {
        if (active) toast.error(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  /* ── Derived ── */

  const subjectCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const n of notes) if (n.subject) counts[n.subject] = (counts[n.subject] ?? 0) + 1
    return counts
  }, [notes])

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of notes) {
      const lower = n.content.toLowerCase()
      for (const t of TAG_PRESETS) {
        if (lower.includes(t)) counts[t] = (counts[t] ?? 0) + 1
      }
    }
    return counts
  }, [notes])

  const filteredNotes = useMemo(() => {
    let list = [...notes]
    if (filter === 'favorites') list = list.filter((n) => n.pinned)
    else if (filter === 'recent') {
      const cutoff = nowTs - 7 * 86400000
      list = list.filter((n) => new Date(n.updated_at).getTime() >= cutoff)
    }
    if (subjectFilter !== 'all') {
      const sid = Number(subjectFilter)
      list = list.filter((n) => n.subject === sid)
    }
    if (tagFilter) list = list.filter((n) => n.content.toLowerCase().includes(tagFilter))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          noteText(n).toLowerCase().includes(q) ||
          (n.subject_name ?? '').toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [notes, filter, subjectFilter, tagFilter, search, nowTs])

  const previewNote = useMemo(
    () => notes.find((n) => n.id === previewId) ?? null,
    [notes, previewId],
  )

  function noteTags(n: Note) {
    const lower = n.content.toLowerCase()
    return TAG_PRESETS.filter((t) => lower.includes(t))
  }

  /* ── Editor lifecycle ── */

  function openEditor(noteId: number | null) {
    setShowSidebar(false)
    closeAi()
    if (noteId == null) {
      setShowTemplates(true)
      return
    }
    const n = notes.find((x) => x.id === noteId)
    if (!n) return
    setEditId(noteId)
    setTitle(n.title)
    setSubjectId(n.subject ? String(n.subject) : '')
    setPinned(n.pinned)
    setTags(noteTags(n))
    pendingHtml.current = toEditorHtml(n.content)
    setView('editor')
    setSavedTick(false)
  }

  function startFromTemplate(templateKey: string) {
    const tpl = TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[0]
    setShowTemplates(false)
    setEditId(null)
    setTitle('')
    setSubjectId('')
    setPinned(false)
    setTags([])
    pendingHtml.current = tpl.content
    setView('editor')
    setSavedTick(false)
  }

  useEffect(() => {
    if (view === 'editor' && editorRef.current) {
      editorRef.current.innerHTML = pendingHtml.current
      draftHtml.current = pendingHtml.current
    }
  }, [view, editId])

  async function saveNote() {
    if (!title.trim()) { toast.error('Give your note a title.'); return }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        content: draftHtml.current,
        subject: subjectId ? Number(subjectId) : null,
        pinned,
      }
      if (editId) {
        await api.patch('/notes/' + editId + '/', payload)
      } else {
        const { data } = await api.post<Note>('/notes/', payload)
        setEditId(data.id)
      }
      await loadData()
      setSavedTick(true)
      window.setTimeout(() => setSavedTick(false), 2200)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function removeNote(id: number) {
    try {
      await api.delete('/notes/' + id + '/')
      toast.success('Note deleted.')
      if (editId === id) { setView('list'); setEditId(null) }
      if (previewId === id) setPreviewId(null)
      await loadData()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function togglePinQuick(note: Note) {
    const next = !note.pinned
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: next } : n)))
    try {
      await api.patch('/notes/' + note.id + '/', { pinned: next })
    } catch (err) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: !next } : n)))
      toast.error(getErrorMessage(err))
    }
  }

  async function togglePinEditing() {
    const next = !pinned
    setPinned(next)
    if (!editId) return
    try {
      await api.patch('/notes/' + editId + '/', { pinned: next })
      await loadData()
    } catch (err) {
      setPinned(!next)
      toast.error(getErrorMessage(err))
    }
  }

  /* ── Toolbar ── */

  function exec(command: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    if (editorRef.current) draftHtml.current = editorRef.current.innerHTML
  }

  function toggleTag(tag: string) {
    const has = tags.includes(tag)
    if (has) {
      setTags(tags.filter((t) => t !== tag))
      if (editorRef.current) {
        editorRef.current.innerHTML = editorRef.current.innerHTML.split(tag).join('').replace(/(<br>\s*){2,}/g, '<br>')
        draftHtml.current = editorRef.current.innerHTML
      }
    } else {
      setTags([...tags, tag])
      exec('insertHTML', (draftHtml.current ? ' ' : '') + tag + '&nbsp;')
    }
  }

  /* ── AI ── */

  function aiContextText() {
    if (view === 'editor') return htmlToText(draftHtml.current)
    if (previewNote) return noteText(previewNote)
    return ''
  }

  function aiContextLabel() {
    if (view === 'editor') return title.trim() || 'Untitled note'
    return previewNote?.title ?? 'this note'
  }

  async function runTool(key: string) {
    if (key === 'quiz') { closeAi(); setQuizOpen(true); return }
    if (key === 'flashcards') { void makeFlashcards(); return }
    if (key === 'ask') { setAiPanel({ open: true, mode: 'chat', text: '', loading: false }); return }
    const ctx = aiContextText()
    if (!ctx) { toast.info('Write some content first.'); return }
    setAiPanel({ open: true, mode: 'result', tool: key, text: '', loading: true })
    try {
      const { data } = await api.post<{ reply?: string }>('/ai/chat/', {
        message: TOOL_PROMPTS[key] + '\n\nNote content:\n' + ctx.slice(0, 6000),
        context: { page: '/notes', mode: key },
      })
      setAiPanel({ open: true, mode: 'result', tool: key, text: data.reply ?? 'No result generated.', loading: false })
    } catch (err) {
      setAiPanel({ open: true, mode: 'result', tool: key, text: '', loading: false })
      toast.error(getErrorMessage(err))
    }
  }

  async function sendQuestion() {
    const q = askInput.trim()
    if (!q) return
    const ctx = aiContextText()
    if (!ctx) { toast.info('This note has no content yet.'); return }
    setAskInput('')
    setAiPanel({ open: true, mode: 'chat', text: '', loading: true })
    try {
      const { data } = await api.post<{ reply?: string }>('/ai/chat/', {
        message: q + '\n\nUse this note as context:\n' + ctx.slice(0, 6000),
        context: { page: '/notes', mode: 'ask' },
      })
      setAiPanel({ open: true, mode: 'chat', text: data.reply ?? 'No answer generated.', loading: false })
    } catch (err) {
      setAiPanel({ open: true, mode: 'chat', text: '', loading: false })
      toast.error(getErrorMessage(err))
    }
  }

  function insertIntoNote(text: string) {
    if (view !== 'editor') { toast.info('Open the note in the editor to insert.'); return }
    exec('insertHTML', '<br><br>' + text.replace(/\n/g, '<br>'))
    toast.success('Inserted into note.')
  }

  async function makeFlashcards() {
    const ctx = aiContextText()
    if (!ctx) { toast.info('Write some content first.'); return }
    setAiPanel({ open: true, mode: 'result', tool: 'flashcards', text: '', loading: true })
    try {
      const { data } = await api.post<{ reply?: string }>('/ai/chat/', {
        message:
          'Create study flashcards from this note. Reply ONLY with a JSON array of objects like [{"front":"question","back":"answer"}]. Make 8-12 cards.\n\nNote content:\n' +
          ctx.slice(0, 6000),
        context: { page: '/notes', mode: 'flashcards' },
      })
      const cards = extractFlashcards(data.reply ?? '')
      if (!cards.length) {
        setAiPanel({ open: true, mode: 'result', tool: 'flashcards', text: data.reply ?? '', loading: false })
        toast.error('Could not parse flashcards.')
        return
      }
      setDeck(cards)
      setDeckIdx(0)
      setDeckFlipped(false)
      closeAi()
    } catch (err) {
      closeAi()
      toast.error(getErrorMessage(err))
    }
  }

  /* ── Quiz generation ── */

  async function generateQuiz() {
    const src =
      quizSource === 'note'
        ? (view === 'editor' ? title.trim() : previewNote?.title.trim()) ?? ''
        : quizSource === 'subject'
          ? subjects.find((s) => s.id === Number(subjectFilter))?.name ??
            subjects.find((s) => String(s.id) === subjectId)?.name ??
            ''
          : 'Mixed review'
    if (!src) { toast.warn('Pick a note or subject first.'); return }
    setQuizBusy(true)
    try {
      await api.post('/quiz/generate/', { topic: src, difficulty: quizDifficulty, count: Number(quizCount) })
      toast.success(src + ' \u00B7 ' + quizCount + ' questions ready!')
      setQuizOpen(false)
      navigate('/quiz')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setQuizBusy(false)
    }
  }

  /* ── Fragments ── */

  if (loading) {
    return (
      <PageShell className="nt-page" title="Notes" subtitle="Your study knowledge in one place.">
        <div className="nt-empty"><span className="ne-icon">{'\uD83D\uDCDD'}</span><p>Loading your notes...</p></div>
      </PageShell>
    )
  }

  function filterLabel() {
    if (tagFilter) return 'TAGGED ' + tagFilter.replace('#', '').toUpperCase()
    if (subjectFilter !== 'all') return (subjects.find((s) => String(s.id) === subjectFilter)?.name ?? 'NOTES').toUpperCase()
    if (filter === 'favorites') return 'FAVORITES'
    if (filter === 'recent') return 'RECENT'
    return 'ALL NOTES'
  }

  const sidebar = (
    <aside className={'nt-sidebar' + (showSidebar ? ' nt-open' : '')}>
      <div className="nt-side-head">
        <span>Browse</span>
        <button className="nt-side-close" onClick={() => setShowSidebar(false)} aria-label="Close">&#215;</button>
      </div>
      <div className="nt-side-scroll">
        <div className="nt-side-section">
          <span className="nt-side-label">NOTES</span>
          {([
            ['all', '\uD83D\uDCC4', 'All Notes'],
            ['favorites', '\u2B50', 'Favorites'],
            ['recent', '\uD83D\uDD52', 'Recent'],
          ] as Array<[ListFilter, string, string]>).map(([key, icon, label]) => (
            <button
              key={key}
              className={'nt-side-item' + (filter === key ? ' active' : '')}
              onClick={() => {
                setFilter(key)
                setSubjectFilter('all')
                setTagFilter(null)
                setShowSidebar(false)
              }}
            >
              <span className="si-ico">{icon}</span>
              <em>{label}</em>
              {key === 'favorites' && notes.some((n) => n.pinned) && (
                <b>{notes.filter((n) => n.pinned).length}</b>
              )}
            </button>
          ))}
        </div>

        {subjects.length > 0 && (
          <div className="nt-side-section">
            <span className="nt-side-label">SUBJECTS</span>
            {subjects.map((s) => (
              <button
                key={s.id}
                className={'nt-side-item' + (subjectFilter === String(s.id) ? ' active' : '')}
                onClick={() => {
                  setSubjectFilter(subjectFilter === String(s.id) ? 'all' : String(s.id))
                  setFilter('all')
                  setTagFilter(null)
                  setShowSidebar(false)
                }}
              >
                <span className="si-dot" style={{ background: s.color || '#8b5cf6' }} />
                <em>{s.name}</em>
                {(subjectCounts[s.id] ?? 0) > 0 && <b>{subjectCounts[s.id]}</b>}
              </button>
            ))}
          </div>
        )}

        {Object.keys(tagCounts).length > 0 && (
          <div className="nt-side-section">
            <span className="nt-side-label">TAGS</span>
            <div className="nt-tagcloud">
              {Object.entries(tagCounts)
                .sort((x, y) => y[1] - x[1])
                .map(([t, c]) => (
                  <button
                    key={t}
                    className={'nt-tagnav' + (tagFilter === t ? ' active' : '')}
                    onClick={() => {
                      setTagFilter(tagFilter === t ? null : t)
                      setFilter('all')
                      setSubjectFilter('all')
                      setShowSidebar(false)
                    }}
                  >
                    {t} <i>{c}</i>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )

  const listView = (
    <section className="nt-list">
      <div className="nt-searchrow">
        <div className="nt-search">
          <span className="ico">{'\uD83D\uDD0D'}</span>
          <input
            placeholder="Search titles and content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="nt-clear" onClick={() => setSearch('')} aria-label="Clear search">&#215;</button>
          )}
        </div>
        <select
          className="nt-subjectpick"
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setFilter('all'); setTagFilter(null) }}
        >
          <option value="all">All Subjects</option>
          {subjects.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
        <button className="nt-filterbtn" onClick={() => setShowSidebar(true)} aria-label="Filters">{'\u2630'}</button>
      </div>

      <div className="nt-chips">
        {([
          ['all', 'All'],
          ['favorites', '\u2B50 Favorites'],
          ['recent', 'Recent'],
          ['shared', 'Shared'],
        ] as Array<[ListFilter, string]>).map(([key, label]) => (
          <button
            key={key}
            className={'nt-chip' + (filter === key ? ' active' : '')}
            onClick={() => {
              if (key === 'shared') { toast.info('Sharing is coming soon.'); return }
              setFilter(key)
              setTagFilter(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <h3 className="nt-sectiontitle">
        {filterLabel()}
        <span>{filteredNotes.length}</span>
      </h3>

      {filteredNotes.length ? (
        <div className="nt-cards">
          {filteredNotes.map((n) => {
            const text = noteText(n)
            const nTags = noteTags(n)
            const subj = subjects.find((s) => s.id === n.subject)
            return (
              <article key={n.id} className={'nt-card' + (previewId === n.id ? ' selected' : '')}>
                <header className="nc-head">
                  {n.pinned && <span className="nc-star">{'\u2B50'}</span>}
                  <h4 onClick={() => (wide ? (setPreviewId(previewId === n.id ? null : n.id)) : openEditor(n.id))}>{n.title || 'Untitled'}</h4>
                  <button
                    className={'nc-pin' + (n.pinned ? ' on' : '')}
                    onClick={() => void togglePinQuick(n)}
                    aria-label="Toggle favorite"
                  >
                    {n.pinned ? '\u2605' : '\u2606'}
                  </button>
                </header>
                <p className="nc-snippet" onClick={() => (wide ? (setPreviewId(previewId === n.id ? null : n.id)) : openEditor(n.id))}>
                  <Highlighted text={snippet(text, search.trim())} query={search.trim()} />
                </p>
                <footer className="nc-foot">
                  {n.subject_name && (
                    <span className="nc-subject">
                      <i style={{ background: subj?.color || '#8b5cf6' }} />
                      {n.subject_name}
                    </span>
                  )}
                  <span className="nc-tags">{nTags.slice(0, 2).map((t) => (
                    <button key={t} onClick={() => { setTagFilter(t); setFilter('all') }}>{t}</button>
                  ))}</span>
                  <span className="nc-time">Edited {timeAgo(n.updated_at)}</span>
                  <button className="nc-edit" onClick={() => openEditor(n.id)} aria-label="Edit note">{'\u270E'}</button>
                </footer>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="nt-empty">
          <span className="ne-icon">{'\uD83D\uDCDD'}</span>
          <p>
            {filter === 'shared'
              ? 'Sharing is coming soon.'
              : search.trim()
                ? 'No notes match "' + search.trim() + '".'
                : filter === 'favorites'
                  ? 'Star a note to see it here.'
                  : filter === 'recent'
                    ? 'No edits in the last 7 days.'
                    : 'No notes yet.'}
          </p>
          {!search.trim() && filter !== 'shared' && (
            <button className="nt-newcta" onClick={() => openEditor(null)}>+ New Note</button>
          )}
        </div>
      )}
    </section>
  )

  const previewPanel = previewNote ? (
    <aside className="nt-preview">
      <div className="np-topline">
        <span className="np-kicker">NOTE PREVIEW</span>
        <div className="np-tools">
          <button onClick={() => setAiPanel({ open: true, mode: 'menu', text: '', loading: false })}>{'\u2728'} AI Tools</button>
        </div>
      </div>
      <h3 className="np-title">{previewNote.pinned ? '\u2B50 ' : ''}{previewNote.title || 'Untitled'}</h3>
      <div className="np-meta">
        {previewNote.subject_name && (
          <span className="nc-subject">
            <i style={{ background: subjects.find((s) => s.id === previewNote.subject)?.color || '#8b5cf6' }} />
            {previewNote.subject_name}
          </span>
        )}
        <span>Edited {timeAgo(previewNote.updated_at)}</span>
      </div>
      <div className="nt-rich np-body" dangerouslySetInnerHTML={{ __html: toEditorHtml(previewNote.content) }} />
      <div className="np-actions">
        <button className="np-edit" onClick={() => openEditor(previewNote.id)}>{'\u270E'} Edit Note</button>
        <button className="np-delete" onClick={() => void removeNote(previewNote.id)}>Delete</button>
      </div>
    </aside>
  ) : wide ? (
    <aside className="nt-preview nt-preview-empty">
      <span className="ne-icon">{'\uD83D\uDC41'}</span>
      <p>Select a note to preview it here.</p>
    </aside>
  ) : null

  const editorView = (
    <div className="nt-editor">
      <header className="nt-ed-head">
        <button className="nt-back" onClick={() => { setView('list'); setEditId(null) }}>
          {'\u2190'} Notes
        </button>
        <div className="nt-ed-actions">
          <span className={'nt-savedtick' + (savedTick ? ' show' : '')}>{'\u2713'} Saved</span>
          <button className="nt-ai-open" onClick={() => setAiPanel({ open: true, mode: 'menu', text: '', loading: false })}>
            {'\u2728'} AI Tools
          </button>
          <button className="nt-savebtn" disabled={saving} onClick={() => void saveNote()}>
            {saving ? 'Saving\u2026' : 'Save \u2713'}
          </button>
          {editId != null && (
            <button className="nt-delbtn" onClick={() => void removeNote(editId)}>Delete</button>
          )}
        </div>
      </header>

      <input
        className="nt-title-input"
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="nt-meta-row">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">No subject</option>
          {subjects.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
        <button className={'nt-pintoggle' + (pinned ? ' on' : '')} onClick={() => void togglePinEditing()}>
          {pinned ? '\u2605 Pinned' : '\u2606 Pin'}
        </button>
        <div className="nt-tagpresets">
          {TAG_PRESETS.map((t) => (
            <button
              key={t}
              className={'nt-tagchip' + (tags.includes(t) ? ' on' : '')}
              onClick={() => toggleTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="nt-toolbar">
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} aria-label="Bold"><b>B</b></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} aria-label="Italic"><i>I</i></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} aria-label="Underline"><u>U</u></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec('strikeThrough')} aria-label="Strikethrough"><s>S</s></button>
        <span className="tb-sep" />
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')}>{'\u2022'} List</button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')}>1. List</button>
        <span className="tb-sep" />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = window.prompt('Link URL')
            if (url) exec('createLink', url)
          }}
        >
          {'\uD83D\uDD17'}
        </button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', '<pre>')}>{'Code'}</button>
        <span className="tb-sep" />
        <select
          defaultValue=""
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { if (e.target.value) { exec('formatBlock', e.target.value); e.currentTarget.value = '' } }}
        >
          <option value="" disabled>Style</option>
          <option value="<p>">Normal</option>
          <option value="<h1>">Heading 1</option>
          <option value="<h2>">Heading 2</option>
          <option value="<h3>">Heading 3</option>
        </select>
      </div>

      <div
        ref={editorRef}
        className="nt-rich nt-editor-area"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Start writing..."
        onInput={() => { if (editorRef.current) draftHtml.current = editorRef.current.innerHTML }}
      />

      <footer className="nt-ed-foot">
        {'\uD83D\uDCA1'} Use {'\u2728'} AI Tools to summarize this note, generate a quiz, or create flashcards.
      </footer>
    </div>
  )

  /* ── Render ── */

  return (
    <PageShell
      className="nt-page"
      title="Notes"
      subtitle="Your study knowledge in one place."
    >
      {view === 'editor' ? (
        editorView
      ) : (
        <div className="nt-layout">
          {sidebar}
          {listView}
          {previewPanel}
        </div>
      )}

      {showSidebar && <div className="nt-backdrop" onClick={() => setShowSidebar(false)} />}

      {/* Template picker */}
      {showTemplates && (
        <div className="nt-overlay" onClick={() => setShowTemplates(false)}>
          <div className="nt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Start a new note</h3>
            <div className="nt-template-grid">
              {TEMPLATES.map((t) => (
                <button key={t.key} className="nt-template-card" onClick={() => startFromTemplate(t.key)}>
                  <span className="tc-icon">{t.icon}</span>
                  <strong>{t.label}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quiz generator */}
      {quizOpen && (
        <div className="nt-overlay" onClick={() => setQuizOpen(false)}>
          <div className="nt-modal nt-quizmodal" onClick={(e) => e.stopPropagation()}>
            <h3>{'\uD83D\uDCDD'} Generate Quiz</h3>
            <div className="qz-group">
              <span className="qz-label">From</span>
              {([
                ['note', 'This note'],
                ['subject', 'This subject'],
                ['all', 'All my notes'],
              ] as Array<['note' | 'subject' | 'all', string]>).map(([key, label]) => (
                <button
                  key={key}
                  className={'qz-radio' + (quizSource === key ? ' on' : '')}
                  onClick={() => setQuizSource(key)}
                >
                  <i /> {label}
                </button>
              ))}
            </div>
            <div className="qz-group">
              <span className="qz-label">Questions</span>
              <select value={quizCount} onChange={(e) => setQuizCount(e.target.value)}>
                {['5', '10', '15', '20'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="qz-group">
              <span className="qz-label">Difficulty</span>
              <div className="qz-seg">
                {['easy', 'medium', 'hard'].map((d) => (
                  <button key={d} className={quizDifficulty === d ? ' on' : ''} onClick={() => setQuizDifficulty(d)}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="nt-modal-actions">
              <button className="nt-cancel" onClick={() => setQuizOpen(false)}>Cancel</button>
              <button className="nt-primary" disabled={quizBusy} onClick={() => void generateQuiz()}>
                {quizBusy ? 'Generating\u2026' : 'Generate Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flashcard deck */}
      {deck && (
        <div className="nt-overlay" onClick={() => setDeck(null)}>
          <div className="nt-modal nt-deck" onClick={(e) => e.stopPropagation()}>
            <header className="dk-head">
              <span className="dk-kicker">{'\uD83C\uDCCF'} FLASHCARD</span>
              <button className="nt-x" onClick={() => setDeck(null)} aria-label="Close">&#215;</button>
            </header>
            <button
              className={'dk-card' + (deckFlipped ? ' flipped' : '')}
              onClick={() => setDeckFlipped(!deckFlipped)}
            >
              {deckFlipped ? (
                <span className="dk-back">{deck[deckIdx].back}</span>
              ) : (
                <>
                  <span className="dk-q">What is it?</span>
                  <span className="dk-front">{deck[deckIdx].front}</span>
                  <span className="dk-hint">{'\u2193 Tap to reveal \u2193'}</span>
                </>
              )}
            </button>
            <footer className="dk-nav">
              <button disabled={deckIdx === 0} onClick={() => { setDeckIdx(deckIdx - 1); setDeckFlipped(false) }}>
                {'\u2190'} Previous
              </button>
              <span className="dk-count">{deckIdx + 1} / {deck.length}</span>
              <button
                disabled={deckIdx === deck.length - 1}
                onClick={() => { setDeckIdx(deckIdx + 1); setDeckFlipped(false) }}
              >
                Next {'\u2192'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* AI drawer */}
      {aiPanel.open && (
        <>
          <div className="nt-drawer-backdrop" onClick={closeAi} />
          <aside className="nt-aidrawer">
            <header className="ad-head">
              <span className="ad-brand">{'\u2726'} FocusFlow AI</span>
              <button className="nt-x" onClick={closeAi} aria-label="Close">&#215;</button>
            </header>

            {aiPanel.mode === 'menu' && (
              <>
                <p className="ad-note">About: <b>{aiContextLabel()}</b></p>
                <div className="ad-menu">
                  {AI_MENU.map((t) => (
                    <button key={t.key} onClick={() => void runTool(t.key)}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {aiPanel.mode === 'result' && (
              <>
                <p className="ad-note">About: <b>{aiContextLabel()}</b></p>
                {aiPanel.loading ? (
                  <div className="ac-typing ad-loading"><span /><span /><span /></div>
                ) : (
                  <>
                    <span className="ad-badge">{'\u2728'} {(aiPanel.tool ?? '').charAt(0).toUpperCase() + (aiPanel.tool ?? '').slice(1)}</span>
                    <div className="nt-rich ad-text">{aiPanel.text}</div>
                    <div className="ad-actions">
                      <button className="nt-primary" onClick={() => insertIntoNote(aiPanel.text ?? '')}>Insert into Note</button>
                      <button
                        className="nt-cancel"
                        onClick={() => { navigator.clipboard.writeText(aiPanel.text ?? ''); toast.success('Copied!') }}
                      >
                        Copy
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {aiPanel.mode === 'chat' && (
              <>
                <p className="ad-note">Based on your note: <b>"{aiContextLabel()}"</b></p>
                <div className="nt-rich ad-text">
                  {aiPanel.loading ? <div className="ac-typing"><span /><span /><span /></div> : aiPanel.text || 'Ask anything about this note.'}
                </div>
                <div className="ad-ask">
                  <input
                    placeholder="Ask another question..."
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void sendQuestion() }}
                  />
                  <button className="nt-primary" onClick={() => void sendQuestion()}>Ask</button>
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </PageShell>
  )
}
