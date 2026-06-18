<script setup>
import { ref, reactive } from 'vue'

// ── 预置选项 ──────────────────────────────────────────
const UNITS = Array.from({ length: 12 }, (_, i) => `Unit ${i + 1}`)
const PARTS = ['Part 1', 'Part 2', 'Part 3', 'Part 4']

// ── 视图模式：'add' | 'manage' ────────────────────────
const mode = ref('add')

// ── 新增/编辑表单状态 ─────────────────────────────────
const unitTitle     = ref('Unit 1')
const partTitle     = ref('Part 1')
const exerciseTitle = ref('')
const files  = ref({ question: null, answer: null, audio: null, script: null })
const urls   = ref({ question: '', answer: '', audio: '', script: '' })
const dragging = ref(null)

// 编辑模式标记
const editingKey = reactive({ unit: null, part: null, index: null })  // null = 新增

// ── 管理视图状态 ──────────────────────────────────────
const allData     = ref({ units: [] })
const loadingData = ref(false)
const expanded    = ref({})  // { 'Unit1-Part1': true }

async function loadAll() {
  loadingData.value = true
  try {
    const res = await fetch('/api/exercises')
    allData.value = await res.json()
  } finally {
    loadingData.value = false
  }
}

function toggleExpand(key) {
  expanded.value[key] = !expanded.value[key]
}

function switchMode(m) {
  mode.value = m
  if (m === 'manage') loadAll()
}

// ── 进入编辑某条练习 ──────────────────────────────────
function startEdit(unit, part, index, exercise) {
  unitTitle.value     = unit
  partTitle.value     = part
  exerciseTitle.value = exercise.title ?? ''
  files.value  = { question: null, answer: null, audio: null, script: null }
  urls.value   = {
    question: exercise.questionImg ?? '',
    answer:   exercise.answerImg   ?? '',
    audio:    exercise.audioSrc    ?? '',
    script:   exercise.scriptImg   ?? '',
  }
  editingKey.unit  = unit
  editingKey.part  = part
  editingKey.index = index
  mode.value = 'add'
}

function cancelEdit() {
  editingKey.unit = editingKey.part = editingKey.index = null
  exerciseTitle.value = ''
  files.value = { question: null, answer: null, audio: null, script: null }
  urls.value  = { question: '', answer: '', audio: '', script: '' }
}

// ── 删除练习 ──────────────────────────────────────────
async function deleteExercise(unit, part, index, title) {
  if (!confirm(`确认删除「${title}」？`)) return
  const res = await fetch('/api/exercise', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unit, part, exerciseIndex: index }),
  })
  if (res.ok) loadAll()
  else alert('删除失败')
}

// ── 上传文件到 R2 ─────────────────────────────────────
const isUploading = ref(false)
const isSaving    = ref(false)
const message     = ref('')
const messageOk   = ref(true)

function onFileChange(e, key) { files.value[key] = e.target.files[0] ?? null }
function onDrop(e, key) {
  dragging.value = null
  const file = e.dataTransfer?.files[0]
  if (file) files.value[key] = file
}

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

// ── 保存/更新到 KV ────────────────────────────────────
async function handleSave() {
  if (!exerciseTitle.value) return setMsg('请填写 Exercise 标题', false)
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
    const isEdit = editingKey.index !== null
    const res = await fetch('/api/exercise', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit
        ? { unit: editingKey.unit, part: editingKey.part, exerciseIndex: editingKey.index, exercise }
        : { unit: unitTitle.value, part: partTitle.value, exercise }
      ),
    })
    if (!res.ok) throw new Error('保存失败')
    setMsg(isEdit ? '更新成功' : `已发布：${unitTitle.value} › ${partTitle.value} › ${exerciseTitle.value}`, true)
    cancelEdit()
  } catch (e) {
    setMsg(e.message, false)
  } finally {
    isSaving.value = false
  }
}

function setMsg(text, ok) { message.value = text; messageOk.value = ok }
</script>

<template>
  <div class="max-w-xl mx-auto p-6 space-y-5">
    <!-- 顶栏 -->
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">后台配置</h1>
      <a href="#/" class="text-sm text-indigo-400 hover:underline">返回前台</a>
    </div>

    <!-- Tab 切换 -->
    <div class="flex rounded-lg bg-gray-800 p-1 gap-1">
      <button
        v-for="tab in [{ key: 'add', label: '新增内容' }, { key: 'manage', label: '管理内容' }]"
        :key="tab.key"
        class="flex-1 py-1.5 rounded text-sm transition-colors"
        :class="mode === tab.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'"
        @click="switchMode(tab.key)"
      >{{ tab.label }}</button>
    </div>

    <!-- ══ 新增/编辑 ══ -->
    <template v-if="mode === 'add'">
      <!-- 编辑模式提示 -->
      <div v-if="editingKey.index !== null"
           class="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2 text-sm">
        <span class="text-yellow-300">编辑模式：{{ editingKey.unit }} › {{ editingKey.part }}</span>
        <button class="text-gray-400 hover:text-white" @click="cancelEdit">取消</button>
      </div>

      <!-- Unit / Part 选择 -->
      <div class="flex gap-3">
        <select v-model="unitTitle" :disabled="editingKey.index !== null"
          class="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50">
          <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
        </select>
        <select v-model="partTitle" :disabled="editingKey.index !== null"
          class="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50">
          <option v-for="p in PARTS" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>

      <!-- Exercise 标题 -->
      <input v-model="exerciseTitle" placeholder="Exercise 标题（如 Exercise 1 — Questions 1-10）"
        class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />

      <!-- 文件 Drop Zone -->
      <div class="space-y-3">
        <template v-for="row in [
          { key: 'question', label: '题目图片（必填）',     accept: 'image/*' },
          { key: 'answer',   label: '答案图片（必填）',     accept: 'image/*' },
          { key: 'audio',    label: '音频文件（可选）',     accept: 'audio/*' },
          { key: 'script',   label: '听力原文图片（可选）', accept: 'image/*' },
        ]" :key="row.key">
          <label
            class="relative flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition-colors"
            :class="dragging === row.key
              ? 'border-indigo-400 bg-indigo-500/10'
              : urls[row.key]
                ? 'border-green-600 bg-green-500/5'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'"
            @dragover.prevent="dragging = row.key"
            @dragleave="dragging = null"
            @drop.prevent="onDrop($event, row.key)"
          >
            <span class="text-xl shrink-0">
              {{ urls[row.key] ? '✅' : dragging === row.key ? '📂' : '📎' }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-300">{{ row.label }}</p>
              <p class="text-xs truncate mt-0.5"
                 :class="urls[row.key] ? 'text-green-400' : 'text-gray-500'">
                {{ files[row.key]?.name ?? (urls[row.key] ? '已上传（可重新拖入替换）' : '拖拽或点击选择文件') }}
              </p>
            </div>
            <input type="file" :accept="row.accept"
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
        {{ isSaving ? '保存中…' : editingKey.index !== null ? '② 保存修改' : '② 保存并发布' }}
      </button>

      <p v-if="message" class="text-sm text-center"
         :class="messageOk ? 'text-green-400' : 'text-red-400'">{{ message }}</p>
    </template>

    <!-- ══ 管理内容 ══ -->
    <template v-else>
      <div v-if="loadingData" class="text-center text-gray-500 py-10">加载中…</div>
      <div v-else-if="!allData.units.length" class="text-center text-gray-500 py-10">暂无内容</div>

      <div v-else class="space-y-3">
        <div v-for="unit in allData.units" :key="unit.title">
          <div v-for="part in unit.parts" :key="part.title" class="rounded-lg overflow-hidden border border-gray-700">
            <!-- Part 折叠头 -->
            <button
              class="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
              @click="toggleExpand(unit.title + part.title)"
            >
              <span>{{ unit.title }} › {{ part.title }}</span>
              <span class="flex items-center gap-2 text-gray-400">
                <span class="text-xs">{{ part.exercises.length }} 条</span>
                <span>{{ expanded[unit.title + part.title] ? '▲' : '▼' }}</span>
              </span>
            </button>

            <!-- Exercise 列表 -->
            <div v-if="expanded[unit.title + part.title]" class="divide-y divide-gray-700/50">
              <div v-for="(ex, idx) in part.exercises" :key="idx"
                   class="flex items-center justify-between px-4 py-3 bg-gray-900 text-sm">
                <div class="min-w-0 flex-1">
                  <p class="text-gray-200 truncate">{{ ex.title || '（无标题）' }}</p>
                  <p class="text-xs text-gray-500 mt-0.5 flex gap-2">
                    <span>题目 ✓</span>
                    <span>答案 ✓</span>
                    <span v-if="ex.audioSrc">音频 ✓</span>
                    <span v-if="ex.scriptImg">原文 ✓</span>
                  </p>
                </div>
                <div class="flex gap-2 ml-3 shrink-0">
                  <button
                    class="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 transition-colors"
                    @click="startEdit(unit.title, part.title, idx, ex)"
                  >编辑</button>
                  <button
                    class="px-2 py-1 rounded text-xs bg-red-900/50 hover:bg-red-700 transition-colors text-red-300"
                    @click="deleteExercise(unit.title, part.title, idx, ex.title)"
                  >删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
