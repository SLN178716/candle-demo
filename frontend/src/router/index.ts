import { createRouter, createWebHistory } from 'vue-router'
import AppContainer from '../components/AppContainer.vue'
import HomeView from '../views/HomeView.vue'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppContainer,
      children: [
        {
          path: '',
          name: 'home',
          component: HomeView,
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
        },
      ],
    },
  ],
})

export default router
