<template>
  <div>
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-right" variant="text" @click="router.back()" class="me-2" />
      <div>
        <div class="text-h6 font-weight-bold">עדכון מלאי</div>
        <div v-if="product" class="text-body-2 text-medium-emphasis">{{ product.name }}</div>
      </div>
    </div>

    <v-card v-if="product" rounded="xl" max-width="500">
      <v-card-text class="pa-6">
        <!-- Current stock -->
        <v-card rounded="lg" color="blue-lighten-5" flat class="mb-5 pa-4">
          <div class="text-body-2 text-medium-emphasis">מלאי נוכחי</div>
          <div class="text-h4 font-weight-bold text-primary mt-1">
            {{ product.stockQuantity ?? 0 }} <span class="text-h6">יחידות</span>
          </div>
        </v-card>

        <!-- Mode toggle -->
        <v-btn-toggle v-model="mode" mandatory color="primary" variant="outlined" divided class="mb-5 w-100">
          <v-btn value="add" class="flex-grow-1" prepend-icon="mdi-plus-circle">הוסף</v-btn>
          <v-btn value="deduct" class="flex-grow-1" prepend-icon="mdi-minus-circle" color="error">הפחת</v-btn>
        </v-btn-toggle>

        <v-form ref="formRef" v-model="valid" @submit.prevent="handleSubmit">
          <v-text-field
            v-model.number="amount"
            :label="mode === 'add' ? 'כמות להוספה *' : 'כמות להפחתה *'"
            type="number"
            min="1"
            :max="mode === 'deduct' ? (product.stockQuantity ?? 0) : undefined"
            :prepend-inner-icon="mode === 'add' ? 'mdi-plus-circle' : 'mdi-minus-circle'"
            :color="mode === 'deduct' ? 'error' : 'primary'"
            :rules="amountRules"
            class="mb-4"
          />

          <!-- Preview -->
          <v-alert
            v-if="amount > 0"
            :type="mode === 'add' ? 'success' : 'warning'"
            variant="tonal"
            rounded="lg"
            class="mb-4"
          >
            מלאי חדש יהיה: <strong>{{ previewStock }}</strong> יחידות
          </v-alert>

          <v-textarea
            v-model="notes"
            :label="mode === 'deduct' ? 'סיבה (נזק, טעות...) *' : 'הערות (אופציונלי)'"
            rows="3"
            :placeholder="mode === 'deduct' ? 'תאר את הסיבה להפחתה...' : 'סיבה, ספק, מספר הזמנה...'"
            :rules="mode === 'deduct' ? [r => !!r?.trim() || 'נדרש להזין סיבה'] : []"
          />

          <v-btn
            type="submit"
            :color="mode === 'add' ? 'secondary' : 'error'"
            block
            size="large"
            class="mt-2"
            :loading="saving"
            :prepend-icon="mode === 'add' ? 'mdi-package-variant-plus' : 'mdi-package-variant-minus'"
          >
            {{ mode === 'add' ? 'הוסף מלאי' : 'הפחת מלאי' }}
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>

    <div v-else class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useStockEntry } from '@/composables/useStockEntry'

const route = useRoute()
const router = useRouter()
const { adjustStock } = useStockEntry()
const sku = route.params.sku

const product = ref(null)
const formRef = ref(null)
const valid = ref(false)
const saving = ref(false)
const mode = ref('add')
const amount = ref('')
const notes = ref('')

const currentStock = computed(() => product.value?.stockQuantity ?? 0)

const previewStock = computed(() => {
  const n = Number(amount.value)
  if (!n || n <= 0) return currentStock.value
  return mode.value === 'add' ? currentStock.value + n : currentStock.value - n
})

const amountRules = computed(() => [
  (r) => (r > 0) || 'חייב להיות גדול מ-0',
  ...(mode.value === 'deduct'
    ? [(r) => r <= currentStock.value || `לא ניתן להפחית יותר מהמלאי הקיים (${currentStock.value})`]
    : []),
])

onMounted(async () => {
  const snap = await getDoc(doc(db, 'products', sku))
  if (snap.exists()) {
    product.value = { id: snap.id, ...snap.data() }
  }
})

async function handleSubmit() {
  const { valid: v } = await formRef.value.validate()
  if (!v) return

  saving.value = true
  const delta = mode.value === 'add' ? Number(amount.value) : -Number(amount.value)
  const source = mode.value === 'add' ? 'manual' : 'deduction'
  const success = await adjustStock(sku, product.value.name, delta, notes.value, source)
  saving.value = false

  if (success) {
    router.push(`/products/${sku}/history`)
  }
}
</script>
