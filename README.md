Daily Planner – Next.js (App Router)
A minimal Next.js front‑end with two routes (/, /about) that evolves into a Daily Task Planner with:

<img width="910" height="437" alt="image" src="https://github.com/user-attachments/assets/d4f04274-38ff-4a18-ba42-853012caa01b" />

✅ Per‑day tasks (date picker) saved in localStorage
✍️ Add title, time, priority (low/med/high), tags, notes
🔎 Filters (status, priority, tag, search)
🔀 Reorder (Up/Down), Clear done, Carry forward unfinished tasks
🌗 Dark/Light theme toggle (pure white light theme)
🎉 Full‑screen, dynamic confetti when completing a task
🤖 Built‑in chatbot that:

Understands commands (add/done/delete/list/switch/clear/carry)
Talks naturally and uses Gemini API to create/update/delete/complete tasks via a structured tool‑call JSON (local execution)


🚀 Deploy‑ready on Vercel


⚙️ Tech

Next.js App Router (/app dir), React 18
Client‑side state + localStorage (no DB required)
Edge API route to Google Gemini (/api/ai)
Zero third‑party UI libraries


📦 Project Structure
.
├── app
│   ├── about
│   │   └── page.js          # /about
│   ├── api
│   │   └── ai
│   │       └── route.js     # Gemini-only AI endpoint (Edge runtime)
│   ├── globals.css          # Dark/Light theme + planner/chat styles
│   ├── layout.js            # global layout + theme init Script
│   └── page.js              # / – Daily Planner (tasks + confetti + chatbot mount)
├── components
│   ├── Chatbot.js           # Chat UI + rule commands + Gemini tool-calling
│   ├── Nav.js               # Top navigation
│   └── ThemeToggle.js       # Dark/Light toggle (localStorage + system default)
├── public/                  # static assets (optional)
├── package.json
├── next.config.mjs
└── README.md


🚀 Quickstart (Local)

Install

Shellnpm installShow more lines

Environment variables
Create .env.local in the project root (this file is git‑ignored):

Shell# .env.localGEMINI_API_KEY=your_real_key_here# Optional model override (defaults to models/gemini-2.5-flash)GEMINI_MODEL=models/gemini-2.5-flashShow more lines

Never expose your key on the client. Keep it server-side only (no NEXT_PUBLIC_).


Run

Shellnpm run dev# open http://localhost:3000Show more lines

Test the AI route

Shellcurl -s http://localhost:3000/api/ai \  -H "Content-Type: application/json" \  -d '{"messages":[{"role":"user","content":"Suggest a 2-hour plan after lunch"}]}'Show more lines

🧭 Usage
Daily Planner (Home /)

Use the date picker to select any day.
Add tasks with time, priority, tags and notes.
Filter by status, priority, tag, or free‑text search.
Reorder using ↑/↓.
Clear done removes completed tasks.
Carry forward moves all unfinished tasks to tomorrow.
Completing a task triggers full‑screen confetti 🎉.

Theme

Navbar → 🌞 Light / 🌙 Dark toggle.
First load uses system preference; your choice is saved.

Chatbot (bottom‑right chat bubble 💬)


Click to open/close.


It supports:

Deterministic commands (no AI needed):

add <text> [time HH:MM] [priority low|med|high] [tags a,b,c] [notes ...]
done <text>
delete <text>
list · what's left · show done
clear done · carry forward
switch <YYYY-MM-DD> · today · tomorrow
help


Natural chat with Gemini:

e.g., “Add 30‑min DSA at 6:00 pm, high priority, tags array,stack”
e.g., “Change DSA to 6:30 pm and set priority medium”
e.g., “Delete DSA”
e.g., “Switch to 2025‑09‑29 and add Morning run at 07:00”



The bot asks Gemini to optionally return a tool‑call JSON like:
JSON{  "action": "update",  "match": { "text": "DSA" },  "changes": { "time": "18:30", "priority": "med" },  "message": "Updated DSA to 18:30, priority medium."Show more lines
The app parses & executes this locally (no server DB), then shows a short confirmation and the AI’s natural reply.



🧠 How the AI Integration Works

The client chatbot sends your prompt, a brief summary of current tasks, and a tool spec to /api/ai.
The Edge API route (app/api/ai/route.js) calls Gemini’s generateContent endpoint using GEMINI_API_KEY and returns the top candidate text.
The chatbot tries to extract a JSON tool‑call (from a ```json fenced block or inline), validates it, and applies the requested change:

create, update, delete, complete, uncomplete, or switch_date.


If no JSON is present, it simply prints Gemini’s natural language answer.


All state updates are local (in browser memory + localStorage). You can later swap in a real database + API.


🎨 Theming Details

Dark (default) uses variables like --bg, --text, etc.
Light is pure white surfaces with near‑black text and black primary accents:
CSS[data-theme='light'] {  --bg: #ffffff;  --panel: #ffffff;  --text: #0a0a0a;  --muted: #4c4c4c;  --primary: #111111;  --primary-600: #000000;  /* borders/hover derived from black/gray for crisp light-mode look */}Show more lines

The toggle writes the theme to localStorage and sets data-theme on <html>.


🎉 Confetti

Full‑screen overlay canvas:
CSS.confetti-canvas {  position: fixed; top: 0; left: 0;  width: 100vw; height: 100vh;  pointer-events: none; z-index: 100;}Show more lines

JS uses a resize effect to match the viewport and scale for devicePixelRatio for crispness.
Confetti launches on complete and can be triggered from the chatbot when it marks tasks done.


🔐 Security Notes

Your GEMINI_API_KEY must live only in server environment (e.g., .env.local, Vercel env).
Never expose it in client code / NEXT_PUBLIC_ variables.
The /api/ai route is the only place that talks to Gemini.


🐛 Troubleshooting

“Missing GEMINI_API_KEY”
Create .env.local, add the key, restart npm run dev.
Gemini error or model not found
Use a valid model (e.g., models/gemini-2.5-flash) or set GEMINI_MODEL.
No confetti / canvas not covering screen
Ensure the CSS block above exists and the canvas is mounted:
JSX<canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />Show more lines

Theme flashing on load
Ensure app/layout.js includes the pre‑hydration <Script id="theme-init" strategy="beforeInteractive"> that sets data-theme from localStorage or system preference.


☁️ Deploy on Vercel

Push to GitHub/GitLab/Bitbucket.
In Vercel → Project → Settings → Environment Variables:

GEMINI_API_KEY = <your_key>
(optional) GEMINI_MODEL = models/gemini-2.5-flash


Deploy (Vercel auto-detects Next.js: build next build, output .next).


🛠️ Customize

Models: switch GEMINI_MODEL in env without code changes.
Tool-calls: extend the JSON schema (e.g., support multiple actions in one response).
Persistence: replace localStorage with a DB and swap updateTasks/addTaskFromFields to call your API routes.
Streaming: upgrade /api/ai to stream tokens via ReadableStream for live typing.


📝 License
Use it freely for personal or internal projects. Add your preferred license (e.g., MIT) if you plan to share/distribute.

🙌 Credits

Built with Next.js App Router, React 18.
Confetti written with HTML Canvas (no deps).
Chatbot combines deterministic commands and Gemini for natural language and structured tool‑calls.
