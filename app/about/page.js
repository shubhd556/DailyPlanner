
export const metadata = { title: 'About – Two Routes App' }

export default function AboutPage() {
  return (
    <section>
      <h1>About</h1>
      <p>
        This tiny Next.js demo has just two routes (<code>/</code> and <code>/about</code>).
        The home page is a <strong>Daily Task Planner</strong> with per-day lists, priority,
        time, tags, filters, reordering, and a fun confetti burst when tasks are completed.
      </p>
      <p>
        Data is stored locally in your browser (<code>localStorage</code>) so no backend is required.
        Feel free to extend it with API routes and a database.
      </p>
    </section>
  )
}