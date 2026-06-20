// POST /api/batch-import — 批量写入多条练习（一次 KV 读写）
export async function onRequestPost({ request, env }) {
  const { exercises } = await request.json()

  if (!Array.isArray(exercises) || !exercises.length) {
    return json({ error: '没有练习数据' }, 400)
  }

  const data = await readData(env)

  for (const { unit, part, exercise } of exercises) {
    if (!unit || !part || !exercise?.questionImg?.length || !exercise?.answerImg?.length) continue
    getOrCreatePart(data, unit, part).exercises.push(exercise)
  }

  await env.KV.put('data', JSON.stringify(data))
  return json({ ok: true, count: exercises.length })
}

async function readData(env) {
  const raw = await env.KV.get('data')
  return raw ? JSON.parse(raw) : { units: [] }
}

function getOrCreatePart(data, unit, part) {
  let unitObj = data.units.find(u => u.title === unit)
  if (!unitObj) { unitObj = { title: unit, parts: [] }; data.units.push(unitObj) }
  let partObj = unitObj.parts.find(p => p.title === part)
  if (!partObj) { partObj = { title: part, exercises: [] }; unitObj.parts.push(partObj) }
  return partObj
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
