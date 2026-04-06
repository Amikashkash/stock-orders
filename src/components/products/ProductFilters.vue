<template>
  <v-row dense class="mb-4">
    <v-col cols="12" sm="5">
      <v-text-field
        :model-value="filters.search"
        label="חיפוש מוצר..."
        prepend-inner-icon="mdi-magnify"
        clearable
        hide-details
        density="compact"
        @update:model-value="productsStore.setFilter('search', $event || '')"
      />
    </v-col>
    <v-col cols="6" sm="3">
      <v-select
        :model-value="filters.brand"
        :items="[{ title: 'כל המותגים', value: '' }, ...brands.map(b => ({ title: b, value: b }))]"
        label="מותג"
        hide-details
        density="compact"
        @update:model-value="productsStore.setFilter('brand', $event)"
      />
    </v-col>
    <v-col cols="6" sm="3">
      <v-select
        :model-value="filters.stock"
        :items="stockItems"
        label="רמת מלאי"
        hide-details
        density="compact"
        @update:model-value="productsStore.setFilter('stock', $event)"
      />
    </v-col>
    <v-col v-if="showHiddenToggle" cols="12" sm="1" class="d-flex align-center">
      <v-switch
        :model-value="filters.showHidden"
        label="הצג מוסתרים"
        hide-details
        density="compact"
        color="primary"
        @update:model-value="productsStore.setFilter('showHidden', $event)"
      />
    </v-col>
  </v-row>
</template>

<script setup>
import { computed } from 'vue'
import { useProductsStore } from '@/stores/products'

defineProps({ showHiddenToggle: { type: Boolean, default: false } })

const productsStore = useProductsStore()
const filters = computed(() => productsStore.filters)
const brands = computed(() => productsStore.brands)

const stockItems = [
  { title: 'כל המלאי', value: '' },
  { title: 'נמוך (≤5)', value: 'low' },
  { title: 'בינוני (6-20)', value: 'medium' },
  { title: 'גבוה (>20)', value: 'high' },
]
</script>
