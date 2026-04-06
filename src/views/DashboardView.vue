<template>
  <div>
    <!-- Page Header -->
    <div class="d-flex align-center justify-space-between mb-6">
      <div>
        <div class="text-h5 font-weight-bold">דשבורד</div>
        <div class="text-body-2 text-medium-emphasis">שלום, {{ authStore.displayName }}</div>
      </div>
      <div class="d-flex gap-2">
        <v-btn v-if="authStore.isAdmin" color="primary" prepend-icon="mdi-cube-outline" :to="'/products/add'" variant="tonal">
          הוסף מוצר
        </v-btn>
        <v-btn color="secondary" prepend-icon="mdi-plus-circle" :to="'/orders/create'">
          צור הזמנה
        </v-btn>
      </div>
    </div>

    <!-- Stat Cards -->
    <v-row class="mb-6">
      <v-col cols="6" sm="3">
        <v-card rounded="xl" color="primary" variant="tonal" class="text-center pa-4">
          <v-icon size="32" color="primary" class="mb-2">mdi-package-variant</v-icon>
          <div class="text-h4 font-weight-bold text-primary">{{ productsStore.totalCount }}</div>
          <div class="text-caption text-medium-emphasis">סה"כ מוצרים</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card rounded="xl" color="error" variant="tonal" class="text-center pa-4">
          <v-icon size="32" color="error" class="mb-2">mdi-alert-circle</v-icon>
          <div class="text-h4 font-weight-bold text-error">{{ productsStore.lowStockCount }}</div>
          <div class="text-caption text-medium-emphasis">מלאי נמוך</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card rounded="xl" color="warning" variant="tonal" class="text-center pa-4">
          <v-icon size="32" color="warning" class="mb-2">mdi-clock-outline</v-icon>
          <div class="text-h4 font-weight-bold text-warning">{{ ordersStore.pendingCount }}</div>
          <div class="text-caption text-medium-emphasis">ממתינות לליקוט</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card rounded="xl" color="success" variant="tonal" class="text-center pa-4">
          <v-icon size="32" color="success" class="mb-2">mdi-check-circle</v-icon>
          <div class="text-h4 font-weight-bold text-success">{{ todayOrdersCount }}</div>
          <div class="text-caption text-medium-emphasis">הזמנות היום</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Filters -->
    <ProductFilters :show-hidden-toggle="authStore.isAdmin" />

    <!-- Loading -->
    <div v-if="productsStore.loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <!-- Empty State -->
    <div v-else-if="productsStore.filteredProducts.length === 0" class="text-center py-12">
      <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-cube-off</v-icon>
      <div class="text-h6 text-medium-emphasis">לא נמצאו מוצרים</div>
      <v-btn class="mt-4" variant="text" color="primary" @click="productsStore.resetFilters">נקה סינון</v-btn>
    </div>

    <!-- Product Grid -->
    <v-row v-else>
      <v-col
        v-for="product in productsStore.filteredProducts"
        :key="product.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <ProductCard :product="product" @image-click="p => lightbox.show(p.imageUrl || p.image, p.name)" />
      </v-col>
    </v-row>

    <ImageLightbox ref="lightbox" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProductsStore } from '@/stores/products'
import { useOrdersStore } from '@/stores/orders'
import ProductCard from '@/components/products/ProductCard.vue'
import ProductFilters from '@/components/products/ProductFilters.vue'
import ImageLightbox from '@/components/common/ImageLightbox.vue'

const lightbox = ref(null)

const authStore = useAuthStore()
const productsStore = useProductsStore()
const ordersStore = useOrdersStore()

const todayOrdersCount = computed(() => {
  const today = new Date()
  return ordersStore.orders.filter((o) => {
    const d = o.createdAt?.toDate?.()
    return d && d.toDateString() === today.toDateString()
  }).length
})

onMounted(() => {
  productsStore.startListener()
  ordersStore.startPickingListener()
  ordersStore.startHistoryListener()
})

onUnmounted(() => {
  productsStore.stopListener()
  ordersStore.stopListeners()
})
</script>
