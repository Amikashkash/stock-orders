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
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="search"
          label="חיפוש מוצר..."
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          density="compact"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-select
          v-model="brandFilter"
          :items="[{ title: 'כל המותגים', value: '' }, ...brands.map(b => ({ title: b, value: b }))]"
          label="מותג"
          hide-details
          density="compact"
        />
      </v-col>
    </v-row>

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
        />
      </v-col>
    </v-row>

    <!-- Cart summary + submit -->
    <v-row>
      <v-col cols="12" md="6">
        <CartSummary @clear="cartStore.clear()" />

        <v-textarea
          v-model="notes"
          label="הערות למלקט"
          rows="3"
          class="mt-4"
          placeholder="הוראות מיוחדות, החלפות מותרות..."
        />

        <v-btn
          color="primary"
          block
          size="large"
          class="mt-4"
          :loading="saving"
          :disabled="cartStore.totalItems === 0"
          prepend-icon="mdi-check-circle"
          @click="handleSave"
        >
          שמור הזמנה
        </v-btn>
      </v-col>
    </v-row>

    <!-- FAB for mobile -->
    <v-btn
      v-if="cartStore.totalItems > 0"
      position="fixed"
      location="bottom left"
      size="large"
      color="primary"
      rounded="xl"
      elevation="8"
      class="ma-4"
      :loading="saving"
      @click="handleSave"
    >
      <v-icon start>mdi-check</v-icon>
      שמור ({{ cartStore.totalItems }})
    </v-btn>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useProductsStore } from '@/stores/products'
import { useOrdersStore } from '@/stores/orders'
import { useNotificationStore } from '@/stores/notifications'
import { useHaptics } from '@/composables/useHaptics'
import ProductCardOrder from '@/components/products/ProductCardOrder.vue'
import CartSummary from '@/components/orders/CartSummary.vue'

const router = useRouter()
const cartStore = useCartStore()
const productsStore = useProductsStore()
const ordersStore = useOrdersStore()
const notify = useNotificationStore()
const haptics = useHaptics()

const search = ref('')
const brandFilter = ref('')
const notes = ref('')
const saving = ref(false)

const brands = computed(() => productsStore.brands)

const visibleProducts = computed(() => {
  let list = productsStore.products.filter((p) => !p.isHidden)
  if (brandFilter.value) list = list.filter((p) => p.brand === brandFilter.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q))
  }
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
