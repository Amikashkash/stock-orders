<template>
  <div>
    <div class="text-h6 font-weight-bold mb-4">ניהול מותגים</div>

    <div v-if="productsStore.loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <div class="text-body-2 text-medium-emphasis mb-4">
        {{ brandList.length }} מותגים | {{ productsStore.products.length }} מוצרים
      </div>

      <v-card rounded="xl" elevation="1">
        <v-list>
          <template v-for="(brand, index) in brandList" :key="brand.name">
            <v-divider v-if="index > 0" />
            <v-list-item class="py-3">
              <template #default>
                <div v-if="editingBrand === brand.name" class="d-flex align-center gap-2">
                  <v-text-field
                    v-model="editValue"
                    density="compact"
                    hide-details
                    autofocus
                    class="flex-grow-1"
                    @keyup.enter="saveRename(brand.name)"
                    @keyup.esc="editingBrand = null"
                  />
                  <v-btn
                    size="small"
                    color="primary"
                    variant="tonal"
                    :loading="saving"
                    :disabled="!editValue.trim() || editValue.trim() === brand.name"
                    @click="saveRename(brand.name)"
                  >
                    שמור
                  </v-btn>
                  <v-btn size="small" variant="text" @click="editingBrand = null">ביטול</v-btn>
                </div>
                <div v-else class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-body-1 font-weight-medium">{{ brand.name }}</div>
                    <div class="text-caption text-medium-emphasis">{{ brand.count }} מוצרים</div>
                  </div>
                  <v-btn
                    size="small"
                    variant="tonal"
                    color="primary"
                    icon="mdi-pencil"
                    @click="startEdit(brand.name)"
                  />
                </div>
              </template>
            </v-list-item>
          </template>

          <v-list-item v-if="brandList.length === 0" class="py-8">
            <div class="text-center text-medium-emphasis">
              <v-icon size="48" class="mb-2">mdi-tag-off</v-icon>
              <div>אין מותגים להציג</div>
            </div>
          </v-list-item>
        </v-list>
      </v-card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useProductsStore } from '@/stores/products'
import { useNotificationStore } from '@/stores/notifications'

const productsStore = useProductsStore()
const notify = useNotificationStore()

const editingBrand = ref(null)
const editValue = ref('')
const saving = ref(false)

const brandList = computed(() =>
  productsStore.brands.map((name) => ({
    name,
    count: productsStore.products.filter((p) => p.brand === name).length,
  }))
)

function startEdit(name) {
  editingBrand.value = name
  editValue.value = name
}

async function saveRename(oldName) {
  const newName = editValue.value.trim()
  if (!newName || newName === oldName) return
  saving.value = true
  try {
    await productsStore.renameBrand(oldName, newName)
    notify.showSuccess(`המותג "${oldName}" שונה ל-"${newName}"`)
    editingBrand.value = null
  } catch (err) {
    notify.showError('שגיאה בשינוי מותג: ' + err.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => productsStore.startListener())
onUnmounted(() => productsStore.stopListener())
</script>
