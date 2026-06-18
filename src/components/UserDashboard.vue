<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ── 数据 ──────────────────────────────────────────────
const allData   = ref({ units: [] })
const loading   = ref(true)
const navOpen   = ref(true)   // 侧边栏展开状态（小屏默认收起）

// 当前选中路径
const selectedUnit = ref(null)
const selectedPart = ref(null)
const selectedEx   = ref(null)   // exercise 对象

// 展开的 Unit（侧边栏折叠）
const expandedUnit = ref(null)

onMounted(async () => {
  if (window.innerWidth < 768) navOpen.value = false
  try {
    const res = await fetch('/api/exercises')
    allData.value = await res.json()
    // 默认选中第一条
    const firstUnit = allData.value.units[0]
    if (firstUnit) {
      const firstPart = firstUnit.parts[0]
      if (firstPart?.exercises[0]) {
        selectExercise(firstUnit, firstPart, firstPart.exercises[0])
      }
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
  // 小屏选中后自动收起导航
  if (window.innerWidth < 768) navOpen.value = false
}

// 当前 Part 的练习列表，用于 Tab 键切换
const currentExerciseList = computed(() =>
  selectedPart.value?.exercises ?? []
)
const currentIndex = computed(() =>
  currentExerciseList.value.indexOf(selectedEx.value)
)

// ── 图片显隐 ──────────────────────────────────────────
const showAnswer = ref(false)
const showScript = ref(false)
const hasAudio   = computed(() => !!selectedEx.value?.audioSrc)
const hasScript  = computed(() => !!selectedEx.value?.scriptImg)

// ── 音频 ──────────────────────────────────────────────
const audioEl      = ref(null)
const isPlaying    = ref(false)
const currentTime  = ref(0)
const duration     = ref(0)
const progressPct  = computed(() =>
  duration.value ? (currentTime.value / duration.value) * 100 : 0
)

function togglePlay() {
  if (!audioEl.value) return
  isPlaying.value ? audioEl.value.pause() : audioEl.value.play()
  isPlaying.value = !isPlaying.value
}
function seek(delta) {
  if (!audioEl.value) return
  audioEl.value.currentTime = Math.min(
    Math.max(audioEl.value.currentTime + delta, 0),
    audioEl.value.duration || 0
  )
}
function onTimeUpdate()    { currentTime.value = audioEl.value?.currentTime ?? 0 }
function onLoadedMetadata(){ duration.value    = audioEl.value?.duration    ?? 0 }
function onEnded()         { isPlaying.value   = false }

// 格式化时间 mm:ss
function fmt(s) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// ── 练习切换 ──────────────────────────────────────────
function nextExercise() {
  const list = currentExerciseList.value
  const i = currentIndex.value
  if (i < list.length - 1) selectExercise(selectedUnit.value, selectedPart.value, list[i + 1])
}
function prevExercise() {
  const list = currentExerciseList.value
  const i = currentIndex.value
  if (i > 0) selectExercise(selectedUnit.value, selectedPart.value, list[i - 1])
}

// ── 键盘快捷键 ────────────────────────────────────────
function handleKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  if (e.code === 'Space')       { e.preventDefault(); togglePlay() }
  else if (e.code === 'ArrowLeft')  { e.preventDefault(); seek(-5) }
  else if (e.code === 'ArrowRight') { e.preventDefault(); seek(5) }
  else if (e.code === 'KeyZ')   { e.preventDefault(); showAnswer.value = !showAnswer.value }
  else if (e.code === 'KeyX')   { e.preventDefault(); showScript.value = !showScript.value }
  else if (e.code === 'Tab')    { e.preventDefault(); nextExercise() }
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">

    <!-- ── 侧边栏导航 ── -->
    <aside
      class="flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 overflow-hidden"
      :class="navOpen ? 'w-64' : 'w-0'"
    >
      <div class="p-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <span class="text-sm font-medium text-gray-300">目录</span>
        <a href="#/admin" class="text-xs text-gray-500 hover:text-indigo-400">后台</a>
      </div>

      <div class="overflow-y-auto flex-1 py-2">
        <div v-if="loading" class="px-4 py-6 text-xs text-gray-500">加载中…</div>
        <div v-else-if="!allData.units.length" class="px-4 py-6 text-xs text-gray-500">暂无内容</div>

        <div v-for="unit in allData.units" :key="unit.title">
          <!-- Unit 折叠头 -->
          <button
            class="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors"
            @click="expandedUnit = expandedUnit === unit.title ? null : unit.title"
          >
            {{ unit.title }}
            <span class="text-gray-600">{{ expandedUnit === unit.title ? '▲' : '▼' }}</span>
          </button>

          <!-- Parts + Exercises -->
          <div v-if="expandedUnit === unit.title">
            <div v-for="part in unit.parts" :key="part.title" class="mb-1">
              <!-- Part 标签 -->
              <p class="px-5 py-1 text-xs text-gray-600 font-medium">{{ part.title }}</p>
              <!-- Exercise 列表 -->
              <button
                v-for="ex in part.exercises"
                :key="ex.title"
                class="w-full text-left px-6 py-1.5 text-sm truncate transition-colors"
                :class="selectedEx === ex
                  ? 'bg-indigo-600/30 text-indigo-300 border-l-2 border-indigo-500'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-l-2 border-transparent'"
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
      <header class="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
        <button
          class="text-gray-400 hover:text-white transition-colors text-lg leading-none"
          @click="navOpen = !navOpen"
          title="切换导航"
        >☰</button>
        <div class="flex-1 min-w-0 text-sm text-gray-400 truncate">
          <span v-if="selectedEx">
            {{ selectedUnit?.title }} · {{ selectedPart?.title }} ·
            <span class="text-gray-200">{{ selectedEx.title }}</span>
            <span class="ml-2 text-gray-600 text-xs">
              {{ currentIndex + 1 }} / {{ currentExerciseList.length }}
            </span>
          </span>
          <span v-else class="text-gray-600">请从左侧选择练习</span>
        </div>
      </header>

      <!-- 练习内容 -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-3xl mx-auto p-6 space-y-5">
          <div v-if="loading" class="text-center text-gray-500 py-24">加载中…</div>
          <div v-else-if="!selectedEx" class="text-center text-gray-500 py-24">
            从左侧导航选择一道练习开始做题。
          </div>

          <template v-else>
            <!-- 题目图片 -->
            <img :src="selectedEx.questionImg" alt="题目" class="w-full rounded-lg" />

            <!-- 答案图片 -->
            <img v-if="showAnswer" :src="selectedEx.answerImg" alt="答案" class="w-full rounded-lg" />

            <!-- 音频播放器 -->
            <div v-if="hasAudio" class="space-y-2">
              <audio ref="audioEl" :src="selectedEx.audioSrc"
                @timeupdate="onTimeUpdate" @loadedmetadata="onLoadedMetadata" @ended="onEnded" />
              <!-- 进度条（可点击跳转） -->
              <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden cursor-pointer"
                @click="e => { if (audioEl) audioEl.currentTime = (e.offsetX / e.currentTarget.offsetWidth) * duration }">
                <div class="h-full bg-indigo-500 transition-all duration-100 pointer-events-none"
                  :style="{ width: progressPct + '%' }" />
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500">
                <span>{{ fmt(currentTime) }}</span>
                <span>{{ isPlaying ? '▶ 播放中' : '⏸ 已暂停' }}</span>
                <span>{{ fmt(duration) }}</span>
              </div>
            </div>

            <!-- 听力原文 -->
            <img v-if="hasScript && showScript" :src="selectedEx.scriptImg" alt="听力原文" class="w-full rounded-lg" />

            <!-- 操作栏 -->
            <div class="flex items-center justify-between text-xs text-gray-600 pt-1">
              <button class="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                :disabled="currentIndex === 0" @click="prevExercise">← 上一题</button>
              <span class="space-x-3">
                <span>Z 答案</span>
                <span>X 原文</span>
                <span v-if="hasAudio">空格 播放 · ← → 跳转</span>
              </span>
              <button class="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                :disabled="currentIndex === currentExerciseList.length - 1" @click="nextExercise">下一题 →</button>
            </div>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>
