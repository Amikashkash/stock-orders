<template>
  <v-card
    rounded="xl"
    elevation="2"
    :class="{ 'border-primary': qty > 0 }"
    :style="qty > 0 ? 'border: 2px solid rgb(var(--v-theme-primary));' : ''"
    class="h-100"
    hover
  >
    <!-- Qty badge -->
    <div v-if="qty > 0" class="position-absolute top-0 end-0 pa-2" style="z-index:1">
      <v-chip color="primary" size="small" class="font-weight-bold">
        {{ qty }} {{ isPackage ? 'מארז' : "יח'" }}
      </v-chip>
    </div>

    <!-- Image -->
    <v-img :src="product.imageUrl || ''" height="100" cover class="bg-grey-lighten-4 rounded-t-xl">
      <template #error>
        <div class="d-flex align-center justify-center h-100">
          <v-icon size="32" color="grey-lighten-2">mdi-cube-outline</v-icon>
        </div>
      </template>
    </v-img>

    <v-card-text class="pb-1 pt-2">
      <div class="text-subtitle-2 font-weight-bold text-truncate">{{ product.name }}</div>
      <div class="text-caption text-medium-emphasis">{{ product.brand }}</div>

      <!-- Stock -->
      <div v-if="product.stockQuantity != null" class="text-caption mt-1" :class="isOutOfStock ? 'text-error' : 'text-medium-emphasis'">
        {{ isOutOfStock ? 'אזל מהמלאי' : `מלאי: ${effectiveStock} ${unitText}` }}
      </div>

      <!-- Package toggle -->
      <v-checkbox
        v-if="product.packageQuantity > 1"
        v-model="localPackageMode"
        :label="`מארז (${product.packageQuantity} יח')`"
        density="compact"
        hide-details
        class="mt-1"
        @change="onTogglePackage"
      />
    </v-card-text>

    <v-card-actions class="pt-0 pb-3 px-3">
      <div class="d-flex align-center gap-2 w-100">
        <v-btn
          icon="mdi-minus"
          size="small"
          variant="tonal"
          color="error"
          :disabled="qty === 0"
          @click="emit('decrease')"
        />
        <span class="text-body-1 font-weight-bold flex-grow-1 text-center">{{ qty }}</span>
        <v-btn
          icon="mdi-plus"
          size="small"
          variant="tonal"
          color="primary"
          :disabled="isOutOfStock || isAtLimit"
          @click="emit('increase')"
        />
      </div>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  product: { type: Object, required: true },
  qty: { type: Number, default: 0 },
  isPackage: { type: Boolean, default: false },
})

const emit = defineEmits(['increase', 'decrease', 'togglePackage'])

const localPackageMode = ref(props.isPackage)

watch(() => props.isPackage, (v) => { localPackageMode.value = v })

function onTogglePackage() { emit('togglePackage') }

const packageQty = computed(() => props.product.packageQuantity || 1)
const unitText = computed(() => props.isPackage ? 'מארז' : "יח'")
const effectiveStock = computed(() => {
  const s = props.product.stockQuantity ?? 0
  return props.isPackage ? Math.floor(s / packageQty.value) : s
})
const isOutOfStock = computed(() => props.product.stockQuantity != null && effectiveStock.value === 0)
const isAtLimit = computed(() => props.product.stockQuantity != null && props.qty >= effectiveStock.value)
</script>
