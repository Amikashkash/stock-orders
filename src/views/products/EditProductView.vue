<template>
  <div>
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-right" variant="text" :to="'/'" class="me-2" />
      <div class="text-h6 font-weight-bold">עריכת מוצר</div>
    </div>

    <v-card v-if="product" rounded="xl" max-width="600">
      <v-card-text class="pa-6">
        <!-- Stock display (read-only — change via InsertStockView) -->
        <v-alert type="info" variant="tonal" rounded="lg" class="mb-4">
          <div class="d-flex align-center justify-space-between">
            <span>מלאי נוכחי: <strong>{{ product.stockQuantity ?? 0 }}</strong> יחידות</span>
            <v-btn size="small" color="secondary" variant="elevated" :to="`/products/${sku}/stock`" prepend-icon="mdi-plus">
              הוסף מלאי
            </v-btn>
          </div>
        </v-alert>

        <v-form ref="formRef" v-model="valid" @submit.prevent="handleSubmit">
          <v-row dense>
            <v-col cols="12">
              <v-text-field v-model="form.name" label="שם מוצר *" :rules="[r => !!r || 'שדה חובה']" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.brand" label="מותג" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select v-model="form.category" :items="[{ title: 'ללא קטגוריה', value: '' }, ...CATEGORIES.map(c => ({ title: c, value: c }))]" label="קטגוריה" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field v-model.number="form.weightValue" label="משקל/נפח" type="number" min="0" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-select v-model="form.weightUnit" :items="weightUnits" label="יחידה" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field v-model.number="form.packageQuantity" label="יח' במארז" type="number" min="1" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field v-model.number="form.cost" label="עלות" type="number" min="0" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="form.imageUrl" label="קישור לתמונה" />
            </v-col>
            <v-col cols="12">
              <v-switch v-model="form.isHidden" label="הסתר מוצר מהזמנות" color="warning" hide-details />
            </v-col>
          </v-row>

          <div class="d-flex gap-2 mt-4">
            <v-btn type="submit" color="primary" flex="1" :loading="saving" block>שמור שינויים</v-btn>
          </div>
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
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useNotificationStore } from '@/stores/notifications'
import { CATEGORIES } from '@/config/categories'

const route = useRoute()
const weightUnits = ['ק"ג', 'גר', 'ל', 'מ"ל']
const router = useRouter()
const notify = useNotificationStore()
const sku = route.params.sku

const product = ref(null)
const formRef = ref(null)
const valid = ref(false)
const saving = ref(false)
const form = ref({})

onMounted(async () => {
  const snap = await getDoc(doc(db, 'products', sku))
  if (!snap.exists()) {
    notify.showError('המוצר לא נמצא')
    router.push('/')
    return
  }
  product.value = { id: snap.id, ...snap.data() }
  form.value = {
    name: product.value.name || '',
    brand: product.value.brand || '',
    category: product.value.category || '',
    weightValue: product.value.weight?.value || '',
    weightUnit: product.value.weight?.unit || 'ק"ג',
    packageQuantity: product.value.packageQuantity || 1,
    cost: product.value.cost || '',
    imageUrl: product.value.imageUrl || '',
    isHidden: product.value.isHidden || false,
  }
})

async function handleSubmit() {
  const { valid: v } = await formRef.value.validate()
  if (!v) return

  saving.value = true
  try {
    await updateDoc(doc(db, 'products', sku), {
      name: form.value.name,
      brand: form.value.brand || '',
      category: form.value.category || '',
      weight: form.value.weightValue ? { value: form.value.weightValue, unit: form.value.weightUnit } : null,
      packageQuantity: form.value.packageQuantity || 1,
      cost: form.value.cost || null,
      imageUrl: form.value.imageUrl || '',
      isHidden: form.value.isHidden,
      updatedAt: serverTimestamp(),
    })
    notify.showSuccess('המוצר עודכן בהצלחה!')
    router.push('/')
  } catch (err) {
    notify.showError('שגיאה בעדכון המוצר: ' + err.message)
  } finally {
    saving.value = false
  }
}
</script>
