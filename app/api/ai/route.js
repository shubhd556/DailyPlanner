export const runtime = 'edge' // fast cold starts on Vercel

// Keep responses focused on daily planning
const SYSTEM = `You are Planner Bot. Be brief and helpful.
Suggest priorities, timeboxing, and next actions for a day plan.
Answer in plain text. Avoid very long lists unless asked.`

export async function POST(req) {
    try {
        const { messages } = await req.json()
        if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'messages[] required' }), { status: 400 })
        }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), { status: 500 })
        }

        // Build Gemini "contents" history.
        // Gemini roles are 'user' or 'model' (assistant → model). No "system" role,
        // so we prepend the system style instruction as the first user message.
        const contents = [
            { role: 'user', parts: [{ text: SYSTEM }] },
            ...messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }))
        ]

        const model = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash'
        const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // You can optionally include generation settings via generationConfig if desired.
            body: JSON.stringify({ contents })
        })

        if (!res.ok) {
            const err = await res.text()
            return new Response(JSON.stringify({ error: `Gemini error: ${err}` }), { status: 500 })
        }

        const data = await res.json()
        const text =
            data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ??
            'Sorry, I could not generate a reply.'

        return Response.json({ text })
    } catch (err) {
        return new Response(JSON.stringify({ error: err?.message || 'Server error' }), { status: 500 })
    }
}