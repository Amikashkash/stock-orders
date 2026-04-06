<template>
  <div>
    <div class="text-h6 font-weight-bold mb-4">סטטיסטיקות מכירות</div>

    <!-- Filters -->
    <v-row class="mb-4" dense>
      <v-col cols="6" sm="3">
        <v-select
          v-model="dateRange"
          :items="dateRanges"
          label="טווח תאריכים"
          hide-details
          density="compact"
        />
      </v-col>
      <v-col cols="6" sm="3">
        <v-select
          v-model="brandFilter"
          :items="[{ title: 'כל המותגים', value: '' }, ...productsStore.brands.map(b => ({ title: b, value: b }))]"
          label="מותג"
          hide-details
          density="compact"
        />
      </v-col>
      <v-col cols="12" sm="3">
        <v-text-field
          v-model="productSearch"
          label="חיפוש מוצר"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          density="compact"
        />
      </v-col>
      <v-col cols="12" sm="3">
        <v-btn color="primary" block :loading="loading" @click="loadStats">הצג תוצאות</v-btn>
      </v-col>
    </v-row>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else-if="statsLoaded">
      <!-- Summary cards -->
      <v-row class="mb-6">
        <v-col cols="6" sm="3">
          <v-card rounded="xl" variant="tonal" color="primary" class="text-center pa-3">
            <div class="text-h5 font-weight-bold text-primary">{{ totalOrders }}</div>
            <div class="text-caption text-medium-emphasis">סה"כ הזמנות</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card rounded="xl" variant="tonal" color="secondary" class="text-center pa-3">
            <div class="text-h5 font-weight-bold text-secondary">{{ totalUnits }}</div>
            <div class="text-caption text-medium-emphasis">סה"כ יחידות</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card rounded="xl" variant="tonal" color="warning" class="text-center pa-3">
            <div class="text-h5 font-weight-bold text-warning">{{ uniqueProducts }}</div>
            <div class="text-caption text-medium-emphasis">מוצרים שונים</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card rounded="xl" variant="tonal" color="success" class="text-center pa-3">
            <div class="text-h5 font-weight-bold text-success">{{ topProduct?.name || '-' }}</div>
            <div class="text-caption text-medium-emphasis">מוצר מוביל</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Charts -->
      <v-row class="mb-6">
        <v-col cols="12" md="8">
          <v-card rounded="xl" class="pa-4">
            <div class="text-subtitle-1 font-weight-bold mb-4">מגמת הזמנות</div>
            <Bar v-if="trendData" :data="trendData" :options="chartOptions" />
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card rounded="xl" class="pa-4">
            <div class="text-subtitle-1 font-weight-bold mb-4">מוצרים מובילים</div>
            <HorizontalBar v-if="topProductsData" :data="topProductsData" :options="horizontalOptions" />
          </v-card>
        </v-col>
      </v-row>

      <!-- Top products table -->
      <v-card rounded="xl">
        <v-card-title class="pa-4 text-subtitle-1 font-weight-bold">טבלת מוצרים</v-card-title>
        <v-data-table
          :headers="tableHeaders"
          :items="filteredProductStats"
          :items-per-page="15"
          hover
        >
          <template #item.daysUntilStockout="{ item }">
            <v-chip
              :color="item.daysUntilStockout <= 7 ? 'error' : item.daysUntilStockout <= 14 ? 'warning' : 'success'"
              size="small"
              variant="tonal"
            >
              {{ item.daysUntilStockout === Infinity ? '∞' : Math.round(item.daysUntilStockout) }} ימים
            </v-chip>
          </template>
        </v-data-table>
      </v-card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement } from 'chart.js'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/firebase'
import { useProductsStore } from '@/stores/products'

// Register Chart.js components
const HorizontalBar = Bar
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement)

const productsStore = useProductsStore()

const dateRange = ref(30)
const brandFilter = ref('')
const productSearch = ref('')
const loading = ref(false)
const statsLoaded = ref(false)

const dateRanges = [
  { title: '7 ימים', value: 7 },
  { title: '30 ימים', value: 30 },
  { title: '90 ימים', value: 90 },
  { title: 'כל הזמן', value: 3650 },
]

const productStats = ref([])
const ordersByDate = ref({})

const totalOrders = computed(() => Object.keys(ordersByDate.value).length)
const totalUnits = computed(() => productStats.value.reduce((s, p) => s + p.totalUnits, 0))
const uniqueProducts = computed(() => productStats.value.length)
const topProduct = computed(() => productStats.value[0] || null)

const filteredProductStats = computed(() => {
  let list = productStats.value
  if (brandFilter.value) list = list.filter((p) => p.brand === brandFilter.value)
  if (productSearch.value) {
    const q = productSearch.value.toLowerCase()
    list = list.filter((p) => p.name.toLowerCase().includes(q))
  }
  return list
})

const trendData = computed(() => {
  const labels = Object.keys(ordersByDate.value).sort()
  return {
    labels,
    datasets: [{
      label: 'הזמנות',
      data: labels.map((l) => ordersByDate.value[l]),
      backgroundColor: 'rgba(79, 70, 229, 0.5)',
      borderColor: '#4f46e5',
      borderWidth: 2,
    }],
  }
})

const topProductsData = computed(() => {
  const top10 = productStats.value.slice(0, 10)
  return {
    labels: top10.map((p) => p.name.slice(0, 20)),
    datasets: [{
      label: 'יחידות',
      data: top10.map((p) => p.totalUnits),
      backgroundColor: 'rgba(16, 185, 129, 0.6)',
    }],
  }
})

const chartOptions = { responsive: true, plugins: { legend: { display: false } } }
const horizontalOptions = { ...chartOptions, indexAxis: 'y' }

const tableHeaders = [
  { title: 'מוצר', key: 'name' },
  { title: 'מותג', key: 'brand' },
  { title: 'יחידות שנמכרו', key: 'totalUnits', sortable: true },
  { title: 'ימים למלאי אפס', key: 'daysUntilStockout', sortable: true },
]

async function loadStats() {
  loading.value = true
  statsLoaded.value = false

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - dateRange.value)

    const ordersSnap = await getDocs(
      query(collection(db, 'orders'), where('status', '==', 'picked'), where('pickedAt', '>=', cutoff), orderBy('pickedAt', 'desc'))
    )

    const productTotals = {}
    const dateMap = {}

    for (const orderDoc of ordersSnap.docs) {
      const orderData = orderDoc.data()
      const dateKey = orderData.pickedAt?.toDate?.()?.toLocaleDateString('he-IL') || 'לא ידוע'
      dateMap[dateKey] = (dateMap[dateKey] || 0) + 1

      const itemsSnap = await getDocs(collection(db, 'orders', orderDoc.id, 'orderItems'))
      itemsSnap.docs.forEach((itemDoc) => {
        const item = itemDoc.data()
        if (!productTotals[item.productId]) {
          productTotals[item.productId] = { totalUnits: 0, totalOrders: 0 }
        }
        productTotals[item.productId].totalUnits += item.quantityPicked || item.quantityOrdered || 0
        productTotals[item.productId].totalOrders += 1
      })
    }

    ordersByDate.value = dateMap

    const days = dateRange.value
    productStats.value = Object.entries(productTotals)
      .map(([productId, stats]) => {
        const product = productsStore.getById(productId)
        const avgPerDay = stats.totalUnits / days
        const daysUntilStockout = avgPerDay > 0 ? (product?.stockQuantity ?? 0) / avgPerDay : Infinity
        return {
          productId,
          name: product?.name || productId,
          brand: product?.brand || '',
          totalUnits: stats.totalUnits,
          totalOrders: stats.totalOrders,
          currentStock: product?.stockQuantity ?? 0,
          daysUntilStockout,
        }
      })
      .sort((a, b) => b.totalUnits - a.totalUnits)

    statsLoaded.value = true
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}
</script>
