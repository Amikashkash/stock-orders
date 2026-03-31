import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCartStore = defineStore('cart', () => {
  const items = ref({})       // { productId: quantity }
  const packageMode = ref({}) // { productId: boolean }
  const mode = ref('create')  // 'create' | 'edit'
  const orderId = ref(null)

  const totalItems = computed(() =>
    Object.values(items.value).filter((q) => q > 0).length
  )

  const totalQuantity = computed(() =>
    Object.values(items.value).reduce((sum, q) => sum + q, 0)
  )

  const itemList = computed(() =>
    Object.entries(items.value)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty, isPackage: packageMode.value[productId] || false }))
  )

  function getQuantity(productId) {
    return items.value[productId] || 0
  }

  function isPackageModeOn(productId) {
    return packageMode.value[productId] || false
  }

  function add(productId, qty = 1) {
    items.value[productId] = (items.value[productId] || 0) + qty
    if (items.value[productId] < 0) items.value[productId] = 0
  }

  function remove(productId, qty = 1) {
    if (!items.value[productId]) return
    items.value[productId] -= qty
    if (items.value[productId] <= 0) {
      items.value[productId] = 0
      delete packageMode.value[productId]
    }
  }

  function setQty(productId, qty) {
    if (qty <= 0) {
      items.value[productId] = 0
      delete packageMode.value[productId]
    } else {
      items.value[productId] = qty
    }
  }

  function togglePackageMode(productId) {
    packageMode.value[productId] = !packageMode.value[productId]
  }

  function loadFromOrderItems(orderItems) {
    items.value = {}
    packageMode.value = {}
    orderItems.forEach((item) => {
      const pid = item.productId
      if (item.orderType === 'package') {
        packageMode.value[pid] = true
        items.value[pid] = item.packagesOrdered || 0
      } else {
        packageMode.value[pid] = false
        items.value[pid] = item.quantityOrdered || 0
      }
    })
  }

  function exportForOrder(products) {
    return itemList.value.map(({ productId, qty, isPackage }) => {
      const product = products.find((p) => p.id === productId || p.sku === productId)
      const packageQty = product?.packageQuantity || 1
      const actualQuantity = isPackage ? qty * packageQty : qty
      return {
        productId,
        quantityOrdered: actualQuantity,
        orderType: isPackage ? 'package' : 'unit',
        packagesOrdered: isPackage ? qty : null,
        packageQuantity: isPackage ? packageQty : null,
      }
    })
  }

  function initialize(newMode = 'create', newOrderId = null) {
    mode.value = newMode
    orderId.value = newOrderId
  }

  function clear() {
    items.value = {}
    packageMode.value = {}
  }

  return {
    items,
    packageMode,
    mode,
    orderId,
    totalItems,
    totalQuantity,
    itemList,
    getQuantity,
    isPackageModeOn,
    add,
    remove,
    setQty,
    togglePackageMode,
    loadFromOrderItems,
    exportForOrder,
    initialize,
    clear,
  }
}, {
  persist: {
    key: 'warehouse-cart',
    pick: ['items', 'packageMode', 'mode', 'orderId'],
  },
})
