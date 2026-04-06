import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
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
    await signInWithPopup(auth, provider)
  }

  async function signInWithEmail(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function registerWithEmail(email, password, fullName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (fullName) await updateProfile(cred.user, { displayName: fullName })
    await upsertUserDoc({ ...cred.user, displayName: fullName || cred.user.displayName })
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email)
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
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    signOut,
    loadUserDoc,
  }
})
