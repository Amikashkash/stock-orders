<template>
  <div>
    <div class="text-h6 font-weight-bold mb-4">ליקוט הזמנות</div>

    <div v-if="ordersStore.pickingOrders.length === 0" class="text-center py-12 text-medium-emphasis">
      <v-icon size="64" class="mb-4">mdi-package-variant-closed</v-icon>
      <div>אין הזמנות ממתינות לליקוט</div>
    </div>

    <v-card
      v-for="order in ordersStore.pickingOrders"
      :key="order.id"
      rounded="xl"
      class="mb-3"
      elevation="1"
      hover
      :to="`/orders/${order.id}/pick`"
    >
      <v-card-text class="pa-4">
        <div class="d-flex justify-space-between align-start">
          <div>
            <div class="text-subtitle-1 font-weight-bold mb-1">{{ order.displayId }}</div>
            <div class="text-body-2 text-medium-emphasis">חנות: {{ order.storeName }}</div>
            <div class="text-caption text-medium-emphasis">{{ formatDate(order.createdAt) }}</div>
            <div v-if="order.notes" class="text-caption mt-1 pa-2 bg-grey-lighten-5 rounded">📝 {{ order.notes }}</div>
          </div>
          <OrderStatusChip :status="order.status" />
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useOrdersStore } from '@/stores/orders'
import OrderStatusChip from '@/components/orders/OrderStatusChip.vue'

const ordersStore = useOrdersStore()

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => ordersStore.startPickingListener())
onUnmounted(() => ordersStore.stopListeners())
</script>
