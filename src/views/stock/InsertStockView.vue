<template>
  <div>
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-right" variant="text" @click="router.back()" class="me-2" />
      <div>
        <div class="text-h6 font-weight-bold">הוספת מלאי</div>
        <div v-if="product" class="text-body-2 text-medium-emphasis">{{ product.name }}</div>
      </div>
    </div>

    <v-card v-if="product" rounded="xl" max-width="500">
      <v-card-text class="pa-6">
        <!-- Current stock -->
        <v-card rounded="lg" color="blue-lighten-5" flat class="mb-5 pa-4">
          <div class="text-body-2 text-medium-emphasis">מלאי נוכחי</div>
          <div class="text-h4 font-weight-bold text-primary mt-1">{{ product.stockQuantity ?? 0 }} <span class="text-h6">יחידות</span></div>
        </v-card>

        <v-form ref="formRef" v-model="valid" @submit.prevent="handleSubmit">
          <v-text-field
            v-model.number="amount"
            label="כמות להוספה *"
            type="number"
            min="1"
            prepend-inner-icon="mdi-plus-circle"
            :rules="[r => (r > 0) || 'חייב להיות גדול מ-0']"
            class="mb-4"
          />

          <!-- Preview -->
          <v-alert v-if="amount > 0" type="success" variant="tonal" rounded="lg" class="mb-4">
            מלאי חדש יהיה: <strong>{{ (product.stockQuantity ?? 0) + Number(amount) }}</strong> יחידות
          </v-alert>

          <v-textarea
            v-model="notes"
            label="הערות (אופציונלי)"
            rows="3"
            placeholder="סיבה, ספק, מספר הזמנה..."
          />

          <v-btn
            type="submit"
            color="secondary"
            block
            size="large"
            class="mt-2"
            :loading="saving"
            prepend-icon="mdi-package-variant-plus"
          >
            הוסף מלאי
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
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useStockEntry } from '@/composables/useStockEntry'

const route = useRoute()
const router = useRouter()
const { insertStock } = useStockEntry()
const sku = route.params.sku

const product = ref(null)
const formRef = ref(null)
const valid = ref(false)
const saving = ref(false)
const amount = ref('')
const notes = ref('')

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
  const success = await insertStock(sku, product.value.name, Number(amount.value), notes.value)
  saving.value = false

  if (success) {
    router.push(`/products/${sku}/history`)
  }
}
</script>
