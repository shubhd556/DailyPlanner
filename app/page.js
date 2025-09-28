'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Chatbot from '../components/Chatbot'
/**
 * DAILY TASK PLANNER (localStorage only)
 * - Per-day tasks (YYYY-MM-DD)
 * - Add / toggle / delete / reorder
 * - Priority, time, tags, notes
 * - Filters: status, priority, tag, search
 * - Carry forward unfinished tasks
 * - Confetti when completing tasks 🎉
 */

const LS_KEY = 'planner.tasksByDate.v1'

const todayId = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const uid = () => Math.random().toString(36).slice(2, 9)


function useLocalState(key, initial) {
  const [state, setState] = useState(initial)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setState(JSON.parse(raw))
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)) } catch {}
  }, [key, state])
  return [state, setState]
}

export default function HomePage() {
  // Global state: map of dateId => tasks[]
  const [byDate, setByDate] = useLocalState(LS_KEY, {})
  const [dateId, setDateId] = useState(todayId())

  // Add form state
  const [text, setText] = useState('')
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState('med') // low | med | high
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')

  // Filters
  const [filter, setFilter] = useState('all') // all | active | done
  const [prioFilter, setPrioFilter] = useState('all') // all | low | med | high
  const [tagFilter, setTagFilter] = useState('')
  const [search, setSearch] = useState('')

  // Confetti refs
  const canvasRef = useRef(null)
  const confettiTimer = useRef(null)

  const tasks = useMemo(() => byDate[dateId] || [], [byDate, dateId])
  const doneCount = tasks.filter(t => t.done).length
  const total = tasks.length
  const percent = total ? Math.round((doneCount / total) * 100) : 0

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filter === 'active' && t.done) return false
      if (filter === 'done' && !t.done) return false
      if (prioFilter !== 'all' && t.priority !== prioFilter) return false
      if (tagFilter) {
        const needle = tagFilter.toLowerCase()
        const has = (t.tags || []).some(tag => tag.toLowerCase().includes(needle))
        if (!has) return false
      }
      if (search) {
        const s = search.toLowerCase()
        const inText = t.text.toLowerCase().includes(s)
        const inNotes = (t.notes || '').toLowerCase().includes(s)
        if (!inText && !inNotes) return false
      }
      return true
    })
  }, [tasks, filter, prioFilter, tagFilter, search])

  function updateTasks(next) {
    setByDate(prev => ({ ...prev, [dateId]: next }))
  }

  function addTask(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    const newTask = {
      id: uid(),
      text: value,
      time: time || '',
      priority,
      tags: tags.split(',').map(s => s.trim()).filter(Boolean),
      notes: notes.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    }
    updateTasks([newTask, ...tasks])
    setText(''); setTime(''); setPriority('med'); setTags(''); setNotes('')
  }

  function toggleTask(id) {
    const next = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)
    const wasUndone = tasks.find(t => t.id === id && !t.done)
    updateTasks(next)
    if (wasUndone) launchConfetti()
  }

  function removeTask(id) { updateTasks(tasks.filter(t => t.id !== id)) }

  function moveTask(id, dir) {
    const idx = tasks.findIndex(t => t.id === id)
    if (idx < 0) return
    const j = dir === 'up' ? idx - 1 : idx + 1
    if (j < 0 || j >= tasks.length) return
    const copy = tasks.slice()
    const [item] = copy.splice(idx, 1)
    copy.splice(j, 0, item)
    updateTasks(copy)
  }

  function clearDone() { updateTasks(tasks.filter(t => !t.done)) }

  function carryForward() {
    const unfinished = tasks.filter(t => !t.done)
    if (unfinished.length === 0) return
    const d = new Date(dateId + 'T00:00')
    d.setDate(d.getDate() + 1)
    const nextId = d.toISOString().slice(0,10)
    setByDate(prev => {
      const nextTasks = prev[nextId] || []
      return { ...prev, [nextId]: [...unfinished, ...nextTasks] }
    })
  }
  function addTaskFromFields({ text, time = '', priority = 'med', tags = [], notes = '' }) {
    const newTask = {
      id: uid(),
      text,
      time,
      priority,
      tags,
      notes,
      done: false,
      createdAt: new Date().toISOString(),
    }
    updateTasks([newTask, ...tasks])
  }
  // --- Confetti (no external deps) ---
  function launchConfetti(origin) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
  
    // Use CSS pixel coordinates (we scaled the context in the resize effect)
    const W = window.innerWidth
    const H = window.innerHeight
  
    const centerX = origin?.x ?? W / 2
    const centerY = origin?.y ?? H / 3
  
    const colors = ['#5b8cff', '#a78bfa', '#34d399', '#fbbf24', '#f472b6']
    const N = 140
    const parts = Array.from({ length: N }, () => ({
      x: centerX + (Math.random() - 0.5) * 140,
      y: centerY,
      r: Math.random() * 6 + 4,
      c: colors[(Math.random() * colors.length) | 0],
      vx: (Math.random() - 0.5) * 7,
      vy: Math.random() * -7 - 5,
      ay: 0.14 + Math.random() * 0.08,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.5,
    }))
  
    const start = performance.now()
  
    function frame(now) {
      const dt = (now - (frame.t || now)) / 16.67
      frame.t = now
  
      ctx.clearRect(0, 0, W, H)
  
      parts.forEach(p => {
        p.vy += p.ay
        p.x  += p.vx * dt
        p.y  += p.vy * dt
        p.rot += p.vr * dt
  
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.c
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
        ctx.restore()
      })
  
      if (now - start < 1500) {
        confettiTimer.current = requestAnimationFrame(frame)
      } else {
        ctx.clearRect(0, 0, W, H)
        confettiTimer.current = null
      }
    }
  
    if (confettiTimer.current) cancelAnimationFrame(confettiTimer.current)
    confettiTimer.current = requestAnimationFrame(frame)
  }



  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
  
    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)) // clamp to 2 for perf
      const cssW = window.innerWidth
      const cssH = window.innerHeight
  
      // Set CSS size (how big it looks)
      canvas.style.width = cssW + 'px'
      canvas.style.height = cssH + 'px'
  
      // Set drawing buffer size (for crispness)
      canvas.width = Math.floor(cssW * dpr)
      canvas.height = Math.floor(cssH * dpr)
  
      // Scale drawing operations so coordinates use CSS pixels
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
  
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  
  

  return (
    <section>
      <h1>Daily Planner</h1>
      <p className="muted">Plan your day, stay focused, and celebrate progress 🎉</p>

      {/* Toolbar */}
      <div className="planner-bar">
        <input className="date" type="date" value={dateId} onChange={e => setDateId(e.target.value)} />
        <select className="select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="done">Done</option>
        </select>
        <select className="select" value={prioFilter} onChange={e => setPrioFilter(e.target.value)}>
          <option value="all">Any priority</option>
          <option value="low">Low</option>
          <option value="med">Medium</option>
          <option value="high">High</option>
        </select>
        <input className="search" type="search" placeholder="Search text or notes…" value={search} onChange={e => setSearch(e.target.value)} />
        <input className="input" style={{maxWidth:180}} type="text" placeholder="Filter by tag" value={tagFilter} onChange={e => setTagFilter(e.target.value)} />
        <div className="spacer" />
        <span className="muted">{doneCount}/{total} done · {percent}%</span>
        <button className="linkish" onClick={clearDone}>Clear done</button>
        <button className="linkish" onClick={carryForward}>Carry forward ➜</button>
      </div>

      {/* Add task form */}
      <form onSubmit={addTask} className="task-form" aria-label="Add task">
        <input className="input" type="text" placeholder="Task… (required)" value={text} onChange={e => setText(e.target.value)} aria-label="Task" />
        <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} aria-label="Time" />
        <select className="input" value={priority} onChange={e => setPriority(e.target.value)} aria-label="Priority">
          <option value="low">Low</option>
          <option value="med">Medium</option>
          <option value="high">High</option>
        </select>
        <input className="input" type="text" placeholder="tags (comma,separated)" value={tags} onChange={e => setTags(e.target.value)} aria-label="Tags" />
        <button className="btn add-btn" type="submit">Add</button>
        <input className="input notes" type="text" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} aria-label="Notes" />
      </form>

      {/* List */}
      <ul className="list" aria-live="polite">
        {filtered.length === 0 && (
          <li className="empty">No tasks for this day. Add one above ✍️</li>
        )}
        {filtered.map(t => (
          <li key={t.id} className="item">
            <label className="row">
              <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} aria-label={t.done ? 'Mark as not done' : 'Mark as done'} />
              <span className={`txt ${t.done ? 'done' : ''}`}>{t.text}</span>
            </label>
            <div className="meta">
              {t.time && <span className="badge time">🕒 {t.time}</span>}
              <span className={`badge prio-${t.priority}`}>Priority: {t.priority}</span>
              {(t.tags||[]).map(tag => <span key={tag} className="badge">#{tag}</span>)}
              {t.notes && <span className="badge">📝 notes</span>}
            </div>
            <div className="row">
              <button className="icon" title="Move up" onClick={() => moveTask(t.id, 'up')}>↑</button>
              <button className="icon" title="Move down" onClick={() => moveTask(t.id, 'down')}>↓</button>
              <button className="icon danger" title="Delete" onClick={() => removeTask(t.id)}>×</button>
            </div>
          </li>
        ))}
      </ul>
      <Chatbot
  tasks={tasks}
  updateTasks={updateTasks}
  addTaskFromFields={addTaskFromFields}
  dateId={dateId}
  setDateId={setDateId}
  carryForward={carryForward}
  launchConfetti={launchConfetti}
/>
      {/* Confetti Canvas */}
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />
    </section>
  )
}
