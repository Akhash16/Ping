"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { initializeApp, getApps } from "firebase/app"
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { useRouter } from "next/navigation"

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Create a simple Firebase client
const createFirebaseClient = () => {
  // Check if we're in the browser
  if (typeof window === "undefined") {
    return { app: null, auth: null, db: null }
  }

  try {
    // Initialize Firebase (only if not already initialized)
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    const auth = getAuth(app)
    const db = getFirestore(app)

    return { app, auth, db }
  } catch (error) {
    console.error("Error initializing Firebase:", error)
    return { app: null, auth: null, db: null }
  }
}

// Create context
interface FirebaseContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  db: any
  isAuthenticated: boolean
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined)

// Provider component
export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { auth, db } = createFirebaseClient()
  const router = useRouter()

  useEffect(() => {
    // Skip if we're not in the browser or auth is not initialized
    if (typeof window === "undefined" || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user)
        setIsAuthenticated(!!user)
        setLoading(false)
      },
      (error) => {
        console.error("Auth state change error:", error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [auth])

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Auth is not initialized")
    await signInWithEmailAndPassword(auth, email, password)
    // After successful sign-in, navigate to chat
    router.push("/chat")
  }

  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error("Auth is not initialized")
    await createUserWithEmailAndPassword(auth, email, password)
    // After successful sign-up, navigate to chat
    router.push("/chat")
  }

  const signOut = async () => {
    if (!auth) throw new Error("Auth is not initialized")
    await firebaseSignOut(auth)
    // After sign-out, navigate to home
    router.push("/")
  }

  return (
    <FirebaseContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        db,
        isAuthenticated,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  )
}

// Hook to use the firebase context
export function useFirebase() {
  const context = useContext(FirebaseContext)
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider")
  }
  return context
}
