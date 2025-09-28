# Next.js Two Routes App

A minimal **Next.js (App Router)** sample with just **two routes**: `/` and `/about`.

## Quickstart

```bash
# 1) Install dependencies
npm install

# 2) Run the dev server
npm run dev
# open http://localhost:3000

# 3) Build & start production
npm run build && npm run start
```

## Project Structure

```
.
├── app
│   ├── about
│   │   └── page.js      # /about route
│   ├── globals.css      # global styles
│   ├── layout.js        # root layout with <Nav/>
│   └── page.js          # / route
├── components
│   └── Nav.js           # top navigation
├── public
├── .gitignore
├── next.config.mjs
├── package.json
└── README.md
```

## Notes
- Built with **Next.js App Router** (no pages/ directory).
- Uses a small client-side `<Nav />` to highlight the active route.
- No external UI libraries; easy to extend with Tailwind/Material UI if needed.
