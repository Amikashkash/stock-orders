<template>
  <v-dialog v-model="dialog" max-width="400" persistent>
    <v-card rounded="lg">
      <v-card-title class="text-h6 pt-4 pb-2">{{ title }}</v-card-title>
      <v-card-text>{{ message }}</v-card-text>
      <v-card-actions class="pa-4 pt-0">
        <v-spacer />
        <v-btn variant="text" @click="cancel">ביטול</v-btn>
        <v-btn :color="confirmColor" variant="elevated" @click="confirm">{{ confirmText }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue'

const dialog = ref(false)
const title = ref('')
const message = ref('')
const confirmText = ref('אישור')
const confirmColor = ref('primary')
let resolveFn = null

function open(opts = {}) {
  title.value = opts.title || 'אישור'
  message.value = opts.message || 'האם אתה בטוח?'
  confirmText.value = opts.confirmText || 'אישור'
  confirmColor.value = opts.confirmColor || 'primary'
  dialog.value = true
  return new Promise((resolve) => { resolveFn = resolve })
}

function confirm() { dialog.value = false; resolveFn?.(true) }
function cancel() { dialog.value = false; resolveFn?.(false) }

defineExpose({ open })
</script>
