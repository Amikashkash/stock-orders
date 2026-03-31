<template>
  <v-card rounded="xl" color="grey-lighten-5" flat class="pa-4">
    <div class="d-flex align-center justify-space-between mb-3">
      <div class="text-subtitle-1 font-weight-bold">סיכום עגלה</div>
      <v-btn size="x-small" variant="text" color="error" @click="emit('clear')">רוקן עגלה</v-btn>
    </div>

    <div v-if="cartStore.itemList.length === 0" class="text-center py-6 text-medium-emphasis">
      <v-icon size="40" class="mb-2">mdi-cart-outline</v-icon>
      <div class="text-body-2">העגלה ריקה</div>
    </div>

    <v-list v-else density="compact" class="bg-transparent pa-0">
      <v-list-item
        v-for="{ productId, qty, isPackage } in cartStore.itemList"
        :key="productId"
        class="px-0"
      >
        <template #title>
          <span class="text-body-2">{{ getProductName(productId) }}</span>
        </template>
        <template #append>
          <v-chip size="x-small" :color="isPackage ? 'secondary' : 'primary'" variant="tonal">
            {{ qty }} {{ isPackage ? 'מארז' : "יח'" }}
          </v-chip>
        </template>
      </v-list-item>
    </v-list>

    <v-divider v-if="cartStore.itemList.length > 0" class="my-3" />

    <div v-if="cartStore.itemList.length > 0" class="d-flex justify-space-between text-body-2">
      <span>{{ cartStore.totalItems }} פריטים</span>
      <span>{{ cartStore.totalQuantity }} יחידות</span>
    </div>
  </v-card>
</template>

<script setup>
import { useCartStore } from '@/stores/cart'
import { useProductsStore } from '@/stores/products'

const emit = defineEmits(['clear'])
const cartStore = useCartStore()
const productsStore = useProductsStore()

function getProductName(productId) {
  return productsStore.getById(productId)?.name || productId
}
</script>
