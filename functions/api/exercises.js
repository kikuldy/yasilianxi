// GET /api/exercises — 读取全量数据供前台使用
export async function onRequestGet({ env }) {
  const raw = await env.KV.get('data')
  const data = raw ? JSON.parse(raw) : { units: [] }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
