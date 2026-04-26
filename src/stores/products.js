import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { collection, onSnapshot, query, orderBy, where, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const BADGE_DAYS = 14

function daysSince(timestamp) {
  if (!timestamp) return Infinity
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
}

export const useProductsStore = defineStore('products', () => {
  const products = ref([])
  const loading = ref(false)
  const filters = ref({
    search: '',
    category: '',
    brand: '',
    stock: '', // 'low' | 'medium' | 'high' | ''
    showHidden: false,
  })
  let _unsubscribe = null

  const brands = computed(() =>
    [...new Set(products.value.map((p) => p.brand).filter(Boolean))].sort()
  )

  const brandsByCategory = computed(() => {
    const map = {}
    for (const p of products.value) {
      if (!p.brand) continue
      const cat = p.category || ''
      if (!map[cat]) map[cat] = new Set()
      map[cat].add(p.brand)
    }
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort()]))
  })

  const filteredProducts = computed(() => {
    let list = products.value

    if (!filters.value.showHidden) {
      list = list.filter((p) => !p.isHidden)
    }

    if (filters.value.category === '__none__') {
      list = list.filter((p) => !p.category)
    } else if (filters.value.category) {
      list = list.filter((p) => p.category === filters.value.category)
    }

    if (filters.value.brand) {
      list = list.filter((p) => p.brand === filters.value.brand)
    }

    if (filters.value.search) {
      const q = filters.value.search.toLowerCase()
      list = list.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
      )
    }

    if (filters.value.stock === 'low') list = list.filter((p) => (p.stockQuantity ?? 0) <= 5)
    if (filters.value.stock === 'medium') list = list.filter((p) => (p.stockQuantity ?? 0) > 5 && (p.stockQuantity ?? 0) <= 20)
    if (filters.value.stock === 'high') list = list.filter((p) => (p.stockQuantity ?? 0) > 20)

    return [...list].sort((a, b) => {
      const aNew = isNew(a) ? 0 : 1
      const bNew = isNew(b) ? 0 : 1
      return aNew - bNew
    })
  })

  const lowStockCount = computed(() => products.value.filter((p) => !p.isHidden && (p.stockQuantity ?? 0) <= 5).length)
  const totalCount = computed(() => products.value.filter((p) => !p.isHidden).length)

  function isNew(product) {
    return daysSince(product.createdAt) <= BADGE_DAYS
  }

  function isRestocked(product) {
    return (
      product.lastRestockedAt &&
      daysSince(product.lastRestockedAt) <= BADGE_DAYS &&
      !isNew(product)
    )
  }

  function startListener() {
    if (_unsubscribe) return
    loading.value = true
    const q = query(collection(db, 'products'), orderBy('name'))
    _unsubscribe = onSnapshot(q, (snap) => {
      products.value = snap.docs.map((d) => ({ id: d.id, sku: d.id, ...d.data() }))
      loading.value = false
    })
  }

  function stopListener() {
    if (_unsubscribe) {
      _unsubscribe()
      _unsubscribe = null
    }
  }

  function getById(sku) {
    return products.value.find((p) => p.id === sku || p.sku === sku) || null
  }

  function setFilter(key, value) {
    filters.value[key] = value
  }

  function resetFilters() {
    filters.value = { search: '', category: '', brand: '', stock: '', showHidden: false }
  }

  async function renameBrand(oldName, newName) {
    const snap = await getDocs(query(collection(db, 'products'), where('brand', '==', oldName)))
    if (snap.empty) return
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.update(doc(db, 'products', d.id), { brand: newName, updatedAt: serverTimestamp() }))
    await batch.commit()
  }

  return {
    products,
    loading,
    filters,
    brands,
    brandsByCategory,
    filteredProducts,
    lowStockCount,
    totalCount,
    isNew,
    isRestocked,
    startListener,
    stopListener,
    getById,
    setFilter,
    resetFilters,
    renameBrand,
  }
})
