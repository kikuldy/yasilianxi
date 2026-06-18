<script setup>
import { ref, reactive, onMounted } from 'vue'

// ── 预置选项 ──────────────────────────────────────────
const UNITS = Array.from({ length: 12 }, (_, i) => `Unit ${i + 1}`)
const PARTS = ['Part 1', 'Part 2', 'Part 3', 'Part 4']

// ── 内容树数据 ────────────────────────────────────────
const allData     = ref({ units: [] })
const loadingData = ref(false)
const expanded    = ref({})

async function loadAll() {
  loadingData.value = true
  try {
    const res = await fetch('/api/exercises')
    allData.value = await res.json()
  } finally {
    loadingData.value = false
  }
}
onMounted(loadAll)

function toggleExpand(k) { expanded.value[k] = !expanded.value[k] }
function toArray(v) { if (!v) return []; return Array.isArray(v) ? v : [v] }

// ── 表单状态 ──────────────────────────────────────────
const unitTitle     = ref('Unit 1')
const partTitle     = ref('Part 1')
const exerciseTitle = ref('')
const dragging      = ref(null)
const files = ref({ question: [], answer: [], audio: null, script: [] })
const urls  = ref({ question: [], answer: [], audio: '',   script: [] })

const editingKey = reactive({ unit: null, part: null, index: null })
const isEditing  = ref(false)   // false = 新增，true = 编辑

function startNew() {
  isEditing.value       = false
  editingKey.unit = editingKey.part = editingKey.index = null
  exerciseTitle.value   = ''
  files.value = { question: [], answer: [], audio: null, script: [] }
  urls.value  = { question: [], answer: [], audio: '',   script: [] }
}

function startEdit(unit, part, index, ex) {
  isEditing.value     = true
  unitTitle.value     = unit
  partTitle.value     = part
  exerciseTitle.value = ex.title ?? ''
  files.value = { question: [], answer: [], audio: null, script: [] }
  urls.value  = {
    question: toArray(ex.questionImg),
    answer:   toArray(ex.answerImg),
    audio:    ex.audioSrc  ?? '',
    script:   toArray(ex.scriptImg),
  }
  editingKey.unit  = unit
  editingKey.part  = part
  editingKey.index = index
}

// ── 删除 ──────────────────────────────────────────────
async function deleteExercise(unit, part, index, title) {
  if (!confirm(`确认删除「${title}」？`)) return
  const res = await fetch('/api/exercise', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unit, part, exerciseIndex: index }),
  })
  if (res.ok) { loadAll(); if (editingKey.index === index) startNew() }
  else alert('删除失败')
}

// ── 文件选择 ──────────────────────────────────────────
function onFileChange(e, key) {
  const picked = Array.from(e.target.files)
  if (key === 'audio') files.value.audio = picked[0] ?? null
  else files.value[key] = picked
}
function onDrop(e, key) {
  dragging.value = null
  const dropped = Array.from(e.dataTransfer?.files ?? [])
  if (!dropped.length) return
  if (key === 'audio') files.value.audio = dropped[0]
  else files.value[key] = dropped
}

// ── 上传 ──────────────────────────────────────────────
const isUploading = ref(false)
const isSaving    = ref(false)
const message     = ref('')
const messageOk   = ref(true)

async function uploadFile(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`上传失败：${file.name}`)
  return (await res.json()).url
}

async function handleUploadAll() {
  isUploading.value = true; message.value = ''
  try {
    for (const key of ['question', 'answer', 'script']) {
      if (files.value[key].length) {
        urls.value[key] = await Promise.all(files.value[key].map(uploadFile))
        files.value[key] = []
      }
    }
    if (files.value.audio) {
      urls.value.audio = await uploadFile(files.value.audio)
      files.value.audio = null
    }
    setMsg('文件上传成功', true)
  } catch (e) { setMsg(e.message, false) }
  finally { isUploading.value = false }
}

// ── 保存 ──────────────────────────────────────────────
async function handleSave() {
  if (!exerciseTitle.value) return setMsg('请填写 Exercise 标题', false)
  if (!urls.value.question.length || !urls.value.answer.length)
    return setMsg('请先上传题目和答案图片', false)

  isSaving.value = true; message.value = ''
  try {
    const exercise = {
      title:       exerciseTitle.value,
      questionImg: urls.value.question,
      answerImg:   urls.value.answer,
      ...(urls.value.audio         && { audioSrc:  urls.value.audio }),
      ...(urls.value.script.length && { scriptImg: urls.value.script }),
    }
    const res = await fetch('/api/exercise', {
      method: isEditing.value ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEditing.value
        ? { unit: editingKey.unit, part: editingKey.part, exerciseIndex: editingKey.index, exercise }
        : { unit: unitTitle.value, part: partTitle.value, exercise }),
    })
    if (!res.ok) throw new Error('保存失败')
    setMsg(isEditing.value ? '更新成功' : `已发布：${unitTitle.value} › ${partTitle.value} › ${exerciseTitle.value}`, true)
    loadAll()
    if (!isEditing.value) {
      exerciseTitle.value = ''
      files.value = { question: [], answer: [], audio: null, script: [] }
      urls.value  = { question: [], answer: [], audio: '',   script: [] }
    }
  } catch (e) { setMsg(e.message, false) }
  finally { isSaving.value = false }
}

function setMsg(t, ok) { message.value = t; messageOk.value = ok }

// ── Drop zone 辅助 ────────────────────────────────────
function dropHint(key) {
  const pending  = key === 'audio' ? (files.value.audio ? 1 : 0) : files.value[key].length
  const uploaded = key === 'audio' ? (urls.value.audio ? 1 : 0)  : urls.value[key].length
  if (pending)  return key === 'audio' ? '已选文件（待上传）' : `已选 ${pending} 个（待上传）`
  if (uploaded) return key === 'audio' ? '已上传（可拖入替换）' : `已上传 ${uploaded} 张（可拖入替换）`
  return key === 'audio' ? '拖拽或点击选择文件' : '拖拽或点击选择（可多选）'
}
function dropIcon(key) {
  const pending  = key === 'audio' ? !!files.value.audio : files.value[key].length > 0
  const uploaded = key === 'audio' ? !!urls.value.audio  : urls.value[key].length  > 0
  if (dragging.value === key) return '📂'
  if (pending)  return '🔄'
  if (uploaded) return '✅'
  return '📎'
}
function dropBorder(key) {
  const pending  = key === 'audio' ? !!files.value.audio : files.value[key].length > 0
  const uploaded = key === 'audio' ? !!urls.value.audio  : urls.value[key].length  > 0
  if (dragging.value === key) return 'border-indigo-400 bg-indigo-500/10'
  if (pending)  return 'border-yellow-500 bg-yellow-500/5'
  if (uploaded) return 'border-green-600 bg-green-500/5'
  return 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
}
function dropTextColor(key) {
  const pending  = key === 'audio' ? !!files.value.audio : files.value[key].length > 0
  const uploaded = key === 'audio' ? !!urls.value.audio  : urls.value[key].length  > 0
  if (pending)  return 'text-yellow-400'
  if (uploaded) return 'text-green-400'
  return 'text-gray-500'
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">

    <!-- ── 左侧：内容树 ── -->
    <aside class="w-72 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-700 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
        <span class="text-sm font-medium text-gray-200">已有内容</span>
        <button
          class="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          @click="startNew">+ 新增</button>
      </div>

      <div class="overflow-y-auto flex-1 py-2">
        <div v-if="loadingData" class="px-4 py-6 text-xs text-gray-400">加载中…</div>
        <div v-else-if="!allData.units.length" class="px-4 py-6 text-xs text-gray-400">暂无内容</div>

        <div v-for="unit in allData.units" :key="unit.title">
          <div v-for="part in unit.parts" :key="part.title" class="mb-1">
            <!-- Part 折叠头 -->
            <button
              class="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              @click="toggleExpand(unit.title + part.title)"
            >
              <span>{{ unit.title }} › {{ part.title }}</span>
              <span class="flex items-center gap-1.5 text-gray-500">
                <span>{{ part.exercises.length }}条</span>
                <span>{{ expanded[unit.title + part.title] ? '▲' : '▼' }}</span>
              </span>
            </button>

            <!-- Exercise 列表 -->
            <div v-if="expanded[unit.title + part.title]">
              <div
                v-for="(ex, idx) in part.exercises" :key="idx"
                class="flex items-center gap-2 pl-5 pr-3 py-1.5 border-l-2 transition-colors"
                :class="editingKey.unit === unit.title && editingKey.part === part.title && editingKey.index === idx
                  ? 'border-indigo-500 bg-indigo-600/20'
                  : 'border-transparent hover:bg-gray-800'"
              >
                <span class="flex-1 min-w-0 text-xs text-gray-300 truncate">{{ ex.title || '（无标题）' }}</span>
                <span class="text-xs text-gray-600 shrink-0">
                  {{ toArray(ex.questionImg).length }}+{{ toArray(ex.answerImg).length }}
                  <span v-if="ex.audioSrc"> 🔊</span>
                </span>
                <button class="text-xs text-indigo-400 hover:text-indigo-300 shrink-0"
                  @click="startEdit(unit.title, part.title, idx, ex)">编辑</button>
                <button class="text-xs text-red-500 hover:text-red-400 shrink-0"
                  @click="deleteExercise(unit.title, part.title, idx, ex.title)">删</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- ── 右侧：表单 ── -->
    <main class="flex-1 overflow-y-auto bg-gray-950">
      <div class="max-w-xl mx-auto p-6 space-y-5">
        <!-- 顶栏 -->
        <div class="flex items-center justify-between">
          <h1 class="text-lg font-semibold">
            {{ isEditing ? `编辑：${editingKey.unit} › ${editingKey.part}` : '新增内容' }}
          </h1>
          <a href="#/" class="text-sm text-indigo-400 hover:underline">返回前台</a>
        </div>

        <!-- 编辑模式提示 -->
        <div v-if="isEditing"
             class="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2 text-sm">
          <span class="text-yellow-300">编辑模式</span>
          <button class="text-gray-400 hover:text-white text-xs" @click="startNew">取消，切换为新增</button>
        </div>

        <!-- Unit / Part -->
        <div class="flex gap-3">
          <select v-model="unitTitle" :disabled="isEditing"
            class="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50">
            <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
          </select>
          <select v-model="partTitle" :disabled="isEditing"
            class="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50">
            <option v-for="p in PARTS" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>

        <!-- Exercise 标题 -->
        <input v-model="exerciseTitle" placeholder="Exercise 标题（如 Exercise 1 — Questions 1-10）"
          class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />

        <!-- Drop Zones -->
        <div class="space-y-3">
          <template v-for="row in [
            { key: 'question', label: '题目图片（必填，可多张）',     accept: 'image/*', multi: true  },
            { key: 'answer',   label: '答案图片（必填，可多张）',     accept: 'image/*', multi: true  },
            { key: 'audio',    label: '音频文件（可选）',             accept: 'audio/*', multi: false },
            { key: 'script',   label: '听力原文图片（可选，可多张）', accept: 'image/*', multi: true  },
          ]" :key="row.key">
            <label
              class="relative flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition-colors"
              :class="dropBorder(row.key)"
              @dragover.prevent="dragging = row.key"
              @dragleave="dragging = null"
              @drop.prevent="onDrop($event, row.key)"
            >
              <span class="text-xl shrink-0">{{ dropIcon(row.key) }}</span>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-gray-300">{{ row.label }}</p>
                <p class="text-xs mt-0.5" :class="dropTextColor(row.key)">{{ dropHint(row.key) }}</p>
              </div>
              <input type="file" :accept="row.accept" :multiple="row.multi"
                class="absolute inset-0 opacity-0 cursor-pointer"
                @change="onFileChange($event, row.key)" />
            </label>
          </template>
        </div>

        <button class="w-full bg-gray-700 hover:bg-gray-600 rounded py-2 text-sm disabled:opacity-40 transition-colors"
          :disabled="isUploading" @click="handleUploadAll">
          {{ isUploading ? '上传中…' : '① 上传文件到 R2' }}
        </button>
        <button class="w-full bg-indigo-600 hover:bg-indigo-500 rounded py-2 text-sm disabled:opacity-40 transition-colors"
          :disabled="isSaving" @click="handleSave">
          {{ isSaving ? '保存中…' : isEditing ? '② 保存修改' : '② 保存并发布' }}
        </button>

        <p v-if="message" class="text-sm text-center"
           :class="messageOk ? 'text-green-400' : 'text-red-400'">{{ message }}</p>
      </div>
    </main>
  </div>
</template>
