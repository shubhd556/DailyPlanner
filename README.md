# Daily Planner – Next.js (App Router) + Gemini Chatbot

A minimal **Next.js** app with two routes (`/`, `/about`) that evolves into a powerful **Daily Task Planner**:

<img width="910" height="437" alt="image" src="https://github.com/user-attachments/assets/cfa6bc02-755b-40a8-9e04-c0af20c380b7" />

- ✅ Per‑day tasks (date picker) saved in **localStorage**
- ✍️ Add **title**, **time**, **priority** (low/med/high), **tags**, **notes**
- 🔎 Filters (status, priority, tag, search)
- 🔀 Reorder (Up/Down), **Clear done**, **Carry forward** unfinished tasks
- 🌗 **Dark/Light** theme toggle (pure white light theme)
- 🎉 **Full‑screen, dynamic confetti** when completing a task
- 🤖 **Built‑in chatbot** that:
  - Understands **commands** (add/done/delete/list/switch/clear/carry)
  - Chats naturally and uses **Gemini API** to **create/update/delete/complete** tasks via a structured tool‑call JSON (executed locally)

Deploy‑ready on **Vercel**.

---

## ✨ Demo Features

**Planner**
- Per‑day lists via date picker
- Add tasks with time, priority, tags and notes
- Filter by status/priority/tag/search
- Reorder (↑/↓), Clear done, Carry forward (moves active tasks to tomorrow)
- Confetti when marking a task as done

**Chatbot**
- Deterministic commands (run locally, no API):
  ```
  add <text> [time HH:MM] [priority low|med|high] [tags a,b,c] [notes ...]
  done <text>
  delete <text>
  list | what's left | show done
  clear done | carry forward
  switch <YYYY-MM-DD> | today | tomorrow
  help
  ```
- Natural conversation with **Gemini**:
  - “Add 30‑min code review at 17:30, high priority, tags dsa,coding”
  - “Change code review to 18:00 and priority medium”
  - “Delete code review”
  - “Switch to 2025‑09‑29 and add Morning run at 07:00”
- The chatbot asks Gemini to optionally return a **tool‑call JSON** (see schema below).  
  The app parses it and updates your tasks locally.

**Theme**
- Dark (default) and pure‑white Light
- Toggle in navbar (persists in localStorage)
- Pre‑hydration script prevents theme flash

---

## 🧱 Tech Stack

- **Next.js 14 (App Router)** + React 18
- **Edge** API route for **Gemini** (`/api/ai`)
- Client state + **localStorage** (no DB required)
- Vanilla CSS (no UI framework)
- Canvas‑based **confetti** (no extra deps)

---

## 📁 Project Structure

```
.
├── app
│   ├── about
│   │   └── page.js          # /about
│   ├── api
│   │   └── ai
│   │       └── route.js     # Gemini-only AI endpoint (Edge runtime)
│   ├── globals.css          # Theme + planner + chatbot + confetti styles
│   ├── layout.js            # Root layout + theme init Script
│   └── page.js              # / – Daily Planner (tasks + confetti + chatbot mount)
├── components
│   ├── Chatbot.js           # Chat UI + commands + Gemini tool-calling
│   ├── Nav.js               # Top navigation
│   └── ThemeToggle.js       # Dark/Light toggle
├── public/                  # static assets (optional)
├── package.json
├── next.config.mjs
└── README.md
```

---

## 🚀 Getting Started (Local)

### Prerequisites
- **Node.js 18+** (recommended LTS)

### 1) Install
```bash
npm install
```

### 2) Environment Variables
Create **`.env.local`** in the project root:

```bash
# .env.local
GEMINI_API_KEY=your_real_key_here
# Optional (default: models/gemini-2.5-flash)
GEMINI_MODEL=models/gemini-2.5-flash
```

> Keep secrets **server-side only**. Do **not** prefix with `NEXT_PUBLIC_`.

### 3) Run
```bash
npm run dev
# open http://localhost:3000
```

### 4) (Optional) Test the AI route
```bash
curl -s http://localhost:3000/api/ai   -H "Content-Type: application/json"   -d '{"messages":[{"role":"user","content":"Suggest a 2-hour focus plan after lunch."}]}'
```

---

## 🧭 Usage Guide

### Planner
- Pick a date → add tasks (title/time/priority/tags/notes)
- Filter by status/priority/tag/search
- Reorder with ↑/↓
- **Clear done** removes completed tasks
- **Carry forward** moves active tasks to tomorrow
- Completing a task triggers **confetti** 🎉

### Chatbot
- Click the **💬** bubble (bottom-right) to open
- Use **commands** (see list above) or talk naturally
- When you ask for changes in natural language, Gemini may return a tool‑call JSON which the app executes locally

---

## 🤖 Gemini API – How It’s Used

### Client → Server
The chatbot sends:
- Your latest prompt
- A short **task summary** (current date)
- A **Tool Spec** describing the expected JSON for task actions

### Server: `app/api/ai/route.js` (Edge)
- Calls Gemini **`generateContent`** using `GEMINI_API_KEY`
- Returns top candidate text as `{ text }`

### Client Tool‑Call Schema (expected from Gemini)
The model is asked to return a **single JSON object** (in a ```json fenced block) when an action is needed:

```json
{
  "action": "create | update | delete | complete | uncomplete | switch_date",
  "task": {
    "text": "string",
    "time": "HH:MM",
    "priority": "low|med|high",
    "tags": ["t1","t2"],
    "notes": "string",
    "done": false
  },
  "match": { "text": "string" },
  "changes": { "text": "string", "time": "HH:MM", "priority": "low|med|high", "tags": ["t"], "notes": "string", "done": true },
  "date": "YYYY-MM-DD",
  "message": "Short confirmation"
}
```

> If no change is needed, the model replies in plain text **without** JSON.

### Execution
- The client extracts JSON (if any) and **applies the action** to local state:
  - `create` → add task
  - `update` → modify fields of matching task
  - `delete` → remove task
  - `complete`/`uncomplete` → toggle `done`
  - `switch_date` → change current date
- A short confirmation message is shown, optionally followed by the model’s natural reply.

---

## 🎨 Theme

- **Dark** (default) uses your original palette
- **Light** is **pure white** surfaces + near‑black text + black primary
- Toggle stored in localStorage; first load follows **system** preference
- Pre‑hydration script in `layout.js` avoids theme flashing

---

## 🎉 Confetti

- Full‑screen overlay canvas:
  ```css
  .confetti-canvas {
    position: fixed; top: 0; left: 0;
    width: 100vw; height: 100vh;
    pointer-events: none; z-index: 100;
  }
  ```
- Canvas size adjusts on resize and scales for `devicePixelRatio` for crispness

---

## 🔐 Security

- Keep **GEMINI_API_KEY** **out of client code**
- Store secrets in `.env.local` (local) and **Vercel → Project → Settings → Environment Variables** (prod)
- The browser only talks to `/api/ai` (your server route), never directly to Google APIs

---

## ☁️ Deploy to Vercel

1) Push code to GitHub/GitLab/Bitbucket  
2) In **Vercel → Project → Settings → Environment Variables**:
   - `GEMINI_API_KEY = <your_key>`
   - (optional) `GEMINI_MODEL = models/gemini-2.5-flash`
3) **Deploy** (Vercel auto-detects Next.js: `next build`, output `.next`)

---

## 🧩 Customization

- **Model**: swap via `GEMINI_MODEL`
- **Tool‑calls**: extend the schema for multi‑action batches
- **Persistence**: replace localStorage with a DB + API routes
- **Streaming**: upgrade `/api/ai` to stream tokens for live typing
- **UI**: integrate Tailwind/MUI if desired (no changes required in logic)

---

## 🐛 Troubleshooting

- **“Missing GEMINI_API_KEY”** → add it to `.env.local` and restart `npm run dev`
- **Model error / 404** → use a valid model (e.g., `models/gemini-2.5-flash`)
- **No confetti** → ensure the canvas is present:
  ```jsx
  <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />
  ```
- **Theme flash** → ensure the theme init `<Script>` exists in `layout.js`

---

## 📜 License

MIT License

Copyright (c) 2025 shubhd556

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🙌 Credits

- Built with **Next.js App Router** & React 18  
- Confetti with HTML Canvas  
- Chatbot blends deterministic commands with **Gemini**-powered natural language + tool‑calls
