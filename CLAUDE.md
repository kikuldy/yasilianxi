# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述
轻量级雅思听力备考与做题工具。解决在 PDF 题目、答案、原文、音频之间多窗口切换繁琐的痛点，通过单页集成界面实现"边看、边听、边做题"。

- **技术栈：** Vue 3 (Vite) + Tailwind CSS v4 + Cloudflare Pages / KV / R2
- **数据层级：** Unit（单元）→ Part（部分）→ Exercise（练习），完全由 Cloudflare KV 数据驱动
- **核心理念：** 纯图片 + 音频流。题目、答案、原文均为从 PDF 截取的图片，由 R2 托管；无需录入文本

## 构建与开发命令

```bash
npm run dev      # 启动本地开发服务器
npm run build    # 打包（用于 Cloudflare Pages 部署）
npm run preview  # 本地预览打包产物
npm run lint     # 代码规范检查
```

## 架构与代码规范

- **组合式 API：** 严格使用 `<script setup>` 语法，不使用 Options API
- **样式：** 100% Tailwind CSS 原子类；仅在自定义滚动条等极特殊场景才写原生 CSS
- **模块边界：** 前台做题界面（`UserDashboard.vue`）与后台配置面板（`AdminPanel.vue`）明确分离
- **路由：** 通过 URL hash 简单路由：`#/admin` 进后台，其余默认前台（`App.vue`）
- **语言：** 所有代码注释、UI 文本、Commit Message 全部使用简体中文

## KV 数据结构约定

KV 键格式：`unit:{unitId}:part:{partId}:exercise:{exerciseId}`

Exercise JSON 字段：

```json
{
  "questionImg": "https://...",
  "answerImg":   "https://...",
  "audioSrc":    "https://...",
  "scriptImg":   "https://..."
}
```

`audioSrc` 和 `scriptImg` 为可选字段，缺失时对应 UI 元素完全不渲染。

## 核心业务逻辑

### 盲操快捷键（全局键盘监听，需 preventDefault 阻止默认滚动）

| 键位 | 行为 |
|------|------|
| `Space` | 播放 / 暂停音频 |
| `ArrowLeft` | 后退 5 秒（≥ 0） |
| `ArrowRight` | 前进 5 秒（≤ 总时长） |
| `Z` | 切换显示 / 隐藏答案图片（`showAnswer`） |
| `X` | 切换显示 / 隐藏原文图片（`showScript`） |
| `Tab` | 跳转下一 Exercise，同时重置 `showAnswer = false`、`showScript = false` |

### 后台配置流

1. 表单选择 Unit / Part 层级
2. 文件上传 → 直接推送 Cloudflare R2 → 取回公共 URL（`/api/upload`）
3. 点击【保存并发布】→ 将 Exercise JSON 整块写入 Cloudflare KV（`/api/exercise`）

### 条件渲染规则

- **题目图片：** 始终展示
- **答案图片：** 受 `showAnswer` 控制
- **音频播放器 + 进度条：** 仅当 `audioSrc` 存在时渲染
- **原文按钮：** 仅当 `scriptImg` 存在时渲染
