<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ── 数据 ──────────────────────────────────────────────
const units = ref([])       // 从 KV 加载的全量数据
const currentExercise = ref(null)
const exerciseList = ref([])
const exerciseIndex = ref(0)

// ── 图片显隐状态 ──────────────────────────────────────
const showAnswer = ref(false)
const showScript = ref(false)

// ── 音频 ──────────────────────────────────────────────
const audio = ref(null)     // HTMLAudioElement
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const hasAudio = computed(() => !!currentExercise.value?.audioSrc)
const hasScript = computed(() => !!currentExercise.value?.scriptImg)

// ── 键盘快捷键 ────────────────────────────────────────
function handleKey(e) {
  const tag = e.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.code === 'Space') {
    e.preventDefault()
    togglePlay()
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault()
    seek(-5)
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    seek(5)
  } else if (e.code === 'KeyZ') {
    e.preventDefault()
    showAnswer.value = !showAnswer.value
  } else if (e.code === 'KeyX') {
    e.preventDefault()
    showScript.value = !showScript.value
  } else if (e.code === 'Tab') {
    e.preventDefault()
    nextExercise()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKey)
  // TODO: 从 Cloudflare KV API 加载数据
})
onUnmounted(() => window.removeEventListener('keydown', handleKey))

// ── 音频操作 ──────────────────────────────────────────
function togglePlay() {
  if (!audio.value) return
  isPlaying.value ? audio.value.pause() : audio.value.play()
  isPlaying.value = !isPlaying.value
}
function seek(delta) {
  if (!audio.value) return
  audio.value.currentTime = Math.min(
    Math.max(audio.value.currentTime + delta, 0),
    audio.value.duration || 0
  )
}
function onTimeUpdate() {
  currentTime.value = audio.value?.currentTime ?? 0
}
function onLoadedMetadata() {
  duration.value = audio.value?.duration ?? 0
}

// ── 练习切换 ──────────────────────────────────────────
function nextExercise() {
  if (exerciseIndex.value < exerciseList.value.length - 1) {
    exerciseIndex.value++
    currentExercise.value = exerciseList.value[exerciseIndex.value]
    showAnswer.value = false
    showScript.value = false
    isPlaying.value = false
  }
}

const progressPercent = computed(() =>
  duration.value ? (currentTime.value / duration.value) * 100 : 0
)
</script>

<template>
  <div class="max-w-4xl mx-auto p-6 space-y-6">
    <!-- 占位提示，数据加载前展示 -->
    <div v-if="!currentExercise" class="text-center text-gray-500 py-24">
      暂无练习数据，请前往
      <a href="#/admin" class="text-indigo-400 underline">后台</a> 添加内容。
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
          ref="audio"
          :src="currentExercise.audioSrc"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
          @ended="isPlaying = false"
        />
        <!-- 进度条 -->
        <div class="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-indigo-500 transition-all"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
        <!-- 控制按钮提示 -->
        <p class="text-xs text-gray-500 text-center">
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

      <!-- 操作提示 -->
      <p class="text-xs text-gray-600 text-center">
        Z 显示答案 · X 显示原文 · Tab 下一题
      </p>
    </template>
  </div>
</template>
