'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Chatbot for the Daily Planner – with AI "tool-calling" via JSON
 * ----------------------------------------------------------------
 * What changed:
 * 1) On free-form inputs, askAI() now sends a Tool Spec to Gemini requesting
 *    a structured JSON { action, ... } when it intends to modify tasks.
 * 2) The response is parsed for a JSON tool-call (fenced ```json or inline).
 * 3) If found and valid, we EXECUTE the requested change on the local state:
 *    - create: add a task
 *    - update: modify existing task fields
 *    - complete / uncomplete: toggle done
 *    - delete: remove a task
 *    - switch_date: change current date
 * 4) We still print a friendly assistant message and confirmation.
 *
 * Safe-by-default:
 * - If parsing fails or fields are invalid, we ignore the tool block and just
 *   show the assistant's normal text answer—no state change.
 *
 * Props required from parent:
 *  - tasks: array (current date's tasks)
 *  - updateTasks(nextArray): function
 *  - addTaskFromFields({ text, time, priority, tags, notes }): function
 *  - dateId: string 'YYYY-MM-DD'
 *  - setDateId(nextId): function
 *  - carryForward(): function
 *  - launchConfetti(origin?): function
 */

/* -----------------------------
   Tool schema the model is asked to output (optional).
   If the user request implies a change, the model should return:

   {
     "action": "create" | "update" | "delete" | "complete" | "uncomplete" | "switch_date",
     "task": {                       // for create or update (new values)
       "text": "string",
       "time": "HH:MM",              // optional
       "priority": "low|med|high",   // optional
       "tags": ["t1","t2"],          // optional
       "notes": "string",            // optional
       "done": boolean               // optional
     },
     "match": { "text": "string" },  // for update/complete/uncomplete/delete (to find an existing task)
     "changes": { ... },             // for update (fields to change; same shape as "task")
     "date": "YYYY-MM-DD",           // for switch_date
     "message": "natural language confirmation to the user"
   }

   The bot may also include a normal, friendly answer alongside the JSON.
------------------------------ */
const TOOL_SPEC = `
If the user's request implies changing tasks, respond with a single JSON object
that matches this TypeScript type exactly (no extra keys):

type ToolCall =
  | { action: "create"; task: { text: string; time?: string; priority?: "low" | "med" | "high"; tags?: string[]; notes?: string; done?: boolean }; message?: string }
  | { action: "update"; match: { text: string }; changes: { text?: string; time?: string; priority?: "low" | "med" | "high"; tags?: string[]; notes?: string; done?: boolean }; message?: string }
  | { action: "delete"; match: { text: string }; message?: string }
  | { action: "complete"; match: { text: string }; message?: string }
  | { action: "uncomplete"; match: { text: string }; message?: string }
  | { action: "switch_date"; date: string; message?: string };

Rules:
- When taking an action, put ONLY the JSON in a fenced block like:
  \`\`\`json
  { ... }
  \`\`\`
- Keep "message" short and practical (one or two lines).
- If no action is needed, do NOT produce JSON—just reply normally.
`.trim()

export default function Chatbot({
    tasks,
    updateTasks,
    addTaskFromFields,
    dateId,
    setDateId,
    carryForward,
    launchConfetti,
}) {
    const [open, setOpen] = useState(false)
    const [input, setInput] = useState('')
    const scrollRef = useRef(null)

    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text:
                `Hi! I'm your planner bot. Try:\n` +
                `• add buy milk time 17:00 priority high tags groceries,errand\n` +
                `• done buy milk / delete buy milk\n` +
                `• list / what's left / show done\n` +
                `• clear done / carry forward\n` +
                `• switch 2025-09-28 / today / tomorrow\n` +
                `• help\n\n` +
                `You can also talk naturally, e.g., "Add 30-min review at 5:30pm, high priority".`,
        },
    ])

    useEffect(() => {
        try {
            scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' })
        } catch { }
    }, [messages, open])

    // ---------- UI helpers ----------
    function reply(text) {
        setMessages((prev) => [...prev, { role: 'assistant', text }])
    }
    function sayUser(text) {
        setMessages((prev) => [...prev, { role: 'user', text }])
    }

    // ---------- Utilities ----------
    const findTaskByText = (query) => {
        const q = (query || '').toLowerCase().trim()
        return (
            tasks.find(t => t.text.toLowerCase() === q) ||
            tasks.find(t => t.text.toLowerCase().startsWith(q)) ||
            tasks.find(t => t.text.toLowerCase().includes(q))
        )
    }

    function fmtTask(t) {
        const bits = []
        if (t.time) bits.push(`🕒 ${t.time}`)
        bits.push(`prio:${t.priority}`)
        if (t.tags?.length) bits.push(`#${t.tags.join(' #')}`)
        if (t.notes) bits.push('📝')
        return `${t.done ? '✅' : '⬜️'} ${t.text}${bits.length ? ' · ' + bits.join(' · ') : ''}`
    }

    function listTasks(arr) {
        if (!arr.length) return 'No tasks.'
        return arr.map(fmtTask).join('\n')
    }

    function isDateLike(s) {
        return /^\d{4}-\d{2}-\d{2}$/.test(s)
    }

    // ---------- Tool execution ----------
    function applyTool(tool) {
        if (!tool || typeof tool !== 'object' || !tool.action) return { ok: false, msg: 'Invalid tool payload.' }

        const action = String(tool.action)
        const t = tool.task || {}
        const m = tool.match || {}
        const ch = tool.changes || {}
        const msg = tool.message

        const ensurePriority = (p) => (p === 'low' || p === 'med' || p === 'high') ? p : undefined
        const ensureTags = (tags) => Array.isArray(tags) ? tags.map(s => String(s)).filter(Boolean) : undefined

        // Utility: shallow update of a found task
        function updateFound(found, patch) {
            const next = tasks.map(x => x.id === found.id ? { ...x, ...patch } : x)
            updateTasks(next)
        }

        switch (action) {
            case 'create': {
                const text = (t.text || '').trim()
                if (!text) return { ok: false, msg: 'Create failed: "task.text" is required.' }
                const task = {
                    text,
                    time: (t.time || '').trim(),
                    priority: ensurePriority(t.priority) || 'med',
                    tags: ensureTags(t.tags) || [],
                    notes: (t.notes || '').trim(),
                    done: typeof t.done === 'boolean' ? t.done : false,
                }
                addTaskFromFields(task)
                if (task.done) launchConfetti()
                return { ok: true, msg: msg || `Added: ${text}` }
            }

            case 'update': {
                const q = (m.text || '').trim()
                if (!q) return { ok: false, msg: 'Update failed: "match.text" is required.' }
                const hit = findTaskByText(q)
                if (!hit) return { ok: false, msg: `Update failed: No task found for "${q}".` }

                const patch = {}
                if (typeof ch.text === 'string') patch.text = ch.text.trim()
                if (typeof ch.time === 'string') patch.time = ch.time.trim()
                if (ensurePriority(ch.priority)) patch.priority = ch.priority
                if (Array.isArray(ch.tags)) patch.tags = ensureTags(ch.tags)
                if (typeof ch.notes === 'string') patch.notes = ch.notes.trim()
                if (typeof ch.done === 'boolean') patch.done = ch.done

                updateFound(hit, patch)
                if (patch.done === true) launchConfetti()
                return { ok: true, msg: msg || `Updated: ${hit.text}` }
            }

            case 'delete': {
                const q = (m.text || '').trim()
                if (!q) return { ok: false, msg: 'Delete failed: "match.text" is required.' }
                const hit = findTaskByText(q)
                if (!hit) return { ok: false, msg: `Delete failed: No task found for "${q}".` }
                const next = tasks.filter(x => x.id !== hit.id)
                updateTasks(next)
                return { ok: true, msg: msg || `Deleted: ${hit.text}` }
            }

            case 'complete': {
                const q = (m.text || '').trim()
                if (!q) return { ok: false, msg: 'Complete failed: "match.text" is required.' }
                const hit = findTaskByText(q)
                if (!hit) return { ok: false, msg: `Complete failed: No task found for "${q}".` }
                if (hit.done) return { ok: true, msg: `Already done: ${hit.text}` }
                updateTasks(tasks.map(x => x.id === hit.id ? { ...x, done: true } : x))
                launchConfetti()
                return { ok: true, msg: msg || `Marked done: ${hit.text}` }
            }

            case 'uncomplete': {
                const q = (m.text || '').trim()
                if (!q) return { ok: false, msg: 'Uncomplete failed: "match.text" is required.' }
                const hit = findTaskByText(q)
                if (!hit) return { ok: false, msg: `Uncomplete failed: No task found for "${q}".` }
                if (!hit.done) return { ok: true, msg: `Already active: ${hit.text}` }
                updateTasks(tasks.map(x => x.id === hit.id ? { ...x, done: false } : x))
                return { ok: true, msg: msg || `Marked not done: ${hit.text}` }
            }

            case 'switch_date': {
                const d = (tool.date || '').trim()
                if (!isDateLike(d)) return { ok: false, msg: 'Switch failed: "date" must be YYYY-MM-DD.' }
                setDateId(d)
                return { ok: true, msg: msg || `Switched to ${d}.` }
            }

            default:
                return { ok: false, msg: `Unknown action: ${action}` }
        }
    }

    // Try to pull a JSON object from mixed text, prioritizing fenced ```json blocks
    function extractToolJSON(fullText) {
        if (!fullText || typeof fullText !== 'string') return { tool: null, remainder: fullText }

        // 1) Fenced ```json ... ```
        const fenced = fullText.match(/```json\s*([\s\S]*?)```/i)
        if (fenced) {
            const raw = fenced[1].trim()
            try {
                const tool = JSON.parse(raw)
                const remainder = fullText.replace(fenced[0], '').trim()
                return { tool, remainder }
            } catch { /* fallthrough */ }
        }

        // 2) First JSON-looking block (naive but effective for our case)
        const idx = fullText.indexOf('{')
        const last = fullText.lastIndexOf('}')
        if (idx !== -1 && last > idx) {
            const raw = fullText.slice(idx, last + 1)
            try {
                const tool = JSON.parse(raw)
                const remainder = (fullText.slice(0, idx) + fullText.slice(last + 1)).trim()
                return { tool, remainder }
            } catch { /* ignore */ }
        }

        return { tool: null, remainder: fullText }
    }

    // ---------- AI fallback (Gemini via /api/ai) ----------
    async function askAI(userText) {
        try {
            // Summarize up to 10 tasks to keep tokens low
            const summary = (tasks || []).slice(0, 10).map(t =>
                `${t.done ? '✅' : '⬜️'} ${t.text}${t.time ? ' @' + t.time : ''}${t.priority ? ' [' + t.priority + ']' : ''}`
            ).join('\n')

            // We append the TOOL_SPEC so the model knows how to respond with JSON actions
            const context =
                `Date: ${dateId}
Tasks:
${summary || '(none)'}

User: ${userText}

Developer Tool Spec:
${TOOL_SPEC}
`

            // Keep short chat history for context
            const history = messages.slice(-6).map(m => ({ role: m.role, content: m.text }))

            const res = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        ...history,
                        { role: 'user', content: context }
                    ]
                })
            })

            if (!res.ok) {
                const errText = await res.text().catch(() => '')
                reply(`(AI error) ${errText || res.statusText}`)
                return
            }

            const json = await res.json().catch(() => ({}))
            const full = (json && json.text) ? String(json.text) : ''

            // Attempt to extract tool JSON and execute it
            const { tool, remainder } = extractToolJSON(full)
            if (tool) {
                const result = applyTool(tool)
                if (result.ok) {
                    // Confirmation first, then any remaining assistant text
                    reply(result.msg + (remainder ? `\n\n${remainder}` : ''))
                } else {
                    // Tool parse/exec failed—show reason + remainder
                    reply(result.msg + (remainder ? `\n\n${remainder}` : ''))
                }
            } else {
                // No tool—just a normal assistant message
                reply(remainder || '…')
            }
        } catch (e) {
            reply(`(Network error) ${e?.message || 'Please try again.'}`)
        }
    }

    // ---------- Command parser (existing rule-based commands) ----------
    function handleCommand(raw) {
        const txt = raw.trim()
        if (!txt) return
        const text = txt.replace(/\s+/g, ' ')
        const lower = text.toLowerCase()

        // HELP
        if (lower === 'help' || lower === 'commands') {
            reply(
                `Commands:\n` +
                `• add <text> [time HH:MM] [priority low|med|high] [tags a,b,c] [notes ...]\n` +
                `• done <text>  | delete <text>\n` +
                `• list | what's left | show done\n` +
                `• clear done | carry forward\n` +
                `• switch <YYYY-MM-DD> | today | tomorrow\n\n` +
                `Or just talk naturally—I'll update tasks for you.`
            )
            return
        }

        // LIST / WHAT'S LEFT
        if (lower === 'list' || lower === "what's left" || lower === 'whats left') {
            const pending = lower.includes('left') ? tasks.filter(t => !t.done) : tasks
            reply(listTasks(pending))
            return
        }

        // SHOW DONE
        if (lower === 'show done') {
            reply(listTasks(tasks.filter(t => t.done)))
            return
        }

        // CLEAR DONE
        if (lower === 'clear done') {
            const next = tasks.filter(t => !t.done)
            updateTasks(next)
            reply(`Cleared ${tasks.length - next.length} completed task(s).`)
            return
        }

        // CARRY FORWARD
        if (lower === 'carry forward') {
            const count = tasks.filter(t => !t.done).length
            carryForward()
            reply(`Carried forward ${count} unfinished task(s) to the next day.`)
            return
        }

        // SWITCH DATE (explicit)
        if (lower.startsWith('switch ')) {
            const arg = text.slice(7).trim()
            if (isDateLike(arg)) {
                setDateId(arg)
                reply(`Switched to ${arg}.`)
            } else {
                reply(`Please provide a date as YYYY-MM-DD, e.g., switch 2025-09-28`)
            }
            return
        }

        // TODAY / TOMORROW
        if (lower === 'today') {
            const d = new Date()
            const id = d.toISOString().slice(0, 10)
            setDateId(id)
            reply(`Switched to today (${id}).`)
            return
        }
        if (lower === 'tomorrow') {
            const d = new Date()
            d.setDate(d.getDate() + 1)
            const id = d.toISOString().slice(0, 10)
            setDateId(id)
            reply(`Switched to tomorrow (${id}).`)
            return
        }

        // DONE <text>
        if (lower.startsWith('done ')) {
            const q = text.slice(5).trim()
            const hit = findTaskByText(q)
            if (!hit) {
                reply(`Couldn’t find a task matching “${q}”.`)
                return
            }
            const next = tasks.map(t => t.id === hit.id ? { ...t, done: true } : t)
            updateTasks(next)
            reply(`Marked as done: ${hit.text} ✅`)
            launchConfetti()
            return
        }

        // DELETE <text>
        if (lower.startsWith('delete ')) {
            const q = text.slice(7).trim()
            const hit = findTaskByText(q)
            if (!hit) {
                reply(`Couldn’t find a task matching “${q}”.`)
                return
            }
            const next = tasks.filter(t => t.id !== hit.id)
            updateTasks(next)
            reply(`Deleted: ${hit.text} 🗑️`)
            return
        }

        // ADD <...>
        if (lower.startsWith('add ')) {
            // Grammar:
            // add <text> [time HH:MM] [priority low|med|high] [tags a,b,c] [notes ...]
            let rest = text.slice(4).trim()

            const timeMatch = rest.match(/(?:^|\s)time\s(\d{2}:\d{2})/i)
            const prioMatch = rest.match(/(?:^|\s)priority\s(low|med|high)/i)
            const tagsMatch = rest.match(/(?:^|\s)tags\s([^]+?)(?=\snotes\s|$)/i)
            const notesMatch = rest.match(/(?:^|\s)notes\s([^]+)$/i)

            const time = timeMatch?.[1] || ''
            const priority = (prioMatch?.[1] || 'med').toLowerCase()
            const tags = tagsMatch?.[1] ? tagsMatch[1].split(',').map(s => s.trim()).filter(Boolean) : []
            const notes = notesMatch?.[1]?.trim() || ''

            rest = rest
                .replace(/(?:^|\s)time\s\d{2}:\d{2}/i, ' ')
                .replace(/(?:^|\s)priority\s(?:low|med|high)/i, ' ')
                .replace(/(?:^|\s)tags\s[^]+?(?=\snotes\s|$)/i, ' ')
                .replace(/(?:^|\s)notes\s[^]+$/i, ' ')
                .trim()

            const taskText = rest
            if (!taskText) {
                reply(`Please include task text, e.g., "add buy milk time 17:00 priority high tags groceries"`)
                return
            }

            addTaskFromFields({ text: taskText, time, priority, tags, notes })
            reply(`Added: ${taskText}${time ? ' (at ' + time + ')' : ''}${tags.length ? ' #' + tags.join(' #') : ''}`)
            return
        }

        // Greetings
        if (/^(hi|hello|hey)\b/i.test(text)) {
            reply(`Hello! Need to plan something for ${dateId}? Try "add ..." or type "help".`)
            return
        }

        // Fallback → AI (now with tool-calling capability)
        askAI(text)
    }

    function onSubmit(e) {
        e.preventDefault()
        const value = input.trim()
        if (!value) return
        sayUser(value)
        setInput('')
        setTimeout(() => handleCommand(value), 80)
    }

    const pendingCount = useMemo(() => tasks.filter(t => !t.done).length, [tasks])

    return (
        <>
            {/* Floating action button */}
            {!open && (
                <button
                    className="chatbot-fab"
                    onClick={() => setOpen(true)}
                    aria-label="Open chatbot"
                    title="Open chatbot"
                >
                    💬
                </button>
            )}

            {/* Chat panel */}
            {open && (
                <div className="chatbot-panel">
                    <div className="chatbot-header">
                        <strong>Planner Bot</strong>
                        <span className="muted"> · {pendingCount} left</span>
                        <button className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
                    </div>

                    <div className="chatbot-messages" ref={scrollRef}>
                        {messages.map((m, i) => (
                            <div key={i} className={`msg ${m.role === 'assistant' ? 'assistant' : 'user'}`}>
                                {m.text.split('\n').map((line, idx) => <div key={idx}>{line}</div>)}
                            </div>
                        ))}
                    </div>

                    <form className="chatbot-input" onSubmit={onSubmit}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder='Try: add code review at 17:30 priority high'
                            aria-label="Type a message"
                        />
                        <button className="btn" type="submit">Send</button>
                    </form>
                </div>
            )}
        </>
    )
}
