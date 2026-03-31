<template>
  <v-snackbar
    v-model="notify.snackbar.show"
    :color="notify.snackbar.color"
    :timeout="notify.snackbar.timeout"
    location="bottom center"
    rounded="lg"
    elevation="6"
  >
    {{ notify.snackbar.message }}
    <template #actions>
      <v-btn icon="mdi-close" size="small" variant="text" @click="notify.snackbar.show = false" />
    </template>
  </v-snackbar>
</template>

<script setup>
import { useNotificationStore } from '@/stores/notifications'
const notify = useNotificationStore()
</script>
