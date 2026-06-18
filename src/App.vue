<script setup>
import { ref } from 'vue'
import UserDashboard from './components/UserDashboard.vue'
import AdminPanel from './components/AdminPanel.vue'

// 通过 URL hash 简单路由：#/admin 进后台，其余默认前台
const isAdmin = ref(location.hash === '#/admin')
window.addEventListener('hashchange', () => {
  isAdmin.value = location.hash === '#/admin'
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <AdminPanel v-if="isAdmin" />
    <UserDashboard v-else />
  </div>
</template>
