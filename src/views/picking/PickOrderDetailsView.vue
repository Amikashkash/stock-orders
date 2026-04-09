<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-right" variant="text" :to="'/orders/picking'" class="me-2" />
      <div>
        <div class="text-h6 font-weight-bold">{{ order?.displayId }}</div>
        <div class="text-body-2 text-medium-emphasis">{{ order?.storeName }}</div>
      </div>
    </div>

    <!-- Progress bar -->
    <v-card rounded="xl" class="mb-4 pa-4" color="blue-lighten-5" flat>
      <div class="d-flex justify-space-between mb-2">
        <span class="text-body-2 font-weight-medium">התקדמות ליקוט</span>
        <span class="text-body-2">{{ pickedCount }} / {{ items.length }}</span>
      </div>
      <v-progress-linear :model-value="progressPercent" color="primary" rounded height="10" />
    </v-card>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <!-- Sorting -->
      <div class="d-flex gap-2 mb-4 flex-wrap">
        <v-btn-toggle v-model="sortBy" density="compact" variant="outlined" color="primary" mandatory>
          <v-btn value="brand" size="small">מותג</v-btn>
          <v-btn value="name" size="small">שם</v-btn>
        </v-btn-toggle>
      </div>

      <!-- Items -->
      <v-card
        v-for="item in sortedItems"
        :key="item.id"
        rounded="xl"
        class="mb-3"
        :color="item.status === 'picked' ? 'green-lighten-5' : 'white'"
        elevation="1"
      >
        <v-card-text class="pa-4">
          <div class="d-flex align-start gap-3">
            <v-img
              :src="item.product?.imageUrl || ''"
              width="60"
              height="60"
              cover
              rounded="lg"
              class="flex-shrink-0 bg-grey-lighten-4"
              style="cursor: zoom-in;"
              @click="lightbox.show(item.product?.imageUrl, item.product?.name)"
            />
            <div class="flex-grow-1">
              <div class="text-subtitle-2 font-weight-bold">
                {{ item.product?.name || item.productId }}
                <span v-if="item.product?.weight?.value" class="text-caption text-medium-emphasis font-weight-regular"> · {{ item.product.weight.value }}{{ item.product.weight.unit }}</span>
              </div>
              <div class="text-caption text-medium-emphasis">{{ item.product?.brand }}</div>
              <div class="text-body-2 mt-1">
                הוזמן: <strong>{{ item.quantityOrdered }}</strong>
                <span v-if="item.orderType === 'package'" class="text-caption"> ({{ item.packagesOrdered }} מארז)</span>
              </div>
            </div>
            <div class="d-flex flex-column align-center gap-2">
              <v-checkbox
                v-model="item.isPicked"
                hide-details
                density="compact"
                color="success"
                @change="onPickedToggle(item)"
              />
              <div class="d-flex align-center gap-1">
                <v-btn icon="mdi-minus" size="x-small" variant="tonal" :disabled="item.quantityPicked <= 0" @click="item.quantityPicked--" />
                <span class="text-body-2 font-weight-bold px-1">{{ item.quantityPicked }}</span>
                <v-btn icon="mdi-plus" size="x-small" variant="tonal" :disabled="item.quantityPicked >= item.quantityOrdered" @click="item.quantityPicked++" />
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Notes -->
      <v-textarea v-model="pickingNotes" label="הערות ליקוט" rows="2" class="mt-4 mb-24" />
    </template>

    <!-- FAB -->
    <v-btn
      position="fixed"
      location="bottom center"
      size="large"
      color="success"
      rounded="xl"
      elevation="8"
      class="mb-6 px-6"
      :loading="completing"
      :disabled="pickedCount === 0"
      @click="handleComplete"
    >
      <v-icon start>mdi-check-all</v-icon>
      סיים ליקוט
      <v-chip v-if="pickedCount > 0" size="x-small" color="white" class="ms-2">
        {{ pickedCount }}/{{ items.length }}
      </v-chip>
    </v-btn>

    <ConfirmDialog ref="confirmRef" />
    <ImageLightbox ref="lightbox" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useOrdersStore } from '@/stores/orders'
import { useNotificationStore } from '@/stores/notifications'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ImageLightbox from '@/components/common/ImageLightbox.vue'

const lightbox = ref(null)

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const ordersStore = useOrdersStore()
const notify = useNotificationStore()
const confirmRef = ref(null)

const orderId = route.params.id
const order = ref(null)
const items = ref([])
const pickingNotes = ref('')
const sortBy = ref('brand')
const loading = ref(true)
const completing = ref(false)

const sortedItems = computed(() => {
  return [...items.value].sort((a, b) => {
    const key = sortBy.value === 'brand' ? (a.product?.brand || '') : (a.product?.name || '')
    const keyB = sortBy.value === 'brand' ? (b.product?.brand || '') : (b.product?.name || '')
    return key.localeCompare(keyB, 'he')
  })
})

const pickedCount = computed(() => items.value.filter((i) => i.isPicked).length)
const progressPercent = computed(() => items.value.length ? (pickedCount.value / items.value.length) * 100 : 0)

function onPickedToggle(item) {
  if (item.isPicked) {
    item.quantityPicked = item.quantityOrdered
    item.status = 'picked'
  } else {
    item.quantityPicked = 0
    item.status = 'pending'
  }
}

onMounted(async () => {
  const orderSnap = await getDoc(doc(db, 'orders', orderId))
  if (!orderSnap.exists()) { router.push('/orders/picking'); return }
  order.value = { id: orderSnap.id, ...orderSnap.data() }
  pickingNotes.value = order.value.pickingNotes || ''

  const itemsSnap = await getDocs(collection(db, 'orders', orderId, 'orderItems'))
  const productCache = {}

  items.value = await Promise.all(
    itemsSnap.docs.map(async (d) => {
      const data = { id: d.id, ...d.data() }
      if (!productCache[data.productId]) {
        const pSnap = await getDoc(doc(db, 'products', data.productId))
        productCache[data.productId] = pSnap.exists() ? { id: pSnap.id, ...pSnap.data() } : null
      }
      return {
        ...data,
        product: productCache[data.productId],
        currentStock: productCache[data.productId]?.stockQuantity ?? null,
        quantityPicked: data.quantityPicked || 0,
        isPicked: data.status === 'picked',
      }
    })
  )
  loading.value = false
})

async function handleComplete() {
  const confirmed = await confirmRef.value.open({
    title: 'סיום ליקוט',
    message: 'האם לסיים את הליקוט ולעדכן את המלאי?',
    confirmText: 'סיים',
    confirmColor: 'success',
  })
  if (!confirmed) return

  completing.value = true
  try {
    await ordersStore.completePicking(orderId, items.value, pickingNotes.value, authStore)
    notify.showSuccess('הליקוט הושלם!')
    router.push('/orders/picking')
  } catch (err) {
    notify.showError('שגיאה: ' + err.message)
  } finally {
    completing.value = false
  }
}
</script>
