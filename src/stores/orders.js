import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, query, where, orderBy, onSnapshot, limit,
  addDoc, updateDoc, deleteDoc, getDocs, doc, writeBatch, serverTimestamp, increment,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useProductsStore } from '@/stores/products'
import { getNextOrderNumber } from '@/composables/useOrderCounter'

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref([])
  const pickingOrders = ref([])
  const loading = ref(false)
  const _unsubscribers = ref([])

  const pendingCount = computed(() =>
    pickingOrders.value.filter((o) => o.status === 'pending').length
  )

  function startHistoryListener() {
    loading.value = true
    const authStore = useAuthStore()

    let q
    if (authStore.isAdmin) {
      q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100))
    } else {
      q = query(
        collection(db, 'orders'),
        where('createdBy', '==', authStore.user.uid),
        orderBy('createdAt', 'desc'),
        limit(100)
      )
    }

    const unsub = onSnapshot(q, (snap) => {
      orders.value = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((o) => o.status !== 'draft')
      loading.value = false
    })
    _unsubscribers.value.push(unsub)
  }

  function startPickingListener() {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'in-progress']),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      pickingOrders.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    })
    _unsubscribers.value.push(unsub)
  }

  function stopListeners() {
    _unsubscribers.value.forEach((unsub) => unsub())
    _unsubscribers.value = []
  }

  async function createOrder(cartStore, notes) {
    const authStore = useAuthStore()
    const { displayId, sequentialNumber } = await getNextOrderNumber()

    const orderData = {
      displayId,
      sequentialNumber,
      createdAt: serverTimestamp(),
      createdBy: authStore.user.uid,
      storeName: authStore.storeName,
      createdByName: authStore.displayName,
      status: 'pending',
      notes: notes || '',
    }

    const orderRef = await addDoc(collection(db, 'orders'), orderData)

    const orderItems = cartStore.exportForOrder(useProductsStore().products)
    for (const item of orderItems) {
      await addDoc(collection(db, 'orders', orderRef.id, 'orderItems'), item)
    }

    cartStore.clear()
    return orderRef.id
  }

  async function updateOrder(orderId, cartStore, notes) {
    const orderRef = doc(db, 'orders', orderId)
    await updateDoc(orderRef, { notes: notes || '', updatedAt: serverTimestamp() })

    // Delete old items
    const oldItems = await getDocs(collection(db, 'orders', orderId, 'orderItems'))
    for (const d of oldItems.docs) {
      await deleteDoc(doc(db, 'orders', orderId, 'orderItems', d.id))
    }

    // Add new items
    const orderItems = cartStore.exportForOrder(useProductsStore().products)
    for (const item of orderItems) {
      await addDoc(collection(db, 'orders', orderId, 'orderItems'), item)
    }

    cartStore.clear()
  }

  async function deleteOrder(orderId) {
    const itemsSnap = await getDocs(collection(db, 'orders', orderId, 'orderItems'))
    const batch = writeBatch(db)
    itemsSnap.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(doc(db, 'orders', orderId))
    await batch.commit()
  }

  async function completePicking(orderId, pickedItems, pickingNotes, authStore) {
    const batch = writeBatch(db)

    for (const item of pickedItems) {
      if (item.quantityPicked > 0) {
        // Update order item
        const itemRef = doc(db, 'orders', orderId, 'orderItems', item.id)
        batch.update(itemRef, {
          quantityPicked: item.quantityPicked,
          status: 'picked',
        })

        // Decrement product stock
        const productRef = doc(db, 'products', item.productId)
        batch.update(productRef, {
          stockQuantity: increment(-item.quantityPicked),
          updatedAt: serverTimestamp(),
        })

        // Create stock entry (audit trail)
        const entryRef = doc(collection(db, 'stockEntries'))
        batch.set(entryRef, {
          productId: item.productId,
          productName: item.productName || '',
          amountAdded: -item.quantityPicked,
          previousStock: item.currentStock ?? null,
          newStock: item.currentStock != null ? item.currentStock - item.quantityPicked : null,
          date: serverTimestamp(),
          enteredBy: authStore.user.uid,
          enteredByName: authStore.displayName,
          notes: `ליקוט הזמנה ${orderId}`,
          source: 'picking_completion',
        })
      }
    }

    // Mark order as picked
    batch.update(doc(db, 'orders', orderId), {
      status: 'picked',
      pickedAt: serverTimestamp(),
      pickingNotes: pickingNotes || '',
    })

    await batch.commit()
  }

  return {
    orders,
    pickingOrders,
    loading,
    pendingCount,
    startHistoryListener,
    startPickingListener,
    stopListeners,
    createOrder,
    updateOrder,
    deleteOrder,
    completePicking,
  }
})
