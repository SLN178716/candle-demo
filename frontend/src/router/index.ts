import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AppContainer from '../components/AppContainer.vue'
import HomeView from '../views/HomeView.vue'
import DashboardView from '../views/DashboardView.vue'
import NotFoundView from '../views/NotFoundView.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppContainer,
    children: [
      {
        path: '',
        name: 'home',
        component: HomeView,
        meta: {
          title: '首页',
          icon: 'House',
        },
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: DashboardView,
        meta: {
          title: '控制台',
          icon: 'DataAnalysis',
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
