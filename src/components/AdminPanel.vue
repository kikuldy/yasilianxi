<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

// ── 预置选项 ──────────────────────────────────────────
const UNITS     = Array.from({ length: 12 }, (_, i) => `Unit ${i + 1}`)
const PARTS     = ['Part 1', 'Part 2', 'Part 3', 'Part 4']
const EXERCISES = Array.from({ length: 10 }, (_, i) => `Exercise ${i + 1}`)

// ── 内容树数据 ────────────────────────────────────────
const allData     = ref({ units: [] })
const loadingData = ref(false)

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

function toArray(v) { if (!v) return []; return Array.isArray(v) ? v : [v] }

// ── 已有描述候选 ──────────────────────────────────────
const unitDescOptions = computed(() => {
  const set = new Set()
  for (const u of allData.value.units ?? []) {
    const desc = u.title.split(' · ').slice(1).join(' · ')
    if (desc) set.add(desc)
  }
  return [...set]
})
const partDescOptions = computed(() => {
  const set = new Set()
  for (const u of allData.value.units ?? []) {
    for (const p of u.parts ?? []) {
      const desc = p.title.split(' · ').slice(1).join(' · ')
      if (desc) set.add(desc)
    }
  }
  return [...set]
})

// ── 标签页 ────────────────────────────────────────────
const activeTab = ref('single') // 'single' | 'batch'

// ── 单题表单状态 ──────────────────────────────────────
const unitNum = ref('Unit 1');  const unitDesc = ref('')
const partNum = ref('Part 1');  const partDesc = ref('')
const exNum   = ref('Exercise 1'); const exDesc = ref('')

const exerciseTitle = computed(() =>
  exDesc.value.trim() ? `${exNum.value} — ${exDesc.value.trim()}` : exNum.value
)

const dragging = ref(null)
const files = ref({ question: [], answer: [], audio: null, script: [] })
const urls  = ref({ question: [], answer: [], audio: '',   script: [] })

const editingKey = reactive({ unit: null, part: null, index: null })
const isEditing  = ref(false)

function startNew() {
  isEditing.value = false
  editingKey.unit = editingKey.part = editingKey.index = null
  unitDesc.value = partDesc.value = exDesc.value = ''
  exNum.value = 'Exercise 1'
  files.value = { question: [], answer: [], audio: null, script: [] }
  urls.value  = { question: [], answer: [], audio: '',   script: [] }
}

function startEdit(unit, part, index, ex) {
  isEditing.value = true
  activeTab.value = 'single'
  const [un, ...ud] = unit.split(' · ');  unitNum.value = un; unitDesc.value = ud.join(' · ')
  const [pn, ...pd] = part.split(' · ');  partNum.value = pn; partDesc.value = pd.join(' · ')
  const [en, ...ed] = (ex.title ?? '').split(' — ')
  exNum.value  = EXERCISES.includes(en) ? en : 'Exercise 1'
  exDesc.value = ed.join(' — ')
  files.value = { question: [], answer: [], audio: null, script: [] }
  urls.value  = {
    question: toArray(ex.questionImg),
    answer:   toArray(ex.answerImg),
    audio:    ex.audioSrc ?? '',
    script:   toArray(ex.scriptImg),
  }
  editingKey.unit  = unit
  editingKey.part  = part
  editingKey.index = index
}

// ── 删除 Part ─────────────────────────────────────────
async function deletePart(unit, part, count) {
  const msg = count > 0
    ? `确认删除「${unit} › ${part}」及其下 ${count} 条练习？R2 文件也会一并删除。`
    : `确认删除空分组「${unit} › ${part}」？`
  if (!confirm(msg)) return
  const res = await fetch('/api/part', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unit, part }),
  })
  if (res.ok) { loadAll(); startNew() }
  else alert('删除失败')
}

// ── 删除 Exercise ─────────────────────────────────────
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

// ── 文件选择 / 上传（单题） ───────────────────────────
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

async function handleSave() {
  if (!urls.value.question.length || !urls.value.answer.length)
    return setMsg('请先上传题目和答案图片', false)

  const fullUnit = unitDesc.value.trim() ? `${unitNum.value} · ${unitDesc.value.trim()}` : unitNum.value
  const fullPart = partDesc.value.trim() ? `${partNum.value} · ${partDesc.value.trim()}` : partNum.value

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
        : { unit: fullUnit, part: fullPart, exercise }),
    })
    if (!res.ok) throw new Error('保存失败')
    setMsg(isEditing.value ? '更新成功' : `已发布：${fullUnit} › ${fullPart} › ${exerciseTitle.value}`, true)
    loadAll()
    if (!isEditing.value) {
      exDesc.value = ''
      files.value = { question: [], answer: [], audio: null, script: [] }
      urls.value  = { question: [], answer: [], audio: '',   script: [] }
    }
  } catch (e) { setMsg(e.message, false) }
  finally { isSaving.value = false }
}

function setMsg(t, ok) { message.value = t; messageOk.value = ok }

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

// ── 批量导入 ──────────────────────────────────────────
const batchUnitNum   = ref(1)   // 1-12，用户先选的 Unit 编号
const batchUnitDesc  = ref('')
const batchPartDescs = ref({})  // { 'part-1': '描述', ... }

const batchParsed    = ref([])  // 从本地文件夹解析出的练习列表
const batchFolderName = ref('') // 已选文件夹名称（仅用于显示）

function switchToBatch() { activeTab.value = 'batch' }

function onBatchUnitNumChange() {
  // 改了 Unit 编号就清空已解析数据，需要重新选文件夹
  batchParsed.value    = []
  batchFolderName.value = ''
  batchUnitDesc.value  = ''
  batchPartDescs.value = {}
  batchStatus.value    = ''
}

// ── 解析本地 data 文件夹（webkitdirectory） ─────────────
function onBatchFolderPick(e) {
  const target = `unit${batchUnitNum.value}`
  const result = parseLocalDataFolder(Array.from(e.target.files), target)
  batchParsed.value     = result.exercises
  batchFolderName.value = e.target.files[0]?.webkitRelativePath.split('/')[0] ?? ''
  batchUnitDesc.value   = ''
  batchStatus.value     = ''
  // 初始化每个 part 的描述输入
  const descs = {}
  result.parts.forEach(p => { descs[p] = '' })
  batchPartDescs.value = descs
}

function parseLocalDataFolder(fileList, targetUnit) {
  const exerciseMap = {}
  const audioMap    = {}
  const scriptMap   = {}

  for (const file of fileList) {
    if (file.name.startsWith('.')) continue
    const segs = file.webkitRelativePath.split('/')
    if (segs.length < 3) continue
    const type = segs[1]  // segs[0] = 根文件夹名

    if (type === 'question' || type === 'answer') {
      if (segs.length < 6) continue
      const [, , unit, part, exFolder, filename] = segs
      if (unit !== targetUnit || !filename || filename.startsWith('.')) continue
      const key = `${part}/${exFolder}`
      if (!exerciseMap[key]) exerciseMap[key] = { part, exFolder, questionFiles: [], answerFiles: [], audioFile: null, scriptFiles: [] }
      if (type === 'question') exerciseMap[key].questionFiles.push(file)
      else                     exerciseMap[key].answerFiles.push(file)

    } else if (type === 'listening') {
      const filename = segs[2]
      if (!filename || filename.startsWith('.')) continue
      const m = filename.match(/^listening-(\d+)\.(mp3|m4a|wav|ogg)$/i)
      if (m) audioMap[m[1]] = file

    } else if (type === 'listening scrpit') {
      if (segs.length < 4) continue
      const audioNum = segs[2]; const filename = segs[3]
      if (!filename || filename.startsWith('.')) continue
      if (!scriptMap[audioNum]) scriptMap[audioNum] = []
      scriptMap[audioNum].push(file)
    }
  }

  const sortByIdx = arr => [...arr].sort((a, b) => {
    const na = parseInt(a.name.match(/-(\d+)\.\w+$/)?.[1] ?? 0)
    const nb = parseInt(b.name.match(/-(\d+)\.\w+$/)?.[1] ?? 0)
    return na - nb
  })

  for (const key in exerciseMap) {
    const ex = exerciseMap[key]
    ex.questionFiles = sortByIdx(ex.questionFiles)
    ex.answerFiles   = sortByIdx(ex.answerFiles)
    const m = ex.exFolder.match(/^(\d+)-T-(\d+)$/)
    if (m) {
      const n = m[2]
      if (audioMap[n])  ex.audioFile   = audioMap[n]
      if (scriptMap[n]) ex.scriptFiles = sortByIdx(scriptMap[n])
    }
  }

  const all   = Object.values(exerciseMap).sort((a, b) => {
    if (a.part !== b.part) return a.part.localeCompare(b.part)
    return parseInt(a.exFolder) - parseInt(b.exFolder)
  })
  const parts = [...new Set(all.map(e => e.part))].sort()
  return { exercises: all, parts }
}

const batchPartsInUnit = computed(() =>
  [...new Set(batchParsed.value.map(e => e.part))].sort()
)

function partFolderToLabel(f) { return f.replace(/^part-(\d+)$/, 'Part $1') }
function exFolderToTitle(f) {
  const m = f.match(/^(\d+)/)
  return m ? `Exercise ${parseInt(m[1])}` : f
}

const isBatchImporting = ref(false)
const batchProgress    = ref({ done: 0, total: 0 })
const batchStatus      = ref('')
const batchStatusOk    = ref(true)

async function startBatchImport() {
  const exercises = batchParsed.value
  if (!exercises.length) return

  isBatchImporting.value = true
  batchProgress.value    = { done: 0, total: exercises.length }
  batchStatus.value      = '准备中…'
  batchStatusOk.value    = true

  const results = []
  try {
    for (const ex of exercises) {
      batchStatus.value = `上传 ${partFolderToLabel(ex.part)} / ${exFolderToTitle(ex.exFolder)}（${batchProgress.value.done + 1}/${exercises.length}）`

      const questionUrls = await Promise.all(ex.questionFiles.map(uploadFile))
      const answerUrls   = await Promise.all(ex.answerFiles.map(uploadFile))
      let audioUrl   = ''
      let scriptUrls = []
      if (ex.audioFile)          audioUrl   = await uploadFile(ex.audioFile)
      if (ex.scriptFiles.length) scriptUrls = await Promise.all(ex.scriptFiles.map(uploadFile))

      const unitLabel = `Unit ${batchUnitNum.value}`
      const unitTitle = batchUnitDesc.value.trim() ? `${unitLabel} · ${batchUnitDesc.value.trim()}` : unitLabel
      const partLabel = partFolderToLabel(ex.part)
      const partD     = batchPartDescs.value[ex.part] ?? ''
      const partTitle = partD.trim() ? `${partLabel} · ${partD.trim()}` : partLabel

      results.push({
        unit: unitTitle,
        part: partTitle,
        exercise: {
          title:       exFolderToTitle(ex.exFolder),
          questionImg: questionUrls,
          answerImg:   answerUrls,
          ...(audioUrl          && { audioSrc:  audioUrl }),
          ...(scriptUrls.length && { scriptImg: scriptUrls }),
        },
      })
      batchProgress.value.done++
    }

    batchStatus.value = '写入数据库…'
    const res = await fetch('/api/batch-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercises: results }),
    })
    if (!res.ok) throw new Error('保存失败')

    batchStatus.value   = `导入完成：共 ${exercises.length} 条练习`
    batchStatusOk.value = true
    loadAll()
  } catch (e) {
    batchStatus.value   = `错误：${e.message}`
    batchStatusOk.value = false
  } finally {
    isBatchImporting.value = false
  }
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">

    <!-- ── 左侧：内容树 ── -->
    <aside class="flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-700 overflow-hidden w-auto min-w-48">
      <div class="px-4 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
        <span class="text-sm font-medium text-gray-200">已有内容</span>
        <button class="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          @click="startNew(); activeTab = 'single'">+ 新增</button>
      </div>
      <div class="overflow-y-auto overflow-x-hidden flex-1 py-2">
        <div v-if="loadingData" class="px-4 py-6 text-xs text-gray-400">加载中…</div>
        <div v-else-if="!allData.units.length" class="px-4 py-6 text-xs text-gray-400">暂无内容</div>
        <div v-for="unit in allData.units" :key="unit.title" class="mb-3">
          <div class="px-3 py-1.5">
            <span class="text-xs font-bold text-gray-200 whitespace-nowrap">{{ unit.title }}</span>
          </div>
          <div v-for="part in unit.parts" :key="part.title" class="ml-3 mb-2">
            <div class="flex items-center gap-1 px-2 py-1">
              <span class="text-xs font-semibold text-gray-500 whitespace-nowrap flex-1">{{ part.title }}</span>
              <button
                class="text-xs text-red-500 hover:text-red-400 shrink-0 px-1"
                title="删除此分组"
                @click="deletePart(unit.title, part.title, part.exercises.length)"
              >删</button>
            </div>
            <div v-for="(ex, idx) in part.exercises" :key="idx"
                 class="flex items-center gap-2 pl-3 pr-2 py-1.5 border-l-2 transition-colors rounded-r"
                 :class="editingKey.unit === unit.title && editingKey.part === part.title && editingKey.index === idx
                   ? 'border-indigo-500 bg-indigo-600/20'
                   : 'border-transparent hover:bg-gray-800'">
              <span class="text-xs text-gray-300 whitespace-nowrap pr-1">{{ ex.title || '（无标题）' }}</span>
              <span class="text-xs text-gray-600 shrink-0">
                {{ toArray(ex.questionImg).length }}+{{ toArray(ex.answerImg).length }}
                <span v-if="ex.audioSrc">🔊</span>
              </span>
              <button class="text-xs text-indigo-400 hover:text-indigo-300 shrink-0"
                @click="startEdit(unit.title, part.title, idx, ex)">编辑</button>
              <button class="text-xs text-red-500 hover:text-red-400 shrink-0"
                @click="deleteExercise(unit.title, part.title, idx, ex.title)">删</button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- ── 右侧：主区域 ── -->
    <main class="flex-1 overflow-y-auto bg-gray-950">
      <div class="max-w-xl mx-auto p-6">

        <!-- 顶部标题行 -->
        <div class="flex items-center justify-between mb-5">
          <h1 class="text-lg font-semibold">
            <template v-if="activeTab === 'batch'">批量导入</template>
            <template v-else-if="isEditing">编辑：{{ editingKey.unit }} › {{ editingKey.part }}</template>
            <template v-else>新增内容</template>
          </h1>
          <a href="#/" class="text-sm text-indigo-400 hover:underline">返回前台</a>
        </div>

        <!-- 标签页切换 -->
        <div class="flex border-b border-gray-700 mb-6">
          <button
            class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
            :class="activeTab === 'single'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'"
            @click="activeTab = 'single'">
            单题编辑
          </button>
          <button
            class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
            :class="activeTab === 'batch'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'"
            @click="switchToBatch">
            批量导入
          </button>
        </div>

        <!-- ══ 单题编辑 ══ -->
        <div v-if="activeTab === 'single'" class="space-y-5">

          <div v-if="isEditing"
               class="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2 text-sm">
            <span class="text-yellow-300">编辑模式</span>
            <button class="text-gray-400 hover:text-white text-xs" @click="startNew">取消，切换为新增</button>
          </div>

          <!-- Unit -->
          <div class="flex gap-2">
            <select v-model="unitNum" :disabled="isEditing"
              class="w-32 shrink-0 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50">
              <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
            <div class="flex-1 flex gap-1">
              <select v-if="unitDescOptions.length && !isEditing"
                class="bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-gray-400 focus:outline-none focus:border-indigo-500"
                @change="unitDesc = $event.target.value; $event.target.value = ''">
                <option value="">选已有</option>
                <option v-for="d in unitDescOptions" :key="d" :value="d">{{ d }}</option>
              </select>
              <input v-model="unitDesc" :disabled="isEditing"
                placeholder="Unit 描述（如 Cambridge 16）"
                class="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
            </div>
          </div>

          <!-- Part -->
          <div class="flex gap-2">
            <select v-model="partNum" :disabled="isEditing"
              class="w-32 shrink-0 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50">
              <option v-for="p in PARTS" :key="p" :value="p">{{ p }}</option>
            </select>
            <div class="flex-1 flex gap-1">
              <select v-if="partDescOptions.length && !isEditing"
                class="bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-gray-400 focus:outline-none focus:border-indigo-500"
                @change="partDesc = $event.target.value; $event.target.value = ''">
                <option value="">选已有</option>
                <option v-for="d in partDescOptions" :key="d" :value="d">{{ d }}</option>
              </select>
              <input v-model="partDesc" :disabled="isEditing"
                placeholder="Part 描述（如 Listening Test 1）"
                class="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
            </div>
          </div>

          <!-- Exercise -->
          <div class="flex gap-2">
            <select v-model="exNum"
              class="w-32 shrink-0 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
              <option v-for="e in EXERCISES" :key="e" :value="e">{{ e }}</option>
            </select>
            <input v-model="exDesc" placeholder="题目范围（如 Questions 1-10）"
              class="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <p class="text-xs text-gray-500 -mt-3 pl-1">
            标题预览：<span class="text-gray-300">{{ exerciseTitle }}</span>
          </p>

          <!-- Drop Zones -->
          <div class="space-y-3">
            <template v-for="row in [
              { key: 'question', label: '题目图片（必填，可多张）',     accept: 'image/*', multi: true  },
              { key: 'answer',   label: '答案图片（必填，可多张）',     accept: 'image/*', multi: true  },
              { key: 'audio',    label: '音频文件（可选）',             accept: 'audio/*', multi: false },
              { key: 'script',   label: '听力原文图片（可选，可多张）', accept: 'image/*', multi: true  },
            ]" :key="row.key">
              <label class="relative flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition-colors"
                :class="dropBorder(row.key)"
                @dragover.prevent="dragging = row.key"
                @dragleave="dragging = null"
                @drop.prevent="onDrop($event, row.key)">
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

        <!-- ══ 批量导入 ══ -->
        <div v-else class="space-y-5">

          <!-- 步骤 1：选 Unit -->
          <div class="rounded-lg border border-gray-700 overflow-hidden">
            <div class="px-4 py-2 bg-gray-800 text-xs text-gray-400">第一步：选择要导入的 Unit</div>
            <div class="px-4 py-3 flex gap-2 items-center">
              <select v-model="batchUnitNum" @change="onBatchUnitNumChange"
                class="w-32 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option v-for="n in 12" :key="n" :value="n">Unit {{ n }}</option>
              </select>
              <input v-model="batchUnitDesc" placeholder="Unit 描述（如 Cambridge 16，可选）"
                class="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          <!-- 步骤 2：选本地 data 文件夹 -->
          <label class="relative flex items-center gap-4 rounded-lg border-2 border-dashed px-5 py-4 cursor-pointer transition-colors"
            :class="batchParsed.length
              ? 'border-green-600 bg-green-500/5'
              : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'">
            <span class="text-2xl shrink-0">{{ batchParsed.length ? '✅' : '📁' }}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-200 font-medium">第二步：选择本地 data 文件夹</p>
              <p class="text-xs mt-0.5" :class="batchParsed.length ? 'text-green-400' : 'text-gray-500'">
                {{ batchParsed.length
                    ? `「${batchFolderName}」中识别到 Unit ${batchUnitNum} 共 ${batchParsed.length} 条练习`
                    : `点击选择本机 public/data 目录，只读取 Unit ${batchUnitNum} 的内容` }}
              </p>
            </div>
            <input type="file" webkitdirectory class="absolute inset-0 opacity-0 cursor-pointer"
              @change="onBatchFolderPick" />
          </label>

          <!-- Part 描述 + 预览（解析到内容后显示） -->
          <template v-if="batchParsed.length">

            <div class="rounded-lg border border-gray-700 overflow-hidden">
              <div class="px-3 py-2 bg-gray-800 text-xs text-gray-400">Part 描述（可选）</div>
              <div class="divide-y divide-gray-800">
                <div v-for="p in batchPartsInUnit" :key="p" class="flex items-center gap-3 px-3 py-2">
                  <span class="text-sm text-gray-400 w-14 shrink-0">{{ partFolderToLabel(p) }}</span>
                  <input v-model="batchPartDescs[p]" placeholder="如 Vocabulary / Listening Test 1"
                    class="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
            </div>

            <!-- 预览表格 -->
            <div class="rounded-lg border border-gray-700 overflow-hidden">
              <div class="px-3 py-2 bg-gray-800 flex items-center justify-between">
                <span class="text-xs text-gray-400">预览 — {{ batchParsed.length }} 条练习</span>
                <span v-if="batchUnitDesc" class="text-xs text-indigo-400">Unit {{ batchUnitNum }} · {{ batchUnitDesc }}</span>
              </div>
              <table class="w-full text-xs">
                <thead>
                  <tr class="bg-gray-800/50 text-gray-500">
                    <th class="px-3 py-2 text-left font-normal">Part</th>
                    <th class="px-3 py-2 text-left font-normal">Exercise</th>
                    <th class="px-3 py-2 text-center font-normal">题目</th>
                    <th class="px-3 py-2 text-center font-normal">答案</th>
                    <th class="px-3 py-2 text-center font-normal">音频</th>
                    <th class="px-3 py-2 text-center font-normal">原文</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800">
                  <tr v-for="ex in batchParsed" :key="`${ex.part}/${ex.exFolder}`"
                      class="text-gray-300 hover:bg-gray-800/40 transition-colors">
                    <td class="px-3 py-2 text-gray-500">{{ partFolderToLabel(ex.part) }}</td>
                    <td class="px-3 py-2">{{ exFolderToTitle(ex.exFolder) }}</td>
                    <td class="px-3 py-2 text-center">{{ ex.questionFiles.length }} 张</td>
                    <td class="px-3 py-2 text-center">{{ ex.answerFiles.length }} 张</td>
                    <td class="px-3 py-2 text-center">
                      <span v-if="ex.audioFile" class="text-green-400">🔊</span>
                      <span v-else class="text-gray-700">—</span>
                    </td>
                    <td class="px-3 py-2 text-center">
                      <span v-if="ex.scriptFiles.length" class="text-blue-400">{{ ex.scriptFiles.length }} 张</span>
                      <span v-else class="text-gray-700">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 进度条 -->
            <div v-if="isBatchImporting" class="space-y-2">
              <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                     :style="{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }"></div>
              </div>
              <p class="text-xs text-gray-400 text-center">{{ batchStatus }}</p>
            </div>
            <p v-else-if="batchStatus" class="text-sm text-center"
               :class="batchStatusOk ? 'text-green-400' : 'text-red-400'">{{ batchStatus }}</p>

            <button
              class="w-full bg-indigo-600 hover:bg-indigo-500 rounded py-2.5 text-sm font-medium disabled:opacity-40 transition-colors"
              :disabled="isBatchImporting"
              @click="startBatchImport">
              {{ isBatchImporting
                  ? `上传中… ${batchProgress.done}/${batchProgress.total}`
                  : `上传并发布 Unit ${batchUnitNum} 的 ${batchParsed.length} 条练习` }}
            </button>

          </template>
        </div>

      </div>
    </main>
  </div>
</template>
