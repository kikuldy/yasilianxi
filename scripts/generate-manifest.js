// 扫描 public/data 目录结构，生成 public/data/manifest.json
// npm run dev 前自动执行；CI 环境跳过（使用已提交的 manifest.json）
if (process.env.CI || process.env.CF_PAGES) {
  console.log('[manifest] CI 环境，跳过生成，使用已提交的 manifest.json')
  process.exit(0)
}
import { readdirSync, statSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const dataDir = './public/data'

function ls(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => !f.startsWith('.'))
}

function isDir(p) {
  try { return statSync(p).isDirectory() } catch { return false }
}

const IMG = /\.(png|jpg|jpeg|webp)$/i
const AUDIO = /\.(mp3|m4a|wav|ogg)$/i

const exercises = []

const questionRoot = join(dataDir, 'question')
for (const unit of ls(questionRoot).filter(f => isDir(join(questionRoot, f)))) {
  const unitDir = join(questionRoot, unit)
  for (const part of ls(unitDir).filter(f => isDir(join(unitDir, f)))) {
    const partDir = join(unitDir, part)
    for (const exFolder of ls(partDir).filter(f => isDir(join(partDir, f)))) {

      const questionFiles = ls(join(partDir, exFolder)).filter(f => IMG.test(f)).sort()
      const answerFiles   = ls(join(dataDir, 'answer', unit, part, exFolder)).filter(f => IMG.test(f)).sort()

      const m = exFolder.match(/^(\d+)-T-(\d+)$/)
      const audioNum = m ? m[2] : null

      let audioFile  = null
      let scriptFiles = []

      if (audioNum) {
        const allAudio = ls(join(dataDir, 'listening'))
        audioFile = allAudio.find(f => new RegExp(`^listening-${audioNum}\\.`, 'i').test(f)) ?? null

        scriptFiles = ls(join(dataDir, 'listening scrpit', audioNum)).filter(f => IMG.test(f)).sort()
      }

      exercises.push({ unit, part, exFolder, questionFiles, answerFiles, audioNum, audioFile, scriptFiles })
    }
  }
}

writeFileSync(join(dataDir, 'manifest.json'), JSON.stringify({ exercises }, null, 2))
console.log(`[manifest] 已生成 ${exercises.length} 条练习记录`)
