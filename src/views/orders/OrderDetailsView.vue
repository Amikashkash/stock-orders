<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-right" variant="text" to="/orders/history" class="me-2" />
      <div class="flex-grow-1">
        <div class="text-h6 font-weight-bold">{{ order?.displayId }}</div>
        <div class="text-body-2 text-medium-emphasis">{{ order?.storeName }}</div>
      </div>
      <OrderStatusChip v-if="order" :status="order.status" />
    </div>

    <v-card rounded="xl" class="mb-4" elevation="1">
      <v-card-text class="pa-4">
        <div class="text-body-2 text-medium-emphasis mb-1">הוזמן ע"י: <strong>{{ order?.createdByName }}</strong></div>
        <div class="text-body-2 text-medium-emphasis mb-1">תאריך הזמנה: {{ formatDate(order?.createdAt) }}</div>
        <div v-if="order?.pickedAt" class="text-body-2 text-medium-emphasis">תאריך ליקוט: {{ formatDate(order?.pickedAt) }}</div>
        <div v-if="order?.notes" class="mt-3 pa-2 bg-grey-lighten-4 rounded text-body-2">
          📝 {{ order.notes }}
        </div>
        <div v-if="order?.pickingNotes" class="mt-2 pa-2 bg-blue-lighten-5 rounded text-body-2">
          📋 הערות ליקוט: {{ order.pickingNotes }}
        </div>
      </v-card-text>
    </v-card>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-subtitle-2 font-weight-bold">פריטים ({{ items.length }})</div>
        <v-btn-toggle v-model="sortBy" density="compact" variant="outlined" color="primary" mandatory>
          <v-btn value="brand" size="small">מותג</v-btn>
          <v-btn value="name" size="small">שם</v-btn>
        </v-btn-toggle>
      </div>

      <v-card
        v-for="item in sortedItems"
        :key="item.id"
        rounded="xl"
        class="mb-3"
        :color="order?.status === 'picked' && item.quantityPicked > 0 ? 'green-lighten-5' : 'white'"
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
              <div class="text-subtitle-2 font-weight-bold">{{ item.product?.name || item.productId }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ item.product?.brand }}
                <span v-if="item.product?.weight?.value"> · <strong>{{ item.product.weight.value }}{{ item.product.weight.unit }}</strong></span>
              </div>
              <div class="text-body-2 mt-1">
                הוזמן: <strong>{{ item.quantityOrdered }}</strong>
                <span v-if="item.orderType === 'package'" class="text-caption text-medium-emphasis"> ({{ item.packagesOrdered }} מארז)</span>
              </div>
              <div v-if="order?.status === 'picked'" class="text-body-2">
                נלקח: <strong>{{ item.quantityPicked ?? 0 }}</strong>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <div v-if="items.length === 0" class="text-center py-8 text-medium-emphasis">
        <v-icon size="48" class="mb-2">mdi-package-variant-closed</v-icon>
        <div>אין פריטים בהזמנה</div>
      </div>
    </template>

    <ImageLightbox ref="lightbox" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'
import { db } from '@/firebase'
import OrderStatusChip from '@/components/orders/OrderStatusChip.vue'
import ImageLightbox from '@/components/common/ImageLightbox.vue'

const route = useRoute()
const router = useRouter()

const orderId = route.params.id
const order = ref(null)
const items = ref([])
const sortBy = ref('brand')
const loading = ref(true)
const lightbox = ref(null)

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const sortedItems = computed(() =>
  [...items.value].sort((a, b) => {
    const keyA = sortBy.value === 'brand' ? (a.product?.brand || '') : (a.product?.name || '')
    const keyB = sortBy.value === 'brand' ? (b.product?.brand || '') : (b.product?.name || '')
    return keyA.localeCompare(keyB, 'he')
  })
)

onMounted(async () => {
  const orderSnap = await getDoc(doc(db, 'orders', orderId))
  if (!orderSnap.exists()) { router.push('/orders/history'); return }
  order.value = { id: orderSnap.id, ...orderSnap.data() }

  const itemsSnap = await getDocs(collection(db, 'orders', orderId, 'orderItems'))
  const productCache = {}

  items.value = await Promise.all(
    itemsSnap.docs.map(async (d) => {
      const data = { id: d.id, ...d.data() }
      if (!productCache[data.productId]) {
        const pSnap = await getDoc(doc(db, 'products', data.productId))
        productCache[data.productId] = pSnap.exists() ? { id: pSnap.id, ...pSnap.data() } : null
      }
      return { ...data, product: productCache[data.productId] }
    })
  )
  loading.value = false
})
</script>
