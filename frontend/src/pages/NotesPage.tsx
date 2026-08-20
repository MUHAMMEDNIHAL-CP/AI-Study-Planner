import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'

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

type Subject = {
  id: number
  name: string
  color: string
}

type NoteCategory = 'all' | 'favorites' | 'recent' | 'trash'

type AiTool = 'summarize' | 'explain' | 'quiz' | 'flashcards' | 'keypoints' | 'improve' | 'ask'

type AiResult = {
  text: string
  loading: boolean
}

const TEMPLATES: { key: string; label: string; icon: string; content: string }[] = [
  { key: 'lecture', label: 'Lecture Notes', icon: '\uD83D\uDCD6', content: '## Topic:\n\n## Key Points:\n\n\n\n## Summary:\n\n' },
  { key: 'summary', label: 'Topic Summary', icon: '\uD83E\uDDE0', content: '## Definition:\n\n## Important Points:\n\n\n\n## Examples:\n\n' },
  { key: 'exam', label: 'Exam Notes', icon: '\uD83C\uDF93', content: '## Topic:\n\n## Definition:\n\n## Important Points:\n\n\n\n## Advantages:\n\n## Disadvantages:\n\n\n\n## Examples:\n\n\n\n## Important Questions:\n\n\n\n## Exam Tip:\n\n' },
  { key: 'questions', label: 'Important Questions', icon: '\u2753', content: '## Subject:\n\n## Questions:\n\n1. \n\n2. \n\n3. \n\n## Answers:\n\n1. \n\n2. \n\n3. \n\n' },
  { key: 'revision', label: 'Revision Notes', icon: '\uD83D\uDCCB', content: '## Chapter:\n\n## Key Formulas:\n\n\n\n## Quick Summary:\n\n\n\n## Must Remember:\n\n' },
  { key: 'quick', label: 'Quick Notes', icon: '\uD83D\uDCA1', content: '' },
]

const AI_TOOLS: { key: AiTool; label: string; icon: string }[] = [
  { key: 'summarize', label: 'Summarize Note', icon: '\u2728' },
  { key: 'explain', label: 'Explain Simply', icon: '\uD83E\uDDE0' },
  { key: 'quiz', label: 'Generate Quiz', icon: '\uD83D\uDCDD' },
  { key: 'flashcards', label: 'Generate Flashcards', icon: '\uD83D\uDCA0' },
  { key: 'keypoints', label: 'Find Important Points', icon: '\uD83C\uDFAF' },
  { key: 'improve', label: 'Improve Note', icon: '\u2728' },
  { key: 'ask', label: 'Ask AI About This', icon: '\uD83D\uDCAC' },
]

const TAG_PRESETS = ['#important', '#exam', '#revision', '#formula', '#question', '#weak-topic']

function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return days + 'd ago'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function extractTags(content: string): string[] {
  const tags: string[] = []
  for (const tag of TAG_PRESETS) {
    if (content.toLowerCase().includes(tag.toLowerCase())) tags.push(tag)
  }
  return tags
}

function contentPreview(content: string, maxLen = 120): string {
  const clean = content.replace(/[#*`\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLen) return clean
  return clean.slice(0, maxLen) + '...'
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<NoteCategory>('all')
  const [subjectFilter, setSubjectFilter] = useState<number | null>(null)
  const [view, setView] = useState<'grid' | 'editor'>('grid')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)
  const [showAiTools, setShowAiTools] = useState(false)
  const [aiResult, setAiResult] = useState<AiResult>({ text: '', loading: false })
  const [aiQuery, setAiQuery] = useState('')
  const [mobilePanel, setMobilePanel] = useState<'sidebar' | 'main'>('main')

  const contentRef = useRef<HTMLTextAreaElement>(null)
  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId])

  const filteredNotes = useMemo(() => {
    let filtered = [...notes]
    if (category === 'favorites') filtered = filtered.filter((n) => n.pinned)
    else if (category === 'recent') {
      const weekAgo = new Date(Date.now() - 7 * 86400000)
      filtered = filtered.filter((n) => new Date(n.updated_at) >= weekAgo)
    }
    if (subjectFilter !== null) filtered = filtered.filter((n) => n.subject === subjectFilter)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.subject_name && n.subject_name.toLowerCase().includes(q))
      )
    }
    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [notes, category, subjectFilter, search])

  const subjectCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const n of notes) {
      if (n.subject) counts[n.subject] = (counts[n.subject] || 0) + 1
    }
    return counts
  }, [notes])

  async function loadNotes() {
    const [notesRes, subjectsRes] = await Promise.all([
      api.get<Note[]>('/notes/'),
      api.get<Subject[]>('/study/subjects/'),
    ])
    setNotes(notesRes.data)
    setSubjects(subjectsRes.data)
  }

  useEffect(() => {
    let active = true
    async function init() {
      try { await loadNotes() }
      catch (err) { if (active) toast.error(getErrorMessage(err)) }
      finally { if (active) setLoading(false) }
    }
    void init()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title)
      setContent(selectedNote.content)
      setSubjectId(selectedNote.subject ? String(selectedNote.subject) : '')
      setPinned(selectedNote.pinned)
      setTags(extractTags(selectedNote.content))
    }
  }, [selectedNote])

  function openEditor(noteId: number | null) {
    setSelectedId(noteId)
    setView('editor')
    setMobilePanel('main')
    setShowAiTools(false)
    setAiResult({ text: '', loading: false })
    if (!noteId) {
      setTitle('')
      setContent('')
      setSubjectId('')
      setPinned(false)
      setTags([])
    }
  }

  async function saveNote() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      if (selectedId) {
        await api.patch('/notes/' + selectedId + '/', {
          title: title.trim(), content, subject: subjectId ? Number(subjectId) : null, pinned,
        })
        toast.success('Note updated')
      } else {
        const { data } = await api.post<Note>('/notes/', {
          title: title.trim(), content, subject: subjectId ? Number(subjectId) : null, pinned,
        })
        setSelectedId(data.id)
        toast.success('Note created')
      }
      await loadNotes()
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  async function deleteNote() {
    if (!selectedId) return
    try {
      await api.delete('/notes/' + selectedId + '/')
      setView('grid')
      setSelectedId(null)
      setTitle('')
      setContent('')
      setSubjectId('')
      setPinned(false)
      setTags([])
      toast.success('Note deleted')
      await loadNotes()
    } catch (err) { toast.error(getErrorMessage(err)) }
  }

  async function togglePin() {
    if (!selectedId) return
    const next = !pinned
    setPinned(next)
    try {
      await api.patch('/notes/' + selectedId + '/', { pinned: next })
      await loadNotes()
    } catch (err) { toast.error(getErrorMessage(err)) }
  }

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      const newTags = [...tags, t]
      setTags(newTags)
      setContent((prev) => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + t + ' ')
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  function applyTemplate(templateKey: string) {
    const tpl = TEMPLATES.find((t) => t.key === templateKey)
    if (tpl) setContent(tpl.content)
    setShowTemplate(false)
  }

  async function runAiTool(tool: AiTool) {
    const text = content.trim()
    if (!text && tool !== 'ask') { toast.info('Write some content first.'); return }
    setAiResult({ text: '', loading: true })
    setShowAiTools(true)

    const toolLabels: Record<AiTool, string> = {
      summarize: 'Summarize', explain: 'Explain simply', quiz: 'Generate quiz questions',
      flashcards: 'Generate flashcards', keypoints: 'Find important points',
      improve: 'Improve this note', ask: 'Answer question',
    }

    try {
      const prompt = tool === 'ask' && aiQuery
        ? 'About this note: ' + aiQuery + '\n\nNote content:\n' + text
        : 'Note content:\n' + text
      const { data } = await api.post('/ai/chat/', {
        message: toolLabels[tool] + '\n\n' + prompt,
        context: { page: '/notes', mode: tool },
      })
      setAiResult({ text: data.reply || 'No result generated.', loading: false })
    } catch (err) {
      setAiResult({ text: 'AI service is temporarily unavailable.', loading: false })
      toast.error(getErrorMessage(err))
    }
  }

  function insertAiResult() {
    if (!aiResult.text) return
    setContent((prev) => prev + (prev.endsWith('\n') || !prev ? '' : '\n\n') + aiResult.text)
    setAiResult({ text: '', loading: false })
    setShowAiTools(false)
    toast.success('AI content inserted.')
  }

  if (loading) {
    return (
      <PageShell eyebrow="Notes" title="Loading notes..." subtitle="Fetching your notes.">
        <div className="page-card">Loading...</div>
      </PageShell>
    )
  }

  const categoryItems: { key: NoteCategory; label: string; icon: string }[] = [
    { key: 'all', label: 'All Notes', icon: '\uD83D\uDCC4' },
    { key: 'favorites', label: 'Favorites', icon: '\u2B50' },
    { key: 'recent', label: 'Recent', icon: '\uD83D\uDD52' },
  ]

  return (
    <PageShell
      className="notes-page"
      eyebrow="Notes"
      title="Study Notes"
      subtitle="Save your learning in one place."
      actions={
        view === 'editor' ? (
          <div className="np-editor-actions-top">
            <button className="np-back-btn" onClick={() => setView('grid')} type="button">{'\u2190'} Notes</button>
            <button className="np-save-btn" disabled={saving} onClick={saveNote} type="button">{saving ? 'Saving...' : 'Save \u2713'}</button>
            <div className="np-ai-tools-wrap">
              <button className="np-ai-tools-btn" onClick={() => setShowAiTools(!showAiTools)} type="button">{'\u2728'} AI Tools</button>
              {showAiTools && (
                <div className="np-ai-dropdown">
                  {AI_TOOLS.map((t) => (
                    <button key={t.key} onClick={() => void runAiTool(t.key)} type="button">{t.icon} {t.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <button className="gradient-action" onClick={() => openEditor(null)} type="button">+ New Note</button>
        )
      }
    >
      <div className="np-layout">
        {/* Sidebar */}
        <aside className={'np-sidebar ' + (mobilePanel === 'sidebar' ? 'np-mobile-show' : '')}>
          <div className="np-search-wrap">
            <input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} type="text" />
          </div>

          <div className="np-sidebar-section">
            <span className="np-sidebar-label">NOTES</span>
            {categoryItems.map((c) => (
              <button
                key={c.key}
                className={'np-sidebar-item ' + (category === c.key && subjectFilter === null ? 'active' : '')}
                onClick={() => { setCategory(c.key); setSubjectFilter(null); setMobilePanel('main') }}
                type="button"
              >
                <span>{c.icon}</span> {c.label}
                {c.key === 'favorites' && <span className="np-sidebar-count">{notes.filter((n) => n.pinned).length}</span>}
              </button>
            ))}
          </div>

          {subjects.length > 0 && (
            <div className="np-sidebar-section">
              <span className="np-sidebar-label">SUBJECTS</span>
              {subjects.map((s) => (
                <button
                  key={s.id}
                  className={'np-sidebar-item ' + (subjectFilter === s.id ? 'active' : '')}
                  onClick={() => { setSubjectFilter(s.id); setCategory('all'); setMobilePanel('main') }}
                  type="button"
                >
                  <span className="np-subject-dot" style={{ background: s.color || '#8b5cf6' }} />
                  {s.name}
                  <span className="np-sidebar-count">{subjectCounts[s.id] || 0}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Main */}
        <main className={'np-main ' + (mobilePanel === 'main' ? 'np-mobile-show' : '')}>
          {view === 'grid' ? (
            <>
              <div className="np-grid-header">
                <span className="np-grid-title">{category === 'all' && !subjectFilter ? 'ALL NOTES' : category === 'favorites' ? 'FAVORITES' : category === 'recent' ? 'RECENT' : subjects.find((s) => s.id === subjectFilter)?.name || 'NOTES'}</span>
                <span className="np-grid-count">{filteredNotes.length} notes</span>
                <button className="np-mobile-sidebar-btn" onClick={() => setMobilePanel('sidebar')} type="button">{'\u2630'}</button>
              </div>
              {filteredNotes.length ? (
                <div className="np-cards-grid">
                  {filteredNotes.map((note) => {
                    const noteTags = extractTags(note.content)
                    return (
                      <button className="np-card" key={note.id} onClick={() => openEditor(note.id)} type="button">
                        <div className="np-card-head">
                          {note.pinned && <span className="np-card-fav">{'\u2B50'}</span>}
                          <strong>{note.title || 'Untitled'}</strong>
                        </div>
                        <p className="np-card-preview">{contentPreview(note.content)}</p>
                        <div className="np-card-footer">
                          <span className="np-card-subject">
                            {note.subject_name && <><span className="np-card-dot" style={{ background: subjects.find((s) => s.id === note.subject)?.color || '#8b5cf6' }} />{note.subject_name}</>}
                          </span>
                          <span className="np-card-time">{timeAgo(note.updated_at)}</span>
                        </div>
                        {noteTags.length > 0 && (
                          <div className="np-card-tags">
                            {noteTags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="np-empty">
                  <p>{search ? 'No notes match your search.' : 'No notes yet. Create one to get started!'}</p>
                </div>
              )}
            </>
          ) : (
            <div className="np-editor">
              <input className="np-editor-title" placeholder="Note title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />

              <div className="np-editor-meta">
                <div className="np-editor-meta-row">
                  <span className="np-editor-meta-label">Subject:</span>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="">None</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button className={'np-pin-toggle ' + (pinned ? 'active' : '')} onClick={togglePin} type="button">
                    {pinned ? '\u2B50 Pinned' : '\u2606 Pin'}
                  </button>
                  {selectedId && <button className="np-delete-btn" onClick={deleteNote} type="button">Delete</button>}
                </div>
                <div className="np-editor-meta-row">
                  <span className="np-editor-meta-label">Tags:</span>
                  <div className="np-tags-list">
                    {tags.map((t) => (
                      <span key={t} className="np-tag">{t} <button onClick={() => removeTag(t)} type="button">{'\u2715'}</button></span>
                    ))}
                    <input placeholder="Add tag..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTag(tagInput.startsWith('#') ? tagInput : '#' + tagInput) } }} />
                  </div>
                  <div className="np-tag-presets">
                    {TAG_PRESETS.filter((t) => !tags.includes(t)).slice(0, 4).map((t) => (
                      <button key={t} className="np-tag-preset" onClick={() => addTag(t)} type="button">{t}</button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea className="np-editor-textarea" ref={contentRef} placeholder="Start writing your notes..." value={content} onChange={(e) => setContent(e.target.value)} />

              {selectedNote && (
                <div className="np-editor-footer">
                  <span>Last edited {timeAgo(selectedNote.updated_at)}</span>
                </div>
              )}

              {/* AI Result Panel */}
              {showAiTools && (
                <div className="np-ai-panel">
                  <div className="np-ai-panel-header">
                    <span>{'\u2726'} AI Result</span>
                    <button onClick={() => { setAiResult({ text: '', loading: false }); setShowAiTools(false) }} type="button">{'\u2715'}</button>
                  </div>
                  {aiResult.loading ? (
                    <div className="np-ai-loading"><div className="ac-typing"><span /><span /><span /></div></div>
                  ) : aiResult.text ? (
                    <>
                      <p>{aiResult.text}</p>
                      <div className="np-ai-panel-actions">
                        <button className="np-ai-insert-btn" onClick={insertAiResult} type="button">Insert Summary</button>
                        <button className="np-ai-copy-btn" onClick={() => { navigator.clipboard.writeText(aiResult.text); toast.success('Copied!') }} type="button">Copy</button>
                      </div>
                    </>
                  ) : null}
                  {aiResult.text && aiResult.text.toLowerCase().includes('quiz') && (
                    <div className="np-ai-ask-row">
                      <input placeholder="Ask a follow-up question..." value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void runAiTool('ask') }} />
                      <button onClick={() => void runAiTool('ask')} type="button">Ask</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Template Picker */}
          {showTemplate && (
            <div className="np-template-overlay" onClick={() => setShowTemplate(false)}>
              <div className="np-template-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Choose Template</h3>
                <div className="np-template-grid">
                  {TEMPLATES.map((t) => (
                    <button key={t.key} className="np-template-card" onClick={() => applyTemplate(t.key)} type="button">
                      <span className="np-template-icon">{t.icon}</span>
                      <strong>{t.label}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </PageShell>
  )
}
