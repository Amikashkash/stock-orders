<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-1">
      <span class="text-caption text-medium-emphasis">מלאי: <strong>{{ stock }}</strong> {{ unit }}</span>
      <span class="text-caption" :class="levelColor">{{ levelText }}</span>
    </div>
    <v-progress-linear
      :model-value="percent"
      :color="progressColor"
      rounded
      height="6"
      bg-color="grey-lighten-3"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stock: { type: Number, default: 0 },
  unit: { type: String, default: "יח'" },
  max: { type: Number, default: 50 },
})

const percent = computed(() => Math.min(100, (props.stock / props.max) * 100))
const level = computed(() => {
  if (props.stock <= 5) return 'low'
  if (props.stock <= 20) return 'medium'
  return 'high'
})
const progressColor = computed(() => ({ low: 'error', medium: 'warning', high: 'success' }[level.value]))
const levelColor = computed(() => ({ low: 'text-error', medium: 'text-warning', high: 'text-success' }[level.value]))
const levelText = computed(() => ({ low: 'מלאי נמוך', medium: 'מלאי בינוני', high: 'מלאי גבוה' }[level.value]))
</script>
