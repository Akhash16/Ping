"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ChatInterface from "@/components/chat/chat-interface"
import { useFirebase } from "@/lib/firebase/firebase-provider"
import Loading from "../loading"

export default function ChatPage() {
  const { loading, isAuthenticated } = useFirebase()
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // If user is not logged in, redirect to home
    if (isClient && !loading && !isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, loading, router, isClient])

  // Show loading state while checking auth
  if (loading || !isClient || !isAuthenticated) {
    return <Loading />
  }

  // If logged in, show chat interface
  return <ChatInterface />
}
