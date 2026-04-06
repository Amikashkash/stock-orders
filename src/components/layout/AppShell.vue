<template>
  <v-app :theme="'warehouse'" style="font-family: Heebo, sans-serif;">

    <!-- App Bar — always visible -->
    <v-app-bar elevation="1" color="white">
      <v-app-bar-nav-icon @click="toggleDrawer" />
      <v-app-bar-title class="font-weight-bold text-primary">ניהול מחסן</v-app-bar-title>
      <template #append>
        <span class="text-body-2 text-medium-emphasis me-2 d-none d-sm-inline">{{ authStore.displayName }}</span>
        <v-btn icon="mdi-logout" variant="text" color="error" class="me-2" title="התנתק" @click="handleSignOut" />
      </template>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-model="drawer"
      :temporary="isMobile"
      :permanent="!isMobile"
      :rail="!isMobile && rail"
      :location="'right'"
      color="white"
      elevation="2"
    >
      <v-list-item
        prepend-icon="mdi-warehouse"
        title="ניהול מחסן"
        :subtitle="(!isMobile && !rail) ? authStore.displayName : undefined"
        nav
        class="py-3"
      >
        <template v-if="!isMobile" #append>
          <v-btn
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            variant="text"
            size="small"
            @click="rail = !rail"
          />
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
          @click="isMobile && (drawer = false)"
        >
          <template v-if="item.badge && item.badge > 0" #append>
            <v-badge :content="item.badge" color="error" inline />
          </template>
        </v-list-item>
      </v-list>

      <template #append>
        <v-divider />
        <div class="pa-3">
          <div v-if="!rail || isMobile" class="text-caption text-medium-emphasis mb-2 px-1">
            {{ authStore.displayName }}
          </div>
          <v-btn
            block
            variant="tonal"
            color="error"
            :prepend-icon="(rail && !isMobile) ? undefined : 'mdi-logout'"
            :icon="(rail && !isMobile) ? 'mdi-logout' : undefined"
            rounded="lg"
            @click="handleSignOut"
          >
            <span v-if="!rail || isMobile">התנתק</span>
          </v-btn>
        </div>
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
import { useDisplay } from 'vuetify'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOrdersStore } from '@/stores/orders'

const authStore = useAuthStore()
const ordersStore = useOrdersStore()
const router = useRouter()
const { mobile } = useDisplay()

const isMobile = computed(() => mobile.value)
const drawer = ref(true)
const rail = ref(false)

function toggleDrawer() {
  if (isMobile.value) {
    drawer.value = !drawer.value
  } else {
    rail.value = !rail.value
  }
}

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
    items.push({ name: 'admin-users', title: 'ניהול משתמשים', icon: 'mdi-account-group', to: '/admin/users' })
  }

  return items
})

async function handleSignOut() {
  await authStore.signOut()
  router.push('/auth')
}
</script>
