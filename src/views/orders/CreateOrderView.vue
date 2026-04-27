<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-right" variant="text" :to="'/'" class="me-2" />
      <div class="text-h6 font-weight-bold">הזמנה חדשה</div>
      <v-chip v-if="cartStore.totalItems > 0" color="primary" size="small" class="ms-2">
        {{ cartStore.totalItems }} פריטים
      </v-chip>
    </div>

    <!-- Search & filter -->
    <v-row dense class="mb-4">
      <v-col cols="12" sm="5">
        <v-text-field
          v-model="search"
          label="חיפוש מוצר..."
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          density="compact"
        />
      </v-col>
      <v-col cols="6" sm="3">
        <v-select
          v-model="categoryFilter"
          :items="[{ title: 'כל הקטגוריות', value: '' }, ...CATEGORIES.map(c => ({ title: c, value: c })), { title: 'ללא קטגוריה', value: '__none__' }]"
          label="קטגוריה"
          hide-details
          density="compact"
        />
      </v-col>
      <v-col cols="6" sm="4">
        <v-select
          v-model="brandFilter"
          :items="[{ title: 'כל המותגים', value: '' }, ...availableBrands.map(b => ({ title: b, value: b }))]"
          label="מותג"
          hide-details
          density="compact"
        />
      </v-col>
    </v-row>

    <!-- Sort -->
    <div class="d-flex align-center gap-2 mb-4">
      <span class="text-body-2 text-medium-emphasis">מיון:</span>
      <v-btn-toggle v-model="sortBy" density="compact" variant="outlined" color="primary" mandatory>
        <v-btn value="name" size="small">שם</v-btn>
        <v-btn value="weight-asc" size="small">משקל ↑</v-btn>
        <v-btn value="weight-desc" size="small">משקל ↓</v-btn>
      </v-btn-toggle>
    </div>

    <!-- Product grid -->
    <v-row class="mb-6">
      <v-col
        v-for="product in visibleProducts"
        :key="product.id"
        cols="6"
        sm="4"
        md="3"
        lg="2"
      >
        <ProductCardOrder
          :product="product"
          :qty="cartStore.getQuantity(product.id)"
          :is-package="cartStore.isPackageModeOn(product.id)"
          @increase="handleIncrease(product)"
          @decrease="cartStore.remove(product.id, 1)"
          @toggle-package="cartStore.togglePackageMode(product.id)"
          @image-click="p => lightbox.show(p.imageUrl, p.name)"
        />
      </v-col>
    </v-row>

    <!-- Cart summary + notes -->
    <v-row class="mb-24">
      <v-col cols="12" md="6">
        <CartSummary @clear="cartStore.clear()" />

        <v-textarea
          v-model="notes"
          label="הערות למלקט"
          rows="3"
          class="mt-4"
          placeholder="הוראות מיוחדות, החלפות מותרות..."
        />
      </v-col>
    </v-row>

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
      שמור הזמנה
      <v-chip v-if="cartStore.totalItems > 0" size="x-small" color="white" text-color="primary" class="ms-2">
        {{ cartStore.totalItems }}
      </v-chip>
    </v-btn>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useProductsStore } from '@/stores/products'
import { useOrdersStore } from '@/stores/orders'
import { useNotificationStore } from '@/stores/notifications'
import { useHaptics } from '@/composables/useHaptics'
import { CATEGORIES } from '@/config/categories'
import ProductCardOrder from '@/components/products/ProductCardOrder.vue'
import CartSummary from '@/components/orders/CartSummary.vue'
import ImageLightbox from '@/components/common/ImageLightbox.vue'

const lightbox = ref(null)

const router = useRouter()
const cartStore = useCartStore()
const productsStore = useProductsStore()
const ordersStore = useOrdersStore()
const notify = useNotificationStore()
const haptics = useHaptics()

const search = ref('')
const categoryFilter = ref('')
const brandFilter = ref('')
const sortBy = ref('name')
const notes = ref('')
const saving = ref(false)

function weightGrams(product) {
  const v = product.weight?.value
  if (!v) return Infinity
  const unit = product.weight?.unit
  if (unit === 'ק"ג' || unit === 'ל') return v * 1000
  return v
}

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
    list = list.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q))
  }
  if (sortBy.value === 'weight-asc') return [...list].sort((a, b) => weightGrams(a) - weightGrams(b))
  if (sortBy.value === 'weight-desc') return [...list].sort((a, b) => weightGrams(b) - weightGrams(a))
  return list
})

function handleIncrease(product) {
  cartStore.add(product.id, 1)
  haptics.addToCart()
}

let saveLock = false
async function handleSave() {
  if (saveLock || saving.value) return
  if (cartStore.totalItems === 0) { notify.showError('העגלה ריקה'); return }

  saveLock = true
  saving.value = true
  try {
    await ordersStore.createOrder(cartStore, notes.value)
    notify.showSuccess('ההזמנה נשמרה בהצלחה!')
    haptics.success()
    router.push('/orders/history')
  } catch (err) {
    notify.showError('שגיאה בשמירת ההזמנה: ' + err.message)
  } finally {
    saving.value = false
    saveLock = false
  }
}

onMounted(() => {
  productsStore.startListener()
  cartStore.initialize('create')
})
</script>
