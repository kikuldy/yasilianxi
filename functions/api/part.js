// DELETE /api/part — 删除整个 Part（含其下所有练习的 R2 文件）
export async function onRequestDelete({ request, env }) {
  const { unit, part } = await request.json()
  if (!unit || !part) return json({ error: '缺少 unit 或 part 参数' }, 400)

  const raw  = await env.KV.get('data')
  const data = raw ? JSON.parse(raw) : { units: [] }

  const unitObj = data.units.find(u => u.title === unit)
  if (!unitObj) return json({ error: '未找到 Unit' }, 404)

  const partIndex = unitObj.parts.findIndex(p => p.title === part)
  if (partIndex === -1) return json({ error: '未找到 Part' }, 404)

  // 收集该 Part 下所有 R2 文件 key
  const r2Keys = []
  for (const ex of unitObj.parts[partIndex].exercises ?? []) {
    r2Keys.push(...toArray(ex.questionImg), ...toArray(ex.answerImg), ...toArray(ex.scriptImg))
    if (ex.audioSrc) r2Keys.push(ex.audioSrc)
  }

  // 删除 Part，Unit 空了则一并删除
  unitObj.parts.splice(partIndex, 1)
  if (!unitObj.parts.length) {
    data.units.splice(data.units.indexOf(unitObj), 1)
  }

  await env.KV.put('data', JSON.stringify(data))
  await Promise.allSettled(r2Keys.map(urlToKey).filter(Boolean).map(k => env.R2.delete(k)))

  return json({ ok: true })
}

const R2_PUBLIC_URL = 'https://pub-c831ae0203194c9e8699d248a844023c.r2.dev/'
function toArray(v) { if (!v) return []; return Array.isArray(v) ? v : [v] }
function urlToKey(url) { return typeof url === 'string' ? url.replace(R2_PUBLIC_URL, '') : null }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
