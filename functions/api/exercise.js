// POST   /api/exercise — 新增练习
// PUT    /api/exercise — 更新练习（按 unit/part/exerciseIndex）
// DELETE /api/exercise — 删除练习（按 unit/part/exerciseIndex）

export async function onRequestPost({ request, env }) {
  const { unit, part, exercise } = await request.json()
  if (!unit || !part || !exercise?.questionImg || !exercise?.answerImg) {
    return json({ error: '缺少必要字段（unit / part / questionImg / answerImg）' }, 400)
  }
  const data = await readData(env)
  getOrCreatePart(data, unit, part).exercises.push(exercise)
  await env.KV.put('data', JSON.stringify(data))
  return json({ ok: true })
}

export async function onRequestPut({ request, env }) {
  const { unit, part, exerciseIndex, exercise } = await request.json()
  if (!unit || !part || exerciseIndex == null || !exercise?.questionImg || !exercise?.answerImg) {
    return json({ error: '缺少必要字段' }, 400)
  }
  const data = await readData(env)
  const partObj = getPart(data, unit, part)
  if (!partObj || !partObj.exercises[exerciseIndex]) return json({ error: '未找到目标练习' }, 404)
  partObj.exercises[exerciseIndex] = exercise
  await env.KV.put('data', JSON.stringify(data))
  return json({ ok: true })
}

export async function onRequestDelete({ request, env }) {
  const { unit, part, exerciseIndex } = await request.json()
  const data = await readData(env)
  const partObj = getPart(data, unit, part)
  if (!partObj || !partObj.exercises[exerciseIndex]) return json({ error: '未找到目标练习' }, 404)

  const ex = partObj.exercises[exerciseIndex]
  partObj.exercises.splice(exerciseIndex, 1)
  await env.KV.put('data', JSON.stringify(data))

  // 同步删除 R2 文件（失败不阻断主流程）
  const r2Keys = [
    ...toArray(ex.questionImg),
    ...toArray(ex.answerImg),
    ...toArray(ex.scriptImg),
    ...(ex.audioSrc ? [ex.audioSrc] : []),
  ].map(urlToKey).filter(Boolean)

  await Promise.allSettled(r2Keys.map(key => env.R2.delete(key)))

  return json({ ok: true })
}

// ── 工具函数 ──────────────────────────────────────────
const R2_PUBLIC_URL = 'https://pub-c831ae0203194c9e8699d248a844023c.r2.dev/'

function toArray(v) { if (!v) return []; return Array.isArray(v) ? v : [v] }
function urlToKey(url) { return typeof url === 'string' ? url.replace(R2_PUBLIC_URL, '') : null }
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

function getPart(data, unit, part) {
  return data.units.find(u => u.title === unit)?.parts.find(p => p.title === part)
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
