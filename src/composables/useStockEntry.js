import { doc, collection, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'

export function useStockEntry() {
  const authStore = useAuthStore()
  const notify = useNotificationStore()

  async function adjustStock(productId, productName, amount, notes = '', source = 'manual') {
    if (!amount || amount === 0) {
      notify.showError('כמות חייבת להיות שונה מ-0')
      return false
    }

    try {
      const productRef = doc(db, 'products', productId)
      const productSnap = await getDoc(productRef)

      if (!productSnap.exists()) throw new Error('המוצר לא נמצא')

      const currentStock = productSnap.data().stockQuantity || 0
      const newStock = currentStock + amount

      const entryRef = doc(collection(db, 'stockEntries'))
      await setDoc(entryRef, {
        productId,
        productName,
        amountAdded: amount,
        previousStock: currentStock,
        newStock,
        date: serverTimestamp(),
        enteredBy: authStore.user.uid,
        enteredByName: authStore.displayName,
        notes,
        source,
      })

      const update = { stockQuantity: increment(amount), updatedAt: serverTimestamp() }
      if (amount > 0) update.lastRestockedAt = serverTimestamp()
      await updateDoc(productRef, update)

      if (amount > 0) {
        notify.showSuccess(`נוספו ${amount} יחידות למלאי`)
      } else {
        notify.showSuccess(`הופחתו ${Math.abs(amount)} יחידות מהמלאי`)
      }
      return true
    } catch (err) {
      console.error('adjustStock error:', err)
      notify.showError('שגיאה בעדכון המלאי: ' + err.message)
      return false
    }
  }

  async function insertStock(productId, productName, amountAdded, notes = '') {
    return adjustStock(productId, productName, amountAdded, notes, 'manual')
  }

  return { insertStock, adjustStock }
}
