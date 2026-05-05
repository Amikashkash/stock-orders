import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore'
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
      await runTransaction(db, async (tx) => {
        const productRef = doc(db, 'products', productId)
        const productSnap = await tx.get(productRef)

        if (!productSnap.exists()) throw new Error('המוצר לא נמצא')

        const currentStock = productSnap.data().stockQuantity || 0
        const newStock = currentStock + amount

        const entryRef = doc(collection(db, 'stockEntries'))
        tx.set(entryRef, {
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

        const update = { stockQuantity: newStock, updatedAt: serverTimestamp() }
        if (amount > 0) update.lastRestockedAt = serverTimestamp()
        tx.update(productRef, update)
      })

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
