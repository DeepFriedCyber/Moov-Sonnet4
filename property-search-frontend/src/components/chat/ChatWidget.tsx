'use client'

import { useState } from 'react'

interface Message {
    id: string
    text: string
    sender: 'user' | 'assistant'
    timestamp: Date
}

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: "Hi! I'm here to help you find the perfect property. What are you looking for?",
            sender: 'assistant',
            timestamp: new Date()
        }
    ])
    const [inputValue, setInputValue] = useState('')

    const handleSendMessage = () => {
        if (!inputValue.trim()) return

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInputValue('')

        // Simulate assistant response after a short delay
        setTimeout(() => {
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Thanks for your message! I'd be happy to help you with your property search. Can you tell me more about your requirements?",
                sender: 'assistant',
                timestamp: new Date()
            }
            setMessages(prev => [...prev, assistantMessage])
        }, 1000)
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSendMessage()
        }
    }

    return (
        <>
            {/* Chat Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-110 z-50"
            >
                {isOpen ? (
                    <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col animate-fade-in">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 rounded-t-2xl bg-blue-600 text-white">
                        <h3 className="font-semibold">Property Assistant</h3>
                        <p className="text-sm text-blue-100">How can I help you find your perfect home?</p>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-4 overflow-y-auto">
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`p-3 rounded-lg max-w-[85%] ${message.sender === 'assistant'
                                            ? 'bg-gray-100 text-gray-800'
                                            : 'bg-blue-600 text-white ml-auto'
                                        }`}
                                >
                                    <p className="text-sm">{message.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-gray-200">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask me anything..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleSendMessage}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}