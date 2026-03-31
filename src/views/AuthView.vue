<template>
  <v-app :theme="'warehouse'" style="font-family: Heebo, sans-serif;">
    <v-main class="d-flex align-center justify-center" style="min-height: 100vh; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);">
      <v-card width="380" rounded="xl" elevation="12" class="pa-4">
        <v-card-text class="text-center py-8">
          <v-icon size="72" color="primary" class="mb-4">mdi-warehouse</v-icon>
          <div class="text-h5 font-weight-bold mb-1">ניהול מחסן</div>
          <div class="text-body-2 text-medium-emphasis mb-8">מערכת ניהול הזמנות ומלאי</div>

          <v-btn
            size="large"
            block
            rounded="lg"
            color="white"
            class="text-none"
            elevation="2"
            :loading="loading"
            @click="handleSignIn"
          >
            <v-icon start>mdi-google</v-icon>
            התחבר עם Google
          </v-btn>

          <div v-if="error" class="mt-4 text-error text-body-2">{{ error }}</div>
        </v-card-text>
      </v-card>
    </v-main>
    <AppSnackbar />
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppSnackbar from '@/components/common/AppSnackbar.vue'

const authStore = useAuthStore()
const loading = ref(false)
const error = ref('')

async function handleSignIn() {
  loading.value = true
  error.value = ''
  try {
    await authStore.signInWithGoogle()
  } catch (e) {
    error.value = 'שגיאה בהתחברות. נסה שוב.'
    loading.value = false
  }
}
</script>
