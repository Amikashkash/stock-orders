<template>
  <v-card
    rounded="xl"
    elevation="2"
    :class="{ 'opacity-60': product.isHidden }"
    class="product-card h-100"
    hover
  >
    <!-- Badges -->
    <div class="position-absolute top-0 start-0 pa-2 d-flex gap-1" style="z-index:1">
      <ProductBadge :is-new="productsStore.isNew(product)" :is-restocked="productsStore.isRestocked(product)" />
      <v-chip v-if="product.isHidden" color="grey" size="x-small">מוסתר</v-chip>
    </div>

    <!-- Image -->
    <v-img
      :src="product.imageUrl || product.image || ''"
      height="140"
      cover
      class="bg-grey-lighten-4"
      style="cursor: zoom-in;"
      @click="emit('image-click', product)"
    >
      <template #error>
        <div class="d-flex align-center justify-center h-100">
          <v-icon size="48" color="grey-lighten-1">mdi-image-off</v-icon>
        </div>
      </template>
      <template #placeholder>
        <div class="d-flex align-center justify-center h-100">
          <v-icon size="48" color="grey-lighten-1">mdi-cube-outline</v-icon>
        </div>
      </template>
    </v-img>

    <v-card-text class="pb-2">
      <div class="text-subtitle-2 font-weight-bold text-truncate mb-1">{{ product.name }}</div>
      <div class="text-caption text-medium-emphasis mb-1">{{ product.brand }}</div>
      <div v-if="product.weight?.value" class="text-body-2 font-weight-bold mb-2">
        ⚖️ {{ product.weight.value }} {{ product.weight.unit }}
      </div>

      <StockLevelBar :stock="product.stockQuantity ?? 0" />
    </v-card-text>

    <v-card-actions class="pt-0 px-4 pb-3">
      <v-btn
        v-if="authStore.isAdmin"
        size="small"
        variant="tonal"
        color="primary"
        :to="`/products/${product.id}/edit`"
        prepend-icon="mdi-pencil"
      >
        עריכה
      </v-btn>
      <v-btn
        v-if="authStore.isAdmin"
        size="small"
        variant="tonal"
        color="secondary"
        :to="`/products/${product.id}/stock`"
        prepend-icon="mdi-plus"
      >
        הוסף מלאי
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth'
import { useProductsStore } from '@/stores/products'
import ProductBadge from './ProductBadge.vue'
import StockLevelBar from './StockLevelBar.vue'

defineProps({ product: { type: Object, required: true } })
const emit = defineEmits(['image-click'])

const authStore = useAuthStore()
const productsStore = useProductsStore()
</script>
