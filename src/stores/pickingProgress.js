import { defineStore } from 'pinia'
import { ref } from 'vue'

const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export const usePickingProgressStore = defineStore('pickingProgress', () => {
  const progress = ref({})
  // { orderId: { items: {docId: {qty, status}}, notes, timestamp } }

  function save(orderId, items, notes) {
    progress.value[orderId] = { items, notes, timestamp: Date.now() }
  }

  function load(orderId) {
    return progress.value[orderId] || null
  }

  function clear(orderId) {
    delete progress.value[orderId]
  }

  function cleanOld() {
    const now = Date.now()
    Object.keys(progress.value).forEach((id) => {
      if (now - (progress.value[id].timestamp || 0) > MAX_AGE_MS) {
        delete progress.value[id]
      }
    })
  }

  return { progress, save, load, clear, cleanOld }
}, {
  persist: { key: 'warehouse-picking-progress', pick: ['progress'] },
})
