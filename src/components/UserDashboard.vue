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
  if (window.innerWidth < 768) navOpen.value = false
}

const currentExerciseList = computed(() => selectedPart.value?.exercises ?? [])
const currentIndex        = computed(() => currentExerciseList.value.indexOf(selectedEx.value))

// ── 图片显隐 ──────────────────────────────────────────
const showAnswer = ref(false)
const showScript = ref(false)
const hasAudio   = computed(() => !!selectedEx.value?.audioSrc)
const hasScript  = computed(() => toArray(selectedEx.value?.scriptImg).length > 0)

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
    <main class="flex-1 flex flex-col overflow-hidden">
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
      </header>

      <!-- 练习内容 -->
      <div class="flex-1 overflow-y-auto bg-gray-950">
        <div class="max-w-3xl mx-auto p-6 space-y-4">
          <div v-if="loading" class="text-center text-gray-400 py-24">加载中…</div>
          <div v-else-if="!selectedEx" class="text-center text-gray-400 py-24">从左侧导航选择一道练习开始做题。</div>

          <template v-else>
            <!-- 题目图片（支持多张） -->
            <img v-for="(src, i) in toArray(selectedEx.questionImg)" :key="'q'+i"
              :src="src" alt="题目" class="w-full rounded-lg" />

            <!-- 答案图片（支持多张） -->
            <template v-if="showAnswer">
              <img v-for="(src, i) in toArray(selectedEx.answerImg)" :key="'a'+i"
                :src="src" alt="答案" class="w-full rounded-lg" />
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
                :src="src" alt="听力原文" class="w-full rounded-lg" />
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
    </main>
  </div>
</template>
