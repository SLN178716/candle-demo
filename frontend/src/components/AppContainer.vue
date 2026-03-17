<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { House, DataAnalysis } from '@element-plus/icons-vue'
import { routes } from '../router'

const route = useRoute()

const menuItems = computed(() => {
  const rootRoute = routes.find((item) => item.path === '/')
  const children = rootRoute?.children ?? []
  return children.map((item) => {
    const rawPath = typeof item.path === 'string' ? item.path : ''
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`.replace('//', '/')
    const title = typeof item.meta?.title === 'string' ? item.meta.title : String(item.name ?? path)
    const iconName = typeof item.meta?.icon === 'string' ? item.meta.icon : 'House'
    const icon = iconName === 'DataAnalysis' ? DataAnalysis : House
    return {
      path: path === '/' ? '/' : path.replace(/\/+$/, ''),
      title,
      icon,
    }
  })
})

const activeMenu = computed(() => {
  const matched = menuItems.value.find(
    (item) => route.path === item.path || route.path.startsWith(`${item.path}/`),
  )
  return matched?.path ?? route.path
})
</script>

<template>
  <el-container class="app-container">
    <el-aside width="220px" class="app-aside">
      <div class="logo">Candle Demo</div>
      <el-menu :default-active="activeMenu" router>
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main class="app-main">
      <RouterView />
    </el-main>
  </el-container>
</template>

<style lang="scss" scoped>
// SCSS 变量定义
$border-color: var(--el-border-color);
$bg-color-page: var(--el-bg-color-page);

.app-container {
  height: 100vh;
}

.app-aside {
  height: 100%;
  border-right: 1px solid $border-color;
  background-color: $bg-color-page;
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 18px;
  font-weight: 600;
  border-bottom: 1px solid $border-color;
}

.app-main {
  height: 100%;
  background-color: $bg-color-page;
}
</style>
