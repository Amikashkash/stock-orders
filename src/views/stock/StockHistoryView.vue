<template>
  <div>
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-right" variant="text" @click="router.back()" class="me-2" />
      <div>
        <div class="text-h6 font-weight-bold">היסטוריית מלאי</div>
        <div class="text-body-2 text-medium-emphasis">{{ sku ? product?.name : 'כל המוצרים' }}</div>
      </div>
    </div>

    <v-card rounded="xl">
      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="entries"
          :loading="loading"
          :items-per-page="25"
          class="rounded-xl"
          hover
        >
          <template #item.date="{ item }">
            {{ formatDate(item.date) }}
          </template>
          <template #item.amountAdded="{ item }">
            <v-chip
              :color="item.amountAdded > 0 ? 'success' : 'error'"
              size="small"
              variant="tonal"
            >
              {{ item.amountAdded > 0 ? '+' : '' }}{{ item.amountAdded }}
            </v-chip>
          </template>
          <template #item.source="{ item }">
            <v-chip size="x-small" variant="outlined">
              {{ item.source === 'manual' ? 'ידני' : 'ליקוט' }}
            </v-chip>
          </template>
          <template #loading>
            <v-skeleton-loader type="table-row@5" />
          </template>
          <template #no-data>
            <div class="text-center py-8 text-medium-emphasis">אין רישומי מלאי</div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, query, where, orderBy, getDocs, doc, getDoc, limit } from 'firebase/firestore'
import { db } from '@/firebase'

const route = useRoute()
const router = useRouter()
const sku = route.params.sku || null

const entries = ref([])
const product = ref(null)
const loading = ref(true)

const headers = [
  { title: 'תאריך', key: 'date', sortable: true },
  { title: 'מוצר', key: 'productName', sortable: true },
  { title: 'כמות', key: 'amountAdded', sortable: true },
  { title: 'מלאי קודם', key: 'previousStock' },
  { title: 'מלאי חדש', key: 'newStock' },
  { title: 'הוכנס ע"י', key: 'enteredByName' },
  { title: 'הערות', key: 'notes' },
  { title: 'מקור', key: 'source' },
]

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  if (sku) {
    const productSnap = await getDoc(doc(db, 'products', sku))
    if (productSnap.exists()) product.value = { id: productSnap.id, ...productSnap.data() }
  }

  let q
  if (sku) {
    q = query(collection(db, 'stockEntries'), where('productId', '==', sku), orderBy('date', 'desc'), limit(200))
  } else {
    q = query(collection(db, 'stockEntries'), orderBy('date', 'desc'), limit(200))
  }

  const snap = await getDocs(q)
  entries.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  loading.value = false
})
</script>
