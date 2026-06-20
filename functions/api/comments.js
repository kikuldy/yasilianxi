// GET  /api/comments?unit=X&part=Y&exerciseIndex=Z
// POST /api/comments { unit, part, exerciseIndex, text }

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const unit          = url.searchParams.get('unit')
  const part          = url.searchParams.get('part')
  const exerciseIndex = url.searchParams.get('exerciseIndex')
  if (!unit || !part || exerciseIndex == null) return json({ error: '缺少参数' }, 400)

  const raw = await env.KV.get(kvKey(unit, part, exerciseIndex))
  return json(raw ? JSON.parse(raw) : [])
}

export async function onRequestPost({ request, env }) {
  const { unit, part, exerciseIndex, text } = await request.json()
  if (!unit || !part || exerciseIndex == null || !text?.trim()) {
    return json({ error: '缺少必要字段' }, 400)
  }

  const key  = kvKey(unit, part, exerciseIndex)
  const raw  = await env.KV.get(key)
  const list = raw ? JSON.parse(raw) : []

  const comment = {
    id:        Date.now().toString(36) + Math.random().toString(36).slice(2),
    text:      text.trim(),
    timestamp: new Date().toISOString(),
  }
  list.push(comment)
  await env.KV.put(key, JSON.stringify(list))
  return json(comment)
}

function kvKey(unit, part, exerciseIndex) {
  return `comments:${unit}:${part}:${exerciseIndex}`
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
