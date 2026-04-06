import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/auth',
    name: 'auth',
    component: () => import('@/views/AuthView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppShell.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
      { path: 'products/add', name: 'add-product', component: () => import('@/views/products/AddProductView.vue') },
      { path: 'products/:sku/edit', name: 'edit-product', component: () => import('@/views/products/EditProductView.vue') },
      { path: 'products/:sku/stock', name: 'insert-stock', component: () => import('@/views/stock/InsertStockView.vue') },
      { path: 'products/:sku/history', name: 'stock-history', component: () => import('@/views/stock/StockHistoryView.vue') },
      { path: 'stock/history', name: 'stock-history-global', component: () => import('@/views/stock/StockHistoryView.vue'), meta: { adminOnly: true } },
      { path: 'orders/create', name: 'create-order', component: () => import('@/views/orders/CreateOrderView.vue') },
      { path: 'orders/:id/edit', name: 'edit-order', component: () => import('@/views/orders/EditOrderView.vue') },
      { path: 'orders/history', name: 'order-history', component: () => import('@/views/orders/OrderHistoryView.vue') },
      { path: 'orders/picking', name: 'picking-orders', component: () => import('@/views/orders/PickingOrdersView.vue') },
      { path: 'orders/:id/pick', name: 'pick-order', component: () => import('@/views/picking/PickOrderDetailsView.vue') },
      { path: 'stats', name: 'sales-stats', component: () => import('@/views/stats/SalesStatsView.vue') },
      { path: 'admin/users', name: 'admin-users', component: () => import('@/views/admin/AdminUsersView.vue'), meta: { adminOnly: true } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // Wait for auth to initialize on first load
  if (authStore.loading) {
    await new Promise((resolve) => {
      const unwatch = authStore.$subscribe(() => {
        if (!authStore.loading) {
          unwatch()
          resolve()
        }
      })
      // Also check immediately in case it resolved synchronously
      if (!authStore.loading) {
        unwatch()
        resolve()
      }
    })
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) return '/auth'
  if (to.meta.requiresGuest && authStore.isAuthenticated) return '/'
  if (to.meta.adminOnly && !authStore.isAdmin) return '/'
})

export default router
