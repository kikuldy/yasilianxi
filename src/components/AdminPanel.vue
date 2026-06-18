<script setup>
import { ref } from 'vue'

// ── 表单状态 ──────────────────────────────────────────
const unitTitle = ref('')
const partTitle = ref('')
const questionFile = ref(null)
const answerFile = ref(null)
const audioFile = ref(null)
const scriptFile = ref(null)

const questionImgUrl = ref('')
const answerImgUrl = ref('')
const audioSrcUrl = ref('')
const scriptImgUrl = ref('')

const isUploading = ref(false)
const isSaving = ref(false)
const message = ref('')

// ── 上传文件到 R2 ─────────────────────────────────────
async function uploadFile(file) {
  // TODO: 替换为实际的 Cloudflare Worker 上传端点
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('上传失败')
  const data = await res.json()
  return data.url
}

async function handleUploadAll() {
  isUploading.value = true
  message.value = ''
  try {
    if (questionFile.value) questionImgUrl.value = await uploadFile(questionFile.value)
    if (answerFile.value) answerImgUrl.value = await uploadFile(answerFile.value)
    if (audioFile.value) audioSrcUrl.value = await uploadFile(audioFile.value)
    if (scriptFile.value) scriptImgUrl.value = await uploadFile(scriptFile.value)
    message.value = '上传成功'
  } catch (e) {
    message.value = e.message
  } finally {
    isUploading.value = false
  }
}

// ── 保存到 KV ─────────────────────────────────────────
async function handleSave() {
  if (!unitTitle.value || !partTitle.value || !questionImgUrl.value || !answerImgUrl.value) {
    message.value = '请先填写 Unit/Part 标题并上传题目和答案图片'
    return
  }
  isSaving.value = true
  message.value = ''
  try {
    const exercise = {
      questionImg: questionImgUrl.value,
      answerImg: answerImgUrl.value,
      ...(audioSrcUrl.value && { audioSrc: audioSrcUrl.value }),
      ...(scriptImgUrl.value && { scriptImg: scriptImgUrl.value }),
    }
    // TODO: 替换为实际的 Cloudflare Worker KV 写入端点
    const res = await fetch('/api/exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit: unitTitle.value, part: partTitle.value, exercise }),
    })
    if (!res.ok) throw new Error('保存失败')
    message.value = '保存并发布成功'
  } catch (e) {
    message.value = e.message
  } finally {
    isSaving.value = false
  }
}

function onFileChange(e, target) {
  target.value = e.target.files[0] ?? null
}
</script>

<template>
  <div class="max-w-xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">后台配置</h1>
      <a href="#/" class="text-sm text-indigo-400 underline">返回前台</a>
    </div>

    <!-- Unit / Part -->
    <div class="space-y-3">
      <input
        v-model="unitTitle"
        placeholder="Unit 标题（如 Unit 1）"
        class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
      />
      <input
        v-model="partTitle"
        placeholder="Part 标题（如 Part 1）"
        class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
      />
    </div>

    <!-- 文件上传 -->
    <div class="space-y-3">
      <label class="block text-sm text-gray-400">
        题目图片（必填）
        <input type="file" accept="image/*" class="mt-1 block text-sm" @change="e => onFileChange(e, questionFile)" />
      </label>
      <label class="block text-sm text-gray-400">
        答案图片（必填）
        <input type="file" accept="image/*" class="mt-1 block text-sm" @change="e => onFileChange(e, answerFile)" />
      </label>
      <label class="block text-sm text-gray-400">
        音频文件（可选）
        <input type="file" accept="audio/*" class="mt-1 block text-sm" @change="e => onFileChange(e, audioFile)" />
      </label>
      <label class="block text-sm text-gray-400">
        听力原文图片（可选）
        <input type="file" accept="image/*" class="mt-1 block text-sm" @change="e => onFileChange(e, scriptFile)" />
      </label>
    </div>

    <button
      class="w-full bg-gray-700 hover:bg-gray-600 rounded py-2 text-sm disabled:opacity-50"
      :disabled="isUploading"
      @click="handleUploadAll"
    >
      {{ isUploading ? '上传中...' : '上传文件到 R2' }}
    </button>

    <button
      class="w-full bg-indigo-600 hover:bg-indigo-500 rounded py-2 text-sm disabled:opacity-50"
      :disabled="isSaving"
      @click="handleSave"
    >
      {{ isSaving ? '保存中...' : '保存并发布' }}
    </button>

    <p v-if="message" class="text-sm text-center" :class="message.includes('成功') ? 'text-green-400' : 'text-red-400'">
      {{ message }}
    </p>
  </div>
</template>
