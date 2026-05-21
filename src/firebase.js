import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBIbrXiHY-he3RzgLzdBrWkV6eUQp-U6VA",
  authDomain: "labo-1fa1a.firebaseapp.com",
  projectId: "labo-1fa1a",
  storageBucket: "labo-1fa1a.firebasestorage.app",
  messagingSenderId: "856052475894",
  appId: "1:856052475894:web:13f7eb7d29e6e0c69d09d7",
  measurementId: "G-RP47EG23Q6"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()