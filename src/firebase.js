import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCdAYpf-yICDIHVaqZtRhTk14xV5IfewF4',
  authDomain: 'stock-orders-75be0.firebaseapp.com',
  projectId: 'stock-orders-75be0',
  storageBucket: 'stock-orders-75be0.appspot.com',
  messagingSenderId: '637582925650',
  appId: '1:637582925650:web:23e1626b00db6eca30e48b',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
