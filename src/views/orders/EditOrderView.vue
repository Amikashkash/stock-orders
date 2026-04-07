<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-right" variant="text" :to="'/orders/history'" class="me-2" />
      <div class="text-h6 font-weight-bold">עריכת הזמנה {{ orderId }}</div>
    </div>

    <div v-if="loadingOrder" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <!-- Search & filter -->
      <v-row dense class="mb-4">
        <v-col cols="12" sm="6">
          <v-text-field v-model="search" label="חיפוש מוצר..." prepend-inner-icon="mdi-magnify" clearable hide-details density="compact" />
        </v-col>
        <v-col cols="6" sm="3">
          <v-select v-model="categoryFilter" :items="[{ title: 'כל הקטגוריות', value: '' }, ...CATEGORIES.map(c => ({ title: c, value: c })), { title: 'ללא קטגוריה', value: '__none__' }]" label="קטגוריה" hide-details density="compact" />
        </v-col>
        <v-col cols="6" sm="3">
          <v-select v-model="brandFilter" :items="[{ title: 'כל המותגים', value: '' }, ...availableBrands.map(b => ({ title: b, value: b }))]" label="מותג" hide-details density="compact" />
        </v-col>
      </v-row>

      <v-row class="mb-6">
        <v-col v-for="product in visibleProducts" :key="product.id" cols="6" sm="4" md="3" lg="2">
          <ProductCardOrder
            :product="product"
            :qty="cartStore.getQuantity(product.id)"
            :is-package="cartStore.isPackageModeOn(product.id)"
            @increase="cartStore.add(product.id, 1)"
            @decrease="cartStore.remove(product.id, 1)"
            @toggle-package="cartStore.togglePackageMode(product.id)"
            @image-click="p => lightbox.show(p.imageUrl, p.name)"
          />
        </v-col>
      </v-row>

      <v-row class="mb-24">
        <v-col cols="12" md="6">
          <CartSummary @clear="cartStore.clear()" />
          <v-textarea v-model="notes" label="הערות למלקט" rows="3" class="mt-4" />
        </v-col>
      </v-row>
    </template>

    <ImageLightbox ref="lightbox" />

    <!-- FAB -->
    <v-btn
      position="fixed"
      location="bottom center"
      size="large"
      color="primary"
      rounded="xl"
      elevation="8"
      class="mb-6 px-6"
      :loading="saving"
      :disabled="cartStore.totalItems === 0"
      @click="handleSave"
    >
      <v-icon start>mdi-check-circle</v-icon>
      עדכן הזמנה
    </v-btn>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import { useCartStore } from '@/stores/cart'
import { useProductsStore } from '@/stores/products'
import { useOrdersStore } from '@/stores/orders'
import { useNotificationStore } from '@/stores/notifications'
import { CATEGORIES } from '@/config/categories'
import ProductCardOrder from '@/components/products/ProductCardOrder.vue'
import CartSummary from '@/components/orders/CartSummary.vue'
import ImageLightbox from '@/components/common/ImageLightbox.vue'

const lightbox = ref(null)

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()
const productsStore = useProductsStore()
const ordersStore = useOrdersStore()
const notify = useNotificationStore()
const orderId = route.params.id

const search = ref('')
const categoryFilter = ref('')
const brandFilter = ref('')
const notes = ref('')
const loadingOrder = ref(true)
const saving = ref(false)

watch(categoryFilter, () => { brandFilter.value = '' })

const availableBrands = computed(() => {
  if (!categoryFilter.value) return productsStore.brands
  return productsStore.brandsByCategory[categoryFilter.value] || []
})

const visibleProducts = computed(() => {
  let list = productsStore.products.filter((p) => !p.isHidden)
  if (categoryFilter.value === '__none__') list = list.filter((p) => !p.category)
  else if (categoryFilter.value) list = list.filter((p) => p.category === categoryFilter.value)
  if (brandFilter.value) list = list.filter((p) => p.brand === brandFilter.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter((p) => (p.name || '').toLowerCase().includes(q))
  }
  return list
})

onMounted(async () => {
  productsStore.startListener()
  cartStore.initialize('edit', orderId)
  const itemsSnap = await getDocs(collection(db, 'orders', orderId, 'orderItems'))
  cartStore.loadFromOrderItems(itemsSnap.docs.map((d) => d.data()))
  loadingOrder.value = false
})

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
    await ordersStore.updateOrder(orderId, cartStore, notes.value)
    notify.showSuccess('ההזמנה עודכנה!')
    router.push('/orders/history')
  } catch (err) {
    notify.showError('שגיאה: ' + err.message)
  } finally {
    saving.value = false
  }
}
</script>
