'use client'

import { useState } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: "Hi! I'm your AI property assistant. How can I help you find your perfect home today?",
            sender: 'ai',
            timestamp: new Date()
        }
    ])
    const [inputMessage, setInputMessage] = useState('')

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputMessage.trim()) return

        // Add user message
        const userMessage = {
            id: messages.length + 1,
            text: inputMessage,
            sender: 'user' as const,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInputMessage('')

        // Simulate AI response
        setTimeout(() => {
            const aiResponse = {
                id: messages.length + 2,
                text: "I understand you're looking for properties. Let me help you with that! Try using our search box above to find properties that match your criteria.",
                sender: 'ai' as const,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, aiResponse])
        }, 1000)
    }

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-96 bg-white rounded-lg shadow-2xl border z-40 flex flex-col">
                    {/* Header */}
                    <div className="bg-blue-600 text-white p-4 rounded-t-lg">
                        <h3 className="font-semibold">Property Assistant</h3>
                        <p className="text-sm opacity-90">Ask me anything about properties!</p>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-xs p-3 rounded-lg ${message.sender === 'user'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-800'
                                        }`}
                                >
                                    <p className="text-sm">{message.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="border-t p-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Ask about properties..."
                                className="flex-1 p-2 border rounded-lg focus:outline-none focus:border-blue-500"
                            />
                            <button
                                type="submit"
                                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    )
}