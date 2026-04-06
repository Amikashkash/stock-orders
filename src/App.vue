<template>
  <v-app :theme="'warehouse'" style="font-family: Heebo, sans-serif;">
    <RouterView />
    <AppSnackbar />
  </v-app>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppSnackbar from '@/components/common/AppSnackbar.vue'

const authStore = useAuthStore()
onMounted(() => {
  authStore.initAuth()
})
</script>
