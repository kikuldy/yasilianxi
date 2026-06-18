const R2_PUBLIC_URL = 'https://pub-c831ae0203194c9e8699d248a844023c.r2.dev'

export async function onRequestPost({ request, env }) {
  const formData = await request.formData()
  const file = formData.get('file')

  if (!file) {
    return json({ error: '未找到文件' }, 400)
  }

  const ext = file.name.split('.').pop()
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  await env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  return json({ url: `${R2_PUBLIC_URL}/${key}` })
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
