<template>
  <div>
    <div class="text-h6 font-weight-bold mb-4">היסטוריית הזמנות</div>

    <div v-if="ordersStore.loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <div v-for="(group, date) in groupedOrders" :key="date" class="mb-6">
        <div class="text-subtitle-2 text-medium-emphasis mb-2 font-weight-bold">{{ date }}</div>

        <v-card
          v-for="order in group"
          :key="order.id"
          rounded="xl"
          class="mb-3"
          elevation="1"
          hover
        >
          <v-card-text class="pa-4">
            <div class="d-flex align-start justify-space-between">
              <div>
                <div class="text-subtitle-1 font-weight-bold mb-1">{{ order.displayId }}</div>
                <div class="text-body-2 text-medium-emphasis">חנות: {{ order.storeName }}</div>
                <div class="text-body-2 text-medium-emphasis">הוזמן ע"י: {{ order.createdByName }}</div>
                <div v-if="order.pickedAt" class="text-caption text-medium-emphasis">
                  הושלם: {{ formatDate(order.pickedAt) }}
                </div>
              </div>
              <div class="d-flex flex-column align-end gap-2">
                <OrderStatusChip :status="order.status" />
                <div class="d-flex gap-1">
                  <v-btn
                    v-if="canEdit(order)"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    icon="mdi-pencil"
                    :to="`/orders/${order.id}/edit`"
                  />
                  <v-btn
                    v-if="canEdit(order)"
                    size="x-small"
                    variant="tonal"
                    color="error"
                    icon="mdi-delete"
                    @click="handleDelete(order)"
                  />
                  <v-btn
                    v-if="authStore.isAdmin && order.status === 'picked'"
                    size="x-small"
                    variant="tonal"
                    color="warning"
                    icon="mdi-restore"
                    title="החיה הזמנה"
                    @click.prevent="handleRevive(order)"
                  />
                  <v-btn
                    size="x-small"
                    variant="tonal"
                    color="secondary"
                    icon="mdi-eye"
                    :to="`/orders/${order.id}/view`"
                  />
                </div>
              </div>
            </div>
            <div v-if="order.notes" class="text-caption mt-2 pa-2 bg-grey-lighten-5 rounded">
              📝 {{ order.notes }}
            </div>
          </v-card-text>
        </v-card>
      </div>

      <div v-if="ordersStore.orders.length === 0" class="text-center py-12 text-medium-emphasis">
        <v-icon size="64" class="mb-4">mdi-clipboard-text-off</v-icon>
        <div>אין הזמנות להציג</div>
      </div>
    </template>

    <ConfirmDialog ref="confirmRef" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOrdersStore } from '@/stores/orders'
import { useNotificationStore } from '@/stores/notifications'
import OrderStatusChip from '@/components/orders/OrderStatusChip.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const authStore = useAuthStore()
const ordersStore = useOrdersStore()
const notify = useNotificationStore()
const confirmRef = ref(null)

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function getDateLabel(ts) {
  if (!ts) return 'תאריך לא ידוע'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'היום'
  if (d.toDateString() === yesterday.toDateString()) return 'אתמול'
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
}

const groupedOrders = computed(() => {
  const groups = {}
  ordersStore.orders.forEach((o) => {
    const label = getDateLabel(o.createdAt)
    if (!groups[label]) groups[label] = []
    groups[label].push(o)
  })
  return groups
})

function canEdit(order) {
  if (order.status !== 'pending') return false
  return authStore.isAdmin || order.createdBy === authStore.user?.uid
}

async function handleRevive(order) {
  const confirmed = await confirmRef.value.open({
    title: 'החיית הזמנה',
    message: `הזמנה ${order.displayId} תוחזר לתור הליקוט. המלאי לא ישתנה — הסחורה כבר נלקטה. להמשיך?`,
    confirmText: 'החיה',
    confirmColor: 'warning',
  })
  if (!confirmed) return
  try {
    await ordersStore.reopenOrder(order.id)
    notify.showSuccess(`הזמנה ${order.displayId} הוחייתה`)
  } catch (err) {
    notify.showError('שגיאה: ' + err.message)
  }
}

async function handleDelete(order) {
  const confirmed = await confirmRef.value.open({
    title: 'מחיקת הזמנה',
    message: `האם למחוק את הזמנה ${order.displayId}? פעולה זו אינה הפיכה.`,
    confirmText: 'מחק',
    confirmColor: 'error',
  })
  if (!confirmed) return
  try {
    await ordersStore.deleteOrder(order.id)
    notify.showSuccess('ההזמנה נמחקה')
  } catch (err) {
    notify.showError('שגיאה במחיקה: ' + err.message)
  }
}

onMounted(() => ordersStore.startHistoryListener())
onUnmounted(() => ordersStore.stopListeners())
</script>
