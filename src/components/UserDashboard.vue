<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ── 数据 ──────────────────────────────────────────────
const exerciseList = ref([])
const exerciseIndex = ref(0)
const currentExercise = computed(() => exerciseList.value[exerciseIndex.value] ?? null)
const loading = ref(true)

// ── 图片显隐状态 ──────────────────────────────────────
const showAnswer = ref(false)
const showScript = ref(false)

// ── 音频 ──────────────────────────────────────────────
const audioEl = ref(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const hasAudio = computed(() => !!currentExercise.value?.audioSrc)
const hasScript = computed(() => !!currentExercise.value?.scriptImg)
const progressPercent = computed(() =>
  duration.value ? (currentTime.value / duration.value) * 100 : 0
)

// ── 从 KV 加载全量数据 ────────────────────────────────
onMounted(async () => {
  try {
    const res = await fetch('/api/exercises')
    const data = await res.json()
    // 将树状结构拍平为练习列表
    const list = []
    for (const unit of data.units ?? []) {
      for (const part of unit.parts ?? []) {
        for (const ex of part.exercises ?? []) {
          list.push({ ...ex, _unit: unit.title, _part: part.title })
        }
      }
    }
    exerciseList.value = list
  } finally {
    loading.value = false
  }
})

// ── 键盘快捷键 ────────────────────────────────────────
function handleKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  if (e.code === 'Space') {
    e.preventDefault(); togglePlay()
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault(); seek(-5)
  } else if (e.code === 'ArrowRight') {
    e.preventDefault(); seek(5)
  } else if (e.code === 'KeyZ') {
    e.preventDefault(); showAnswer.value = !showAnswer.value
  } else if (e.code === 'KeyX') {
    e.preventDefault(); showScript.value = !showScript.value
  } else if (e.code === 'Tab') {
    e.preventDefault(); nextExercise()
  }
}

onMounted(() => window.addEventListener('keydown', handleKey))
onUnmounted(() => window.removeEventListener('keydown', handleKey))

// ── 音频操作 ──────────────────────────────────────────
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
function onTimeUpdate() { currentTime.value = audioEl.value?.currentTime ?? 0 }
function onLoadedMetadata() { duration.value = audioEl.value?.duration ?? 0 }
function onEnded() { isPlaying.value = false }

// ── 练习切换 ──────────────────────────────────────────
function nextExercise() {
  if (exerciseIndex.value < exerciseList.value.length - 1) {
    exerciseIndex.value++
    showAnswer.value = false
    showScript.value = false
    isPlaying.value = false
  }
}
function prevExercise() {
  if (exerciseIndex.value > 0) {
    exerciseIndex.value--
    showAnswer.value = false
    showScript.value = false
    isPlaying.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-6 space-y-5">
    <!-- 顶栏 -->
    <div class="flex items-center justify-between text-sm text-gray-500">
      <span v-if="currentExercise">
        {{ currentExercise._unit }} · {{ currentExercise._part }} · {{ currentExercise.title }}
        <span class="text-gray-600 ml-2">（{{ exerciseIndex + 1 }} / {{ exerciseList.length }}）</span>
      </span>
      <a href="#/admin" class="text-indigo-400 hover:underline ml-auto">后台</a>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="text-center text-gray-500 py-24">加载中…</div>

    <!-- 无数据 -->
    <div v-else-if="!currentExercise" class="text-center text-gray-500 py-24">
      暂无练习，请前往 <a href="#/admin" class="text-indigo-400 underline">后台</a> 添加内容。
    </div>

    <template v-else>
      <!-- 题目图片（始终展示） -->
      <img :src="currentExercise.questionImg" alt="题目" class="w-full rounded-lg" />

      <!-- 答案图片 -->
      <img
        v-if="showAnswer"
        :src="currentExercise.answerImg"
        alt="答案"
        class="w-full rounded-lg"
      />

      <!-- 音频播放器 -->
      <div v-if="hasAudio" class="space-y-2">
        <audio
          ref="audioEl"
          :src="currentExercise.audioSrc"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
          @ended="onEnded"
        />
        <div class="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-indigo-500 transition-all duration-100"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
        <p class="text-xs text-gray-600 text-center">
          {{ isPlaying ? '▶ 播放中' : '⏸ 已暂停' }} ·
          空格 播放/暂停 · ← 后退 5s · → 前进 5s
        </p>
      </div>

      <!-- 听力原文 -->
      <img
        v-if="hasScript && showScript"
        :src="currentExercise.scriptImg"
        alt="听力原文"
        class="w-full rounded-lg"
      />

      <!-- 操作提示 + 翻页 -->
      <div class="flex items-center justify-between text-xs text-gray-600 pt-2">
        <button
          class="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30"
          :disabled="exerciseIndex === 0"
          @click="prevExercise"
        >← 上一题</button>
        <span>Z 答案 · X 原文 · Tab 下一题</span>
        <button
          class="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30"
          :disabled="exerciseIndex === exerciseList.length - 1"
          @click="nextExercise"
        >下一题 →</button>
      </div>
    </template>
  </div>
</template>
