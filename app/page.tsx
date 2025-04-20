"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import LoginPage from "@/components/auth/login-page"
import { useFirebase } from "@/lib/firebase/firebase-provider"
import Loading from "./loading"

export default function Home() {
  const { user, loading, isAuthenticated } = useFirebase()
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // If user is logged in, redirect to chat
    if (isClient && isAuthenticated && !loading) {
      router.push("/chat")
    }
  }, [isAuthenticated, loading, router, isClient])

  // Show loading state while checking auth
  if (loading || !isClient) {
    return <Loading />
  }

  // If not logged in, show login page
  return <LoginPage />
}
