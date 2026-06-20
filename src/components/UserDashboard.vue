<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ── 数据 ──────────────────────────────────────────────
const allData      = ref({ units: [] })
const loading      = ref(true)
const navOpen      = ref(true)
const selectedUnit = ref(null)
const selectedPart = ref(null)
const selectedEx   = ref(null)
const expandedUnit = ref(null)

// 兼容旧数据（单字符串）和新数据（数组）
function toArray(v) { if (!v) return []; return Array.isArray(v) ? v : [v] }

onMounted(async () => {
  if (window.innerWidth < 768) navOpen.value = false
  try {
    const res = await fetch('/api/exercises')
    allData.value = await res.json()
    const firstUnit = allData.value.units[0]
    if (firstUnit) {
      expandedUnit.value = firstUnit.title
      const firstPart = firstUnit.parts[0]
      if (firstPart?.exercises[0]) selectExercise(firstUnit, firstPart, firstPart.exercises[0])
    }
  } finally {
    loading.value = false
  }
  window.addEventListener('keydown', handleKey)
})
onUnmounted(() => window.removeEventListener('keydown', handleKey))

function selectExercise(unit, part, ex) {
  selectedUnit.value = unit
  selectedPart.value = part
  selectedEx.value   = ex
  showAnswer.value   = false
  showScript.value   = false
  isPlaying.value    = false
  userAnswer.value   = ''
  comments.value     = []
  if (window.innerWidth < 768) navOpen.value = false
  fetchComments()
}

const currentExerciseList = computed(() => selectedPart.value?.exercises ?? [])
const currentIndex        = computed(() => currentExerciseList.value.indexOf(selectedEx.value))

// ── 图片显隐 ──────────────────────────────────────────
const showAnswer = ref(false)
const showScript = ref(false)

// ── 图片放大（Lightbox）──────────────────────────────
const zoomedImg = ref(null)
function openZoom(src) { zoomedImg.value = src }
function closeZoom()   { zoomedImg.value = null }

// ── 用户答案输入 ──────────────────────────────────────
const userAnswer = ref('')
const hasAudio   = computed(() => !!selectedEx.value?.audioSrc)
const hasScript  = computed(() => toArray(selectedEx.value?.scriptImg).length > 0)

// ── 评论 / 心得 ───────────────────────────────────────
const comments         = ref([])
const commentText      = ref('')
const submitting       = ref(false)
const commentsOpen     = ref(true)
const commentsLoading  = ref(false)

async function fetchComments() {
  if (!selectedEx.value) return
  const idx = currentExerciseList.value.indexOf(selectedEx.value)
  commentsLoading.value = true
  try {
    const res = await fetch(
      `/api/comments?unit=${encodeURIComponent(selectedUnit.value.title)}&part=${encodeURIComponent(selectedPart.value.title)}&exerciseIndex=${idx}`
    )
    comments.value = await res.json()
  } finally {
    commentsLoading.value = false
  }
}

async function submitComment() {
  if (!commentText.value.trim() || submitting.value || !selectedEx.value) return
  submitting.value = true
  const idx = currentExerciseList.value.indexOf(selectedEx.value)
  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit:          selectedUnit.value.title,
        part:          selectedPart.value.title,
        exerciseIndex: idx,
        text:          commentText.value.trim(),
      }),
    })
    const comment = await res.json()
    comments.value.push(comment)
    commentText.value = ''
  } finally {
    submitting.value = false
  }
}

function fmtDate(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── 音频 ──────────────────────────────────────────────
const audioEl     = ref(null)
const isPlaying   = ref(false)
const currentTime = ref(0)
const duration    = ref(0)
const progressPct = computed(() => duration.value ? (currentTime.value / duration.value) * 100 : 0)

function togglePlay() {
  if (!audioEl.value) return
  isPlaying.value ? audioEl.value.pause() : audioEl.value.play()
  isPlaying.value = !isPlaying.value
}
function seek(delta) {
  if (!audioEl.value) return
  audioEl.value.currentTime = Math.min(Math.max(audioEl.value.currentTime + delta, 0), audioEl.value.duration || 0)
}
function onTimeUpdate()     { currentTime.value = audioEl.value?.currentTime ?? 0 }
function onLoadedMetadata() { duration.value    = audioEl.value?.duration    ?? 0 }
function onEnded()          { isPlaying.value   = false }
function fmt(s) { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}` }
function seekByClick(e) {
  if (audioEl.value) audioEl.value.currentTime = (e.offsetX / e.currentTarget.offsetWidth) * duration.value
}

// ── 练习切换 ──────────────────────────────────────────
function nextExercise() {
  const i = currentIndex.value, list = currentExerciseList.value
  if (i < list.length - 1) selectExercise(selectedUnit.value, selectedPart.value, list[i + 1])
}
function prevExercise() {
  const i = currentIndex.value, list = currentExerciseList.value
  if (i > 0) selectExercise(selectedUnit.value, selectedPart.value, list[i - 1])
}

// ── 键盘快捷键 ────────────────────────────────────────
function handleKey(e) {
  if (e.code === 'Escape') { closeZoom(); return }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  if      (e.code === 'Space')      { e.preventDefault(); togglePlay() }
  else if (e.code === 'ArrowLeft')  { e.preventDefault(); seek(-5) }
  else if (e.code === 'ArrowRight') { e.preventDefault(); seek(5) }
  else if (e.code === 'KeyZ')       { e.preventDefault(); showAnswer.value = !showAnswer.value }
  else if (e.code === 'KeyX')       { e.preventDefault(); showScript.value = !showScript.value }
  else if (e.code === 'Tab')        { e.preventDefault(); nextExercise() }
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">

    <!-- ── 侧边栏 ── -->
    <aside
      class="flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-700 transition-all duration-200 overflow-hidden"
      :class="navOpen ? 'w-64' : 'w-0'"
    >
      <div class="p-3 border-b border-gray-700 flex items-center justify-between shrink-0">
        <span class="text-sm font-medium text-gray-200">目录</span>
        <a href="#/admin" class="text-xs text-indigo-400 hover:text-indigo-300">后台</a>
      </div>
      <div class="overflow-y-auto flex-1 py-2">
        <div v-if="loading" class="px-4 py-6 text-xs text-gray-400">加载中…</div>
        <div v-else-if="!allData.units.length" class="px-4 py-6 text-xs text-gray-400">暂无内容</div>
        <div v-for="unit in allData.units" :key="unit.title">
          <button
            class="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            @click="expandedUnit = expandedUnit === unit.title ? null : unit.title"
          >
            {{ unit.title }}
            <span class="text-gray-500">{{ expandedUnit === unit.title ? '▲' : '▼' }}</span>
          </button>
          <div v-if="expandedUnit === unit.title">
            <div v-for="part in unit.parts" :key="part.title" class="mb-1">
              <p class="px-5 py-1 text-xs text-gray-500 font-medium">{{ part.title }}</p>
              <button
                v-for="ex in part.exercises" :key="ex.title"
                class="w-full text-left px-6 py-1.5 text-sm truncate transition-colors border-l-2"
                :class="selectedEx === ex
                  ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white border-transparent'"
                @click="selectExercise(unit, part, ex)"
              >{{ ex.title || '（无标题）' }}</button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- ── 主内容区 ── -->
    <main class="flex-1 flex flex-col overflow-hidden min-w-0">
      <!-- 顶栏 -->
      <header class="flex items-center gap-3 px-4 py-3 border-b border-gray-700 shrink-0 bg-gray-900">
        <button class="text-gray-300 hover:text-white transition-colors text-lg leading-none" @click="navOpen = !navOpen">☰</button>
        <div class="flex-1 min-w-0 text-sm truncate">
          <span v-if="selectedEx" class="text-gray-300">
            {{ selectedUnit?.title }} · {{ selectedPart?.title }} ·
            <span class="text-white font-medium">{{ selectedEx.title }}</span>
            <span class="ml-2 text-gray-500 text-xs">（{{ currentIndex + 1 }} / {{ currentExerciseList.length }}）</span>
          </span>
          <span v-else class="text-gray-500">请从左侧选择练习</span>
        </div>
        <button
          class="text-gray-400 hover:text-white transition-colors text-sm px-2 py-1 rounded border border-gray-700 hover:border-gray-500 shrink-0"
          :class="commentsOpen ? 'text-indigo-400 border-indigo-600' : ''"
          @click="commentsOpen = !commentsOpen"
          title="心得"
        >心得</button>
      </header>

      <!-- 内容 + 评论并排 -->
      <div class="flex-1 flex overflow-hidden">

      <!-- 练习内容 -->
      <div class="flex-1 overflow-y-auto bg-gray-950">
        <div class="max-w-3xl mx-auto p-6 space-y-4">
          <div v-if="loading" class="text-center text-gray-400 py-24">加载中…</div>
          <div v-else-if="!selectedEx" class="text-center text-gray-400 py-24">从左侧导航选择一道练习开始做题。</div>

          <template v-else>
            <!-- 题目图片（支持多张） -->
            <img v-for="(src, i) in toArray(selectedEx.questionImg)" :key="'q'+i"
              :src="src" alt="题目" class="w-full rounded-lg cursor-zoom-in"
              @click="openZoom(src)" />

            <!-- 答案输入框 -->
            <div class="space-y-1">
              <label class="text-xs text-gray-400">我的答案</label>
              <textarea
                v-model="userAnswer"
                rows="3"
                placeholder="在此输入你的答案，按 Z 显示正确答案对比…"
                class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 resize-y focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <!-- 答案图片（支持多张） -->
            <template v-if="showAnswer">
              <img v-for="(src, i) in toArray(selectedEx.answerImg)" :key="'a'+i"
                :src="src" alt="答案" class="w-full rounded-lg cursor-zoom-in"
                @click="openZoom(src)" />
            </template>

            <!-- 音频播放器 -->
            <div v-if="hasAudio" class="space-y-2">
              <audio ref="audioEl" :src="selectedEx.audioSrc"
                @timeupdate="onTimeUpdate" @loadedmetadata="onLoadedMetadata" @ended="onEnded" />
              <div class="w-full h-2.5 bg-gray-700 rounded-full overflow-hidden cursor-pointer" @click="seekByClick">
                <div class="h-full bg-indigo-500 transition-all duration-100 pointer-events-none"
                  :style="{ width: progressPct + '%' }" />
              </div>
              <div class="flex items-center justify-between text-xs text-gray-400">
                <span>{{ fmt(currentTime) }}</span>
                <span class="font-medium" :class="isPlaying ? 'text-indigo-400' : 'text-gray-400'">
                  {{ isPlaying ? '▶ 播放中' : '⏸ 已暂停' }}
                </span>
                <span>{{ fmt(duration) }}</span>
              </div>
            </div>

            <!-- 听力原文（支持多张） -->
            <template v-if="hasScript && showScript">
              <img v-for="(src, i) in toArray(selectedEx.scriptImg)" :key="'s'+i"
                :src="src" alt="听力原文" class="w-full rounded-lg cursor-zoom-in"
                @click="openZoom(src)" />
            </template>

            <!-- 底部操作栏 -->
            <div class="flex items-center justify-between pt-2 gap-4">
              <button
                class="px-4 py-2 rounded-lg text-sm font-medium border border-gray-600 text-gray-200 bg-gray-800 hover:bg-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                :disabled="currentIndex === 0" @click="prevExercise">← 上一题</button>

              <span class="text-xs text-gray-400 text-center leading-relaxed">
                <span class="inline-flex gap-3 flex-wrap justify-center">
                  <span><kbd class="bg-gray-700 text-gray-200 px-1.5 py-0.5 rounded text-xs">Z</kbd> 答案</span>
                  <span v-if="hasScript"><kbd class="bg-gray-700 text-gray-200 px-1.5 py-0.5 rounded text-xs">X</kbd> 原文</span>
                  <span v-if="hasAudio"><kbd class="bg-gray-700 text-gray-200 px-1.5 py-0.5 rounded text-xs">空格</kbd> 播放</span>
                  <span v-if="hasAudio"><kbd class="bg-gray-700 text-gray-200 px-1.5 py-0.5 rounded text-xs">← →</kbd> 跳转</span>
                </span>
              </span>

              <button
                class="px-4 py-2 rounded-lg text-sm font-medium border border-gray-600 text-gray-200 bg-gray-800 hover:bg-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                :disabled="currentIndex === currentExerciseList.length - 1" @click="nextExercise">下一题 →</button>
            </div>
          </template>
        </div>
      </div>

      <!-- ── 右侧评论面板 ── -->
      <aside
        v-if="commentsOpen"
        class="w-72 flex-shrink-0 flex flex-col border-l border-gray-700 bg-gray-900 overflow-hidden"
      >
        <div class="px-3 py-2.5 border-b border-gray-700 shrink-0">
          <span class="text-sm font-medium text-gray-200">学习心得</span>
          <span class="ml-2 text-xs text-gray-500">{{ comments.length ? `${comments.length} 条` : '' }}</span>
        </div>

        <!-- 心得列表 -->
        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          <div v-if="commentsLoading" class="text-xs text-gray-400 text-center py-6">加载中…</div>
          <div v-else-if="!selectedEx" class="text-xs text-gray-500 text-center py-6">选择练习后查看心得</div>
          <div v-else-if="!comments.length" class="text-xs text-gray-500 text-center py-6">暂无心得，来写第一条吧 ✍</div>
          <div
            v-for="c in [...comments].reverse()" :key="c.id"
            class="bg-gray-800 rounded-lg p-2.5 space-y-1.5"
          >
            <p class="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap break-words">{{ c.text }}</p>
            <p class="text-xs text-gray-500">{{ fmtDate(c.timestamp) }}</p>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="p-3 border-t border-gray-700 shrink-0 space-y-2">
          <textarea
            v-model="commentText"
            rows="3"
            placeholder="写下你的心得…"
            :disabled="!selectedEx || submitting"
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-40"
          />
          <button
            @click="submitComment"
            :disabled="!selectedEx || !commentText.trim() || submitting"
            class="w-full py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >{{ submitting ? '发布中…' : '发布心得' }}</button>
        </div>
      </aside>

      </div><!-- end 内容+评论 flex 容器 -->
    </main>

    <!-- ── 图片放大 Lightbox ── -->
    <Teleport to="body">
      <div
        v-if="zoomedImg"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
        @click.self="closeZoom"
      >
        <button
          class="absolute top-4 right-5 text-white text-3xl leading-none opacity-70 hover:opacity-100 transition-opacity"
          @click="closeZoom"
        >×</button>
        <img
          :src="zoomedImg"
          alt="放大图片"
          class="max-w-[92vw] max-h-[92vh] rounded-lg shadow-2xl object-contain"
          @click="closeZoom"
        />
      </div>
    </Teleport>
  </div>
</template>
