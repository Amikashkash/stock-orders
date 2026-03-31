import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const userDoc = ref(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => userDoc.value?.role === 'admin')
  const displayName = computed(() => userDoc.value?.fullName || user.value?.email || '')
  const storeName = computed(() => userDoc.value?.storeName || '')

  async function loadUserDoc(uid) {
    const ref_ = doc(db, 'users', uid)
    const snap = await getDoc(ref_)
    if (snap.exists()) {
      userDoc.value = snap.data()
    } else {
      userDoc.value = null
    }
  }

  async function upsertUserDoc(firebaseUser) {
    const ref_ = doc(db, 'users', firebaseUser.uid)
    const snap = await getDoc(ref_)
    if (!snap.exists()) {
      await setDoc(ref_, {
        fullName: firebaseUser.displayName || 'משתמש חדש',
        storeName: 'הגדר שם חנות',
        email: firebaseUser.email,
        role: 'store',
      })
    } else {
      await setDoc(ref_, {
        fullName: firebaseUser.displayName || snap.data().fullName,
        email: firebaseUser.email,
      }, { merge: true })
    }
    await loadUserDoc(firebaseUser.uid)
  }

  function initAuth() {
    // Handle Google redirect result
    getRedirectResult(auth).catch((err) => console.error('Redirect result error:', err))

    onAuthStateChanged(auth, async (firebaseUser) => {
      user.value = firebaseUser
      if (firebaseUser) {
        await upsertUserDoc(firebaseUser)
      } else {
        userDoc.value = null
      }
      loading.value = false
    })
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    await signInWithRedirect(auth, provider)
  }

  async function signOut() {
    await firebaseSignOut(auth)
    user.value = null
    userDoc.value = null
  }

  return {
    user,
    userDoc,
    loading,
    isAuthenticated,
    isAdmin,
    displayName,
    storeName,
    initAuth,
    signInWithGoogle,
    signOut,
    loadUserDoc,
  }
})
