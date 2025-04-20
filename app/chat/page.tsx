"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ChatInterface from "@/components/chat/chat-interface"
import { useFirebase } from "@/lib/firebase/firebase-provider"
import Loading from "../loading"

export default function ChatPage() {
  const { user, loading } = useFirebase()
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // If user is not logged in, redirect to home
    if (isClient && !loading && !user) {
      router.push("/")
    }
  }, [user, loading, router, isClient])

  // Show loading state while checking auth
  if (loading || !isClient || !user) {
    return <Loading />
  }

  // If logged in, show chat interface
  return <ChatInterface />
}
