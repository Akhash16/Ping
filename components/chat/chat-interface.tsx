"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useFirebase } from "@/lib/firebase/firebase-provider"
import { MessageSquare, Send, LogOut, User, Users, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore"

interface Message {
  id: string
  text: string
  senderId: string
  timestamp: Timestamp | null
  senderName: string
}

interface ChatUser {
  id: string
  email: string
  displayName?: string
}

export default function ChatInterface() {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<ChatUser[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Reference to store active Firestore unsubscribe functions
  const unsubscribeRefs = useRef<(() => void)[]>([]);
  const { toast } = useToast()
  const { user, signOut, db, isAuthenticated } = useFirebase()

  // Ensure user is authenticated before fetching data
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setError("You must be logged in to use the chat")
      setLoading(false)
      return
    } else {
      setError(null)
    }
  }, [isAuthenticated, user])

  // Fetch users
  useEffect(() => {
    if (!user || !db || !isAuthenticated) {
      return
    }

    const fetchUsers = async () => {
      try {
        // First, ensure current user exists in the users collection
        const userRef = doc(db, "users", user.uid)
        await setDoc(
          userRef,
          {
            email: user.email,
            displayName: user.displayName || user.email?.split("@")[0],
            lastSeen: serverTimestamp(),
          },
          { merge: true },
        )

        // Then listen for users
        const usersCollection = collection(db, "users")
        const unsubscribe = onSnapshot(
          usersCollection,
          (snapshot) => {
            const usersList: ChatUser[] = []
            snapshot.forEach((doc) => {
              const userData = doc.data()
              if (doc.id !== user.uid) {
                usersList.push({
                  id: doc.id,
                  email: userData.email || "",
                  displayName: userData.displayName,
                })
              }
            })

            setUsers(usersList)

            if (usersList.length > 0 && !selectedUser) {
              setSelectedUser(usersList[0].id)
            }

            setLoading(false)
          },
          (error) => {
            console.error("Error fetching users:", error)
            setError(`Failed to load users: ${error.message}`)
            toast({
              title: "Error",
              description: "Failed to load users: " + error.message,
              variant: "destructive",
            })
            setLoading(false)
          },
        )

        // Store the unsubscribe function
        unsubscribeRefs.current.push(unsubscribe);
        
        return unsubscribe
      } catch (error: any) {
        console.error("Error setting up users:", error)
        setError(`Failed to set up users: ${error.message}`)
        toast({
          title: "Error",
          description: "Failed to set up users: " + error.message,
          variant: "destructive",
        })
        setLoading(false)
        return () => {}
      }
    }

    const unsubscribePromise = fetchUsers();
    
    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe();
      });
    }
  }, [user, db, toast, isAuthenticated])

  // Fetch messages
  useEffect(() => {
    if (!selectedUser || !user || !db || !isAuthenticated) return

    // Clear existing messages when switching users
    setMessages([]);

    const fetchMessages = async () => {
      try {
        // Create a chat ID that's the same regardless of who initiated the chat
        const chatId = [user.uid, selectedUser].sort().join("_")

        // Debug info
        setDebugInfo(`Current chat ID: ${chatId}, Current user: ${user.uid}, Selected user: ${selectedUser}`)
        console.log(`Current chat ID: ${chatId}, Current user: ${user.uid}, Selected user: ${selectedUser}`)

        // Create or update the chat document
        const chatRef = doc(db, "chats", chatId)

        // Check if the chat document exists
        const chatDoc = await getDoc(chatRef)

        // Create the chat document if it doesn't exist
        if (!chatDoc.exists()) {
          await setDoc(chatRef, {
            participants: [user.uid, selectedUser],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        } else {
          // Update the chat document if it exists
          await setDoc(
            chatRef,
            {
              participants: [user.uid, selectedUser],
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )
        }

        // Listen for messages
        const messagesRef = collection(db, "chats", chatId, "messages")
        const q = query(messagesRef, orderBy("timestamp", "asc"))

        // Create a cache for user data to avoid repeated fetches
        const userCache: Record<string, any> = {}

        const unsubscribe = onSnapshot(
          q,
          async (snapshot) => {
            const messagesList: Message[] = []

            for (const docSnapshot of snapshot.docs) {
              const data = docSnapshot.data()
              let senderName = data.senderId

              // Get sender name from cache or fetch
              if (!userCache[data.senderId]) {
                try {
                  const userDocRef = doc(db, "users", data.senderId)
                  const userDocSnapshot = await getDoc(userDocRef)

                  if (userDocSnapshot.exists()) {
                    userCache[data.senderId] = userDocSnapshot.data()
                  }
                } catch (error) {
                  console.error("Error fetching sender info:", error)
                }
              }

              const userData = userCache[data.senderId]
              senderName = userData?.displayName || userData?.email?.split("@")[0] || data.senderId

              messagesList.push({
                id: docSnapshot.id,
                text: data.text || "",
                senderId: data.senderId || "",
                timestamp: data.timestamp || null,
                senderName,
              })
            }

            setMessages(messagesList)
            scrollToBottom()
          },
          (error) => {
            console.error("Error fetching messages:", error)
            setError(`Failed to load messages: ${error.message}`)
            toast({
              title: "Error",
              description: "Failed to load messages: " + error.message,
              variant: "destructive",
            })
          },
        )

        // Store the unsubscribe function
        unsubscribeRefs.current.push(unsubscribe);
        
        return unsubscribe
      } catch (error: any) {
        console.error("Error setting up messages:", error)
        setError(`Failed to set up messages: ${error.message}`)
        toast({
          title: "Error",
          description: "Failed to set up messages: " + error.message,
          variant: "destructive",
        })
        return () => {}
      }
    }

    const unsubscribePromise = fetchMessages()
    
    return () => {
      unsubscribePromise
        .then((unsubscribe) => {
          if (unsubscribe) {
            // Store the unsubscribe function
            unsubscribeRefs.current.push(unsubscribe);
            unsubscribe();
          }
        })
        .catch((error) => {
          console.error("Error cleaning up message subscription:", error)
        })
    }
  }, [selectedUser, user, db, toast, isAuthenticated])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim() || !selectedUser || !user || !db || !isAuthenticated) return

    try {
      const chatId = [user.uid, selectedUser].sort().join("_")

      // Update the chat document
      const chatRef = doc(db, "chats", chatId)

      // Check if the chat document exists
      const chatDoc = await getDoc(chatRef)

      // Create the chat document if it doesn't exist
      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [user.uid, selectedUser],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else {
        // Update the chat document if it exists
        await setDoc(
          chatRef,
          {
            participants: [user.uid, selectedUser],
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      }

      // Add the message
      const messagesRef = collection(db, "chats", chatId, "messages")
      await addDoc(messagesRef, {
        text: message,
        senderId: user.uid,
        timestamp: serverTimestamp(),
      })

      setMessage("")
    } catch (error: any) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "Failed to send message: " + error.message,
        variant: "destructive",
      })
    }
  }

  const handleSignOut = async () => {
    try {
      // Clean up all listeners before signing out
      unsubscribeRefs.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          try {
            unsubscribe();
          } catch (e) {
            console.warn("Error unsubscribing:", e);
          }
        }
      });
      
      // Clear the unsubscribe references
      unsubscribeRefs.current = [];
      
      // Sign out
      await signOut()
    } catch (error: any) {
      console.error("Sign out error:", error)
      toast({
        title: "Error signing out",
        description: error?.message || "An unknown error occurred",
        variant: "destructive",
      })
    }
  }

  const getSelectedUserName = () => {
    if (!selectedUser) return "Select a user"
    const selected = users.find((u) => u.id === selectedUser)
    return selected?.displayName || selected?.email?.split("@")[0] || selected?.email || "Unknown user"
  }

  const getInitials = (name: string) => {
    if (!name) return "?"
    return name.substring(0, 2).toUpperCase()
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button className="mt-4 w-full" onClick={handleSignOut}>
            Sign Out and Try Again
          </Button>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-1/4 border-r border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Loading users...</h2>
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium">Loading messages...</h3>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-1/4 border-r border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <h2 className="text-xl font-bold">Chat App</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Avatar>
            <AvatarFallback>{user?.email ? getInitials(user.email) : "U"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user?.displayName || user?.email?.split("@")[0]}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {debugInfo && (
          <div className="mb-2 p-2 bg-muted rounded text-xs overflow-auto">
            <p className="font-mono">{debugInfo}</p>
          </div>
        )}

        <Separator className="my-2" />

        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4" />
          <h3 className="font-medium">Users</h3>
        </div>

        <ScrollArea className="h-[calc(100vh-180px)]">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No users found</p>
          ) : (
            users.map((chatUser) => (
              <Button
                key={chatUser.id}
                variant={selectedUser === chatUser.id ? "secondary" : "ghost"}
                className="w-full justify-start mb-1"
                onClick={() => setSelectedUser(chatUser.id)}
              >
                <Avatar className="h-6 w-6 mr-2">
                  <AvatarFallback>{getInitials(chatUser.email)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{chatUser.displayName || chatUser.email.split("@")[0]}</span>
              </Button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-border flex items-center">
          {selectedUser ? (
            <>
              <Avatar className="h-8 w-8 mr-2">
                <AvatarFallback>{getInitials(getSelectedUserName())}</AvatarFallback>
              </Avatar>
              <h3 className="font-medium">{getSelectedUserName()}</h3>
            </>
          ) : (
            <h3 className="font-medium text-muted-foreground">Select a user to start chatting</h3>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {!selectedUser ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a user to start chatting</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isCurrentUser = msg.senderId === user?.uid
              return (
                <div
                  key={msg.id}
                  className={cn("flex items-start mb-4", isCurrentUser ? "justify-end" : "justify-start")}
                >
                  {!isCurrentUser && (
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarFallback>{getInitials(msg.senderName)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg p-3",
                      isCurrentUser ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    <p>{msg.text}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {msg.timestamp
                        ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Sending..."}
                    </p>
                  </div>
                  {isCurrentUser && (
                    <Avatar className="h-8 w-8 ml-2">
                      <AvatarFallback>{user?.email ? getInitials(user.email) : "U"}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Message Input */}
        {selectedUser && (
          <form onSubmit={handleSendMessage} className="p-4 border-t border-border flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
