<template>
  <v-chip
    v-if="isNew"
    color="success"
    size="x-small"
    density="comfortable"
    class="font-weight-bold"
  >
    חדש
  </v-chip>
  <v-chip
    v-else-if="isRestocked"
    color="info"
    size="x-small"
    density="comfortable"
    class="font-weight-bold"
  >
    חודש מלאי
  </v-chip>
</template>

<script setup>
const props = defineProps({
  isNew: Boolean,
  isRestocked: Boolean,
})
</script>
