<template>
  <div>
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-right" variant="text" :to="'/'" class="me-2" />
      <div class="text-h6 font-weight-bold">הוספת מוצר חדש</div>
    </div>

    <v-card rounded="xl" max-width="600">
      <v-card-text class="pa-6">
        <v-form ref="formRef" v-model="valid" @submit.prevent="handleSubmit">
          <v-row dense>
            <v-col cols="12">
              <v-text-field v-model="form.name" label="שם מוצר *" :rules="[r => !!r || 'שדה חובה']" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.sku" label="מקט (SKU) *" :rules="[r => !!r || 'שדה חובה']" />
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
            <v-col cols="12" sm="6">
              <v-text-field v-model.number="form.stockQuantity" label="כמות במלאי" type="number" min="0" />
            </v-col>
          </v-row>

          <v-btn
            type="submit"
            color="primary"
            block
            size="large"
            class="mt-4"
            :loading="saving"
          >
            שמור מוצר
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useNotificationStore } from '@/stores/notifications'
import { CATEGORIES } from '@/config/categories'

const router = useRouter()
const notify = useNotificationStore()
const weightUnits = ['ק"ג', 'גר', 'ל', 'מ"ל']
const formRef = ref(null)
const valid = ref(false)
const saving = ref(false)

const form = ref({
  name: '',
  sku: '',
  brand: '',
  category: '',
  weightValue: '',
  weightUnit: 'ק"ג',
  packageQuantity: 1,
  cost: '',
  imageUrl: '',
  stockQuantity: 0,
})

async function handleSubmit() {
  const { valid: v } = await formRef.value.validate()
  if (!v) return

  saving.value = true
  try {
    const productData = {
      name: form.value.name,
      sku: form.value.sku,
      brand: form.value.brand || '',
      category: form.value.category || '',
      weight: form.value.weightValue ? { value: form.value.weightValue, unit: form.value.weightUnit } : null,
      packageQuantity: form.value.packageQuantity || 1,
      cost: form.value.cost || null,
      imageUrl: form.value.imageUrl || '',
      stockQuantity: form.value.stockQuantity || 0,
      isHidden: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'products', form.value.sku), productData)
    notify.showSuccess('המוצר נוסף בהצלחה!')
    router.push('/')
  } catch (err) {
    notify.showError('שגיאה בשמירת המוצר: ' + err.message)
  } finally {
    saving.value = false
  }
}
</script>
