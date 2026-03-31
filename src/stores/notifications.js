import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotificationStore = defineStore('notifications', () => {
  const snackbar = ref({
    show: false,
    message: '',
    color: 'success',
    timeout: 4000,
  })

  function show(message, color = 'success', timeout = 4000) {
    snackbar.value = { show: true, message, color, timeout }
  }

  const showSuccess = (msg) => show(msg, 'success')
  const showError = (msg) => show(msg, 'error', 6000)
  const showInfo = (msg) => show(msg, 'info')
  const showWarning = (msg) => show(msg, 'warning')

  return { snackbar, showSuccess, showError, showInfo, showWarning }
})
