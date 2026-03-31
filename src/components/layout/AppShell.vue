<template>
  <v-app :theme="'warehouse'" style="font-family: Heebo, sans-serif;">
    <!-- Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" :rail="rail" permanent :location="'right'" color="white" elevation="2">
      <v-list-item
        prepend-icon="mdi-warehouse"
        title="ניהול מחסן"
        nav
        class="py-4"
      >
        <template #append>
          <v-btn :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'" variant="text" @click="rail = !rail" />
        </template>
      </v-list-item>

      <v-divider />

      <v-list density="compact" nav class="mt-2">
        <v-list-item
          v-for="item in navItems"
          :key="item.name"
          :prepend-icon="item.icon"
          :title="item.title"
          :value="item.name"
          :to="item.to"
          rounded="lg"
          color="primary"
          active-color="primary"
          class="mb-1"
        >
          <template v-if="item.badge && item.badge > 0" #append>
            <v-badge :content="item.badge" color="error" inline />
          </template>
        </v-list-item>
      </v-list>

      <template #append>
        <v-divider />
        <v-list density="compact" nav class="pa-2">
          <v-list-item
            prepend-icon="mdi-logout"
            title="התנתק"
            rounded="lg"
            @click="handleSignOut"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- App Bar (mobile only) -->
    <v-app-bar elevation="1" color="white" class="d-sm-none">
      <v-app-bar-nav-icon @click="mobileDrawer = !mobileDrawer" />
      <v-app-bar-title class="font-weight-bold text-primary">ניהול מחסן</v-app-bar-title>
      <template #append>
        <span class="text-body-2 text-medium-emphasis me-3">{{ authStore.displayName }}</span>
      </template>
    </v-app-bar>

    <!-- Mobile Drawer -->
    <v-navigation-drawer v-model="mobileDrawer" temporary :location="'right'" color="white">
      <v-list-item prepend-icon="mdi-warehouse" title="ניהול מחסן" nav class="py-4" />
      <v-divider />
      <v-list density="compact" nav class="mt-2">
        <v-list-item
          v-for="item in navItems"
          :key="item.name"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
          rounded="lg"
          color="primary"
          @click="mobileDrawer = false"
        />
      </v-list>
      <template #append>
        <v-divider />
        <v-list density="compact" nav class="pa-2">
          <v-list-item prepend-icon="mdi-logout" title="התנתק" rounded="lg" @click="handleSignOut" />
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>
      <v-container fluid class="pa-4">
        <RouterView />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOrdersStore } from '@/stores/orders'

const authStore = useAuthStore()
const ordersStore = useOrdersStore()
const router = useRouter()

const drawer = ref(true)
const rail = ref(false)
const mobileDrawer = ref(false)

const navItems = computed(() => {
  const items = [
    { name: 'dashboard', title: 'דשבורד', icon: 'mdi-view-dashboard', to: '/' },
    { name: 'create-order', title: 'צור הזמנה', icon: 'mdi-plus-circle', to: '/orders/create' },
    { name: 'order-history', title: 'הזמנות שלי', icon: 'mdi-clipboard-list', to: '/orders/history' },
    { name: 'picking-orders', title: 'ליקוט הזמנות', icon: 'mdi-package-variant', to: '/orders/picking', badge: ordersStore.pendingCount },
    { name: 'sales-stats', title: 'סטטיסטיקות', icon: 'mdi-chart-bar', to: '/stats' },
  ]

  if (authStore.isAdmin) {
    items.push({ name: 'add-product', title: 'הוסף מוצר', icon: 'mdi-cube-outline', to: '/products/add' })
    items.push({ name: 'stock-history-global', title: 'היסטוריית מלאי', icon: 'mdi-history', to: '/stock/history' })
  }

  return items
})

async function handleSignOut() {
  await authStore.signOut()
  router.push('/auth')
}
</script>
