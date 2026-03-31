import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export async function getNextOrderNumber() {
  return runTransaction(db, async (transaction) => {
    const counterRef = doc(db, 'counters', 'orderCounter')
    const counterDoc = await transaction.get(counterRef)

    const nextNumber = counterDoc.exists() ? (counterDoc.data().value || 0) + 1 : 1

    transaction.set(counterRef, { value: nextNumber, lastUpdated: serverTimestamp() })

    return {
      displayId: `ORD-${nextNumber.toString().padStart(4, '0')}`,
      sequentialNumber: nextNumber,
    }
  })
}
