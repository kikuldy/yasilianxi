// POST /api/exercise — 新增一条练习，写入 KV
export async function onRequestPost({ request, env }) {
  const { unit, part, exercise } = await request.json()

  if (!unit || !part || !exercise?.questionImg || !exercise?.answerImg) {
    return json({ error: '缺少必要字段（unit / part / questionImg / answerImg）' }, 400)
  }

  const raw = await env.KV.get('data')
  const data = raw ? JSON.parse(raw) : { units: [] }

  let unitObj = data.units.find(u => u.title === unit)
  if (!unitObj) {
    unitObj = { title: unit, parts: [] }
    data.units.push(unitObj)
  }

  let partObj = unitObj.parts.find(p => p.title === part)
  if (!partObj) {
    partObj = { title: part, exercises: [] }
    unitObj.parts.push(partObj)
  }

  partObj.exercises.push(exercise)
  await env.KV.put('data', JSON.stringify(data))

  return json({ ok: true })
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
