<script setup>
import { ref } from 'vue'

// ── 表单状态 ──────────────────────────────────────────
const unitTitle      = ref('')
const partTitle      = ref('')
const exerciseTitle  = ref('')

const files = ref({ question: null, answer: null, audio: null, script: null })
const urls  = ref({ question: '', answer: '', audio: '', script: '' })

const isUploading = ref(false)
const isSaving    = ref(false)
const message     = ref('')
const messageOk   = ref(true)

function onFileChange(e, key) {
  files.value[key] = e.target.files[0] ?? null
}

// ── 上传单个文件到 R2 ─────────────────────────────────
async function uploadFile(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`上传失败：${file.name}`)
  return (await res.json()).url
}

async function handleUploadAll() {
  isUploading.value = true
  message.value = ''
  try {
    if (files.value.question) urls.value.question = await uploadFile(files.value.question)
    if (files.value.answer)   urls.value.answer   = await uploadFile(files.value.answer)
    if (files.value.audio)    urls.value.audio    = await uploadFile(files.value.audio)
    if (files.value.script)   urls.value.script   = await uploadFile(files.value.script)
    setMsg('文件上传成功', true)
  } catch (e) {
    setMsg(e.message, false)
  } finally {
    isUploading.value = false
  }
}

// ── 保存到 KV ─────────────────────────────────────────
async function handleSave() {
  if (!unitTitle.value || !partTitle.value || !exerciseTitle.value) return setMsg('请填写 Unit、Part 和 Exercise 标题', false)
  if (!urls.value.question || !urls.value.answer) return setMsg('请先上传题目和答案图片', false)

  isSaving.value = true
  message.value = ''
  try {
    const exercise = {
      title:       exerciseTitle.value,
      questionImg: urls.value.question,
      answerImg:   urls.value.answer,
      ...(urls.value.audio  && { audioSrc:  urls.value.audio }),
      ...(urls.value.script && { scriptImg: urls.value.script }),
    }
    const res = await fetch('/api/exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit: unitTitle.value, part: partTitle.value, exercise }),
    })
    if (!res.ok) throw new Error('保存失败')
    setMsg('保存并发布成功', true)
    exerciseTitle.value = ''
    files.value = { question: null, answer: null, audio: null, script: null }
    urls.value  = { question: '', answer: '', audio: '', script: '' }
  } catch (e) {
    setMsg(e.message, false)
  } finally {
    isSaving.value = false
  }
}

function setMsg(text, ok) {
  message.value = text
  messageOk.value = ok
}
</script>

<template>
  <div class="max-w-xl mx-auto p-6 space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">后台配置</h1>
      <a href="#/" class="text-sm text-indigo-400 hover:underline">返回前台</a>
    </div>

    <!-- Unit / Part -->
    <div class="space-y-3">
      <input
        v-model="unitTitle"
        placeholder="Unit 标题（如 Unit 1）"
        class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
      />
      <input
        v-model="partTitle"
        placeholder="Part 标题（如 Part 1）"
        class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
      />
      <input
        v-model="exerciseTitle"
        placeholder="Exercise 标题（如 Exercise 1 — Questions 1-10）"
        class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
      />
    </div>

    <!-- 文件选择 -->
    <div class="space-y-4 bg-gray-800/50 rounded-lg p-4">
      <template v-for="row in [
        { key: 'question', label: '题目图片（必填）', accept: 'image/*' },
        { key: 'answer',   label: '答案图片（必填）', accept: 'image/*' },
        { key: 'audio',    label: '音频文件（可选）',  accept: 'audio/*' },
        { key: 'script',   label: '听力原文图片（可选）', accept: 'image/*' },
      ]" :key="row.key">
        <label class="block text-sm">
          <span class="text-gray-400">{{ row.label }}</span>
          <span v-if="urls[row.key]" class="ml-2 text-xs text-green-400">✓ 已上传</span>
          <input
            type="file"
            :accept="row.accept"
            class="mt-1 block w-full text-xs text-gray-400
              file:mr-3 file:py-1 file:px-2 file:rounded file:border-0
              file:text-xs file:bg-gray-700 file:text-gray-200 file:cursor-pointer"
            @change="onFileChange($event, row.key)"
          />
        </label>
      </template>
    </div>

    <button
      class="w-full bg-gray-700 hover:bg-gray-600 rounded py-2 text-sm disabled:opacity-40 transition-colors"
      :disabled="isUploading"
      @click="handleUploadAll"
    >{{ isUploading ? '上传中…' : '① 上传文件到 R2' }}</button>

    <button
      class="w-full bg-indigo-600 hover:bg-indigo-500 rounded py-2 text-sm disabled:opacity-40 transition-colors"
      :disabled="isSaving"
      @click="handleSave"
    >{{ isSaving ? '保存中…' : '② 保存并发布' }}</button>

    <p
      v-if="message"
      class="text-sm text-center"
      :class="messageOk ? 'text-green-400' : 'text-red-400'"
    >{{ message }}</p>
  </div>
</template>
