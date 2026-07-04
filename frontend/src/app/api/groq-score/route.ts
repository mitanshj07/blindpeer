import { NextResponse } from 'next/server'

type GroqScore = {
  score: number
  rationale: string
  source: 'groq' | 'fallback'
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

function fallbackScore(title: string, abstract: string): GroqScore {
  const text = `${title} ${abstract}`.toLowerCase()
  const words = text.split(/\s+/).filter(Boolean)
  const signals = ['fhe', 'encrypted', 'privacy', 'zero knowledge', 'threshold', 'homomorphic', 'protocol', 'evaluation']
  const keywordHits = signals.filter((signal) => text.includes(signal)).length
  const lengthScore = Math.min(3, Math.floor(words.length / 45))
  const score = Math.max(4, Math.min(9, 5 + keywordHits + lengthScore))

  return {
    score,
    rationale:
      keywordHits > 0
        ? 'Fallback heuristic found strong privacy, protocol, or evaluation signals.'
        : 'Fallback heuristic used abstract length and specificity because Groq was unavailable.',
    source: 'fallback',
  }
}

function coerceScore(value: unknown) {
  const score = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(score)) return 6
  return Math.max(1, Math.min(10, Math.round(score)))
}

async function scoreWithGroq(title: string, abstract: string, signal: AbortSignal): Promise<GroqScore> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Score research submissions for novelty and rigor. Return strict JSON with score, a number from 1 to 10, and rationale, one short sentence.',
        },
        {
          role: 'user',
          content: JSON.stringify({ title, abstract }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq returned ${response.status}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  const parsed = JSON.parse(typeof content === 'string' ? content : '{}') as Partial<GroqScore>

  return {
    score: coerceScore(parsed.score),
    rationale:
      typeof parsed.rationale === 'string' && parsed.rationale.trim()
        ? parsed.rationale.trim().slice(0, 180)
        : 'Groq returned a concise quality pre-signal for reviewers.',
    source: 'groq',
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { title?: unknown; abstract?: unknown } | null
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const abstract = typeof body?.abstract === 'string' ? body.abstract.trim() : ''

  if (!title || !abstract) {
    return NextResponse.json({ error: 'title and abstract are required' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)

  try {
    const result = await scoreWithGroq(title, abstract, controller.signal)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(fallbackScore(title, abstract))
  } finally {
    clearTimeout(timeout)
  }
}
