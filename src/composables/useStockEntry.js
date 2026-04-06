import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'

export function useStockEntry() {
  const authStore = useAuthStore()
  const notify = useNotificationStore()

  async function insertStock(productId, productName, amountAdded, notes = '') {
    if (!amountAdded || amountAdded <= 0) {
      notify.showError('כמות חייבת להיות גדולה מ-0')
      return false
    }

    try {
      await runTransaction(db, async (tx) => {
        const productRef = doc(db, 'products', productId)
        const productSnap = await tx.get(productRef)

        if (!productSnap.exists()) throw new Error('המוצר לא נמצא')

        const currentStock = productSnap.data().stockQuantity || 0
        const newStock = currentStock + amountAdded

        const entryRef = doc(collection(db, 'stockEntries'))
        tx.set(entryRef, {
          productId,
          productName,
          amountAdded,
          previousStock: currentStock,
          newStock,
          date: serverTimestamp(),
          enteredBy: authStore.user.uid,
          enteredByName: authStore.displayName,
          notes,
          source: 'manual',
        })

        tx.update(productRef, {
          stockQuantity: newStock,
          lastRestockedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })

      notify.showSuccess(`מלאי עודכן בהצלחה! נוספו ${amountAdded} יחידות`)
      return true
    } catch (err) {
      console.error('insertStock error:', err)
      notify.showError('שגיאה בעדכון המלאי: ' + err.message)
      return false
    }
  }

  return { insertStock }
}
