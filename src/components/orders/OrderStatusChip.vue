<template>
  <v-chip :color="color" size="small" variant="tonal">{{ text }}</v-chip>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ status: { type: String, default: '' } })

const color = computed(() => ({
  pending: 'warning',
  'in-progress': 'info',
  picked: 'success',
  draft: 'grey',
}[props.status] || 'grey'))

const text = computed(() => ({
  pending: 'ממתין לליקוט',
  'in-progress': 'בתהליך ליקוט',
  picked: 'הושלם',
  draft: 'טיוטה',
}[props.status] || props.status))
</script>
