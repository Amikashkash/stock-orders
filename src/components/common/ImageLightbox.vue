<template>
  <v-dialog v-model="open" max-width="600" :scrim="true">
    <v-card rounded="xl" class="pa-2" style="background: #000;">
      <v-btn
        icon="mdi-close"
        variant="text"
        color="white"
        size="small"
        class="position-absolute top-0 end-0 ma-2"
        style="z-index:1"
        @click="open = false"
      />
      <v-img
        :src="src"
        max-height="80vh"
        contain
        style="border-radius: 12px;"
      >
        <template #error>
          <div class="d-flex align-center justify-center" style="height:300px">
            <v-icon size="64" color="grey">mdi-image-off</v-icon>
          </div>
        </template>
      </v-img>
      <div v-if="title" class="text-center text-white text-subtitle-2 py-2">{{ title }}</div>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue'

const open = ref(false)
const src = ref('')
const title = ref('')

function show(imageSrc, imageTitle = '') {
  src.value = imageSrc
  title.value = imageTitle
  open.value = true
}

defineExpose({ show })
</script>
