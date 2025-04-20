"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error("Caught error:", event.error)
      setError(event.error)
      setHasError(true)
      event.preventDefault()
    }

    window.addEventListener("error", errorHandler)

    return () => {
      window.removeEventListener("error", errorHandler)
    }
  }, [])

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <div className="w-full max-w-md p-6 bg-card rounded-lg shadow-lg">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-4">Something went wrong</h2>
          <p className="text-muted-foreground mb-6 text-center">An error occurred while loading the application.</p>
          <div className="bg-muted p-3 rounded-md mb-6 overflow-auto max-h-40">
            <code className="text-sm">{error?.message || "Unknown error"}</code>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              setHasError(false)
              setError(null)
              window.location.reload()
            }}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
