import React, { useState, useRef, useEffect, memo } from 'react';
import { Send, Bot, User, Loader2, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { cn, formatPrice } from '@/lib/utils';

interface ChatMessage {
    id: string;
    type: 'user' | 'bot';
    content: string;
    timestamp: Date;
    propertyResults?: PropertyResult[];
    suggestions?: string[];
}

interface PropertyResult {
    id: string;
    title: string;
    price: number;
    location: {
        city: string;
        postcode: string;
    };
    bedrooms: number;
    bathrooms: number;
}

interface ChatResponse {
    response: string;
    sessionId: string;
    propertyResults?: PropertyResult[];
    suggestions?: string[];
}

interface ChatBotProps {
    maxMessages?: number;
    className?: string;
}

export const ChatBot = memo(function ChatBot({
    maxMessages = 50,
    className
}: ChatBotProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            type: 'bot',
            content: 'Hello! I\'m your Property Assistant. I can help you find properties using natural language. Try asking me something like "Find me a 2 bedroom apartment in London under £500k".',
            timestamp: new Date(),
            suggestions: [
                'Show me 2-bedroom apartments',
                'Properties with gardens',
                'Houses under £400k',
                'Luxury penthouses',
            ],
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [sessionId, setSessionId] = useState<string>('');
    const [isTyping, setIsTyping] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const chatMutation = useMutation({
        mutationFn: async (message: string): Promise<ChatResponse> => {
            const response = await fetch('http://localhost:3001/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    sessionId: sessionId || undefined,
                }),
            });

            if (!response.ok) {
                throw new Error('Chat service temporarily unavailable');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to send message');
            }

            return data.data;
        },
        onSuccess: (data) => {
            setSessionId(data.sessionId);
            setIsTyping(false);

            const botMessage: ChatMessage = {
                id: Date.now().toString(),
                type: 'bot',
                content: data.response,
                timestamp: new Date(),
                propertyResults: data.propertyResults,
                suggestions: data.suggestions,
            };

            setMessages(prev => {
                const newMessages = [...prev, botMessage];
                return newMessages.slice(-maxMessages);
            });
        },
        onError: (error) => {
            setIsTyping(false);

            const errorMessage: ChatMessage = {
                id: Date.now().toString(),
                type: 'bot',
                content: `Sorry, I'm temporarily unavailable. ${error.message}. Please try again in a moment.`,
                timestamp: new Date(),
                suggestions: ['Try again', 'Contact support'],
            };

            setMessages(prev => {
                const newMessages = [...prev, errorMessage];
                return newMessages.slice(-maxMessages);
            });
        },
    });

    const handleSendMessage = async () => {
        if (!inputValue.trim() || chatMutation.isPending) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => {
            const newMessages = [...prev, userMessage];
            return newMessages.slice(-maxMessages);
        });

        setInputValue('');
        setIsTyping(true);

        // Focus back to input
        setTimeout(() => {
            inputRef.current?.focus();
        }, 0);

        chatMutation.mutate(inputValue.trim());
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setInputValue(suggestion);
        inputRef.current?.focus();
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    return (
        <div className={cn('flex flex-col h-96 bg-white border rounded-lg shadow-lg', className)}>
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b bg-blue-50">
                <Bot className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Property Assistant</h3>
            </div>

            {/* Messages */}
            <div
                className="flex-1 overflow-y-auto p-4 space-y-4"
                role="log"
                aria-live="polite"
                aria-label="Chat conversation"
            >
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            'flex gap-3',
                            message.type === 'user' ? 'justify-end' : 'justify-start'
                        )}
                    >
                        {message.type === 'bot' && (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-blue-600" />
                            </div>
                        )}

                        <div
                            className={cn(
                                'max-w-xs lg:max-w-md px-4 py-2 rounded-lg',
                                message.type === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-900'
                            )}
                        >
                            <p className="text-sm">{message.content}</p>

                            {/* Property Results */}
                            {message.propertyResults && message.propertyResults.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {message.propertyResults.map((property) => (
                                        <div
                                            key={property.id}
                                            className="p-3 bg-white rounded border text-gray-900 text-xs"
                                        >
                                            <h4 className="font-semibold">{property.title}</h4>
                                            <p className="text-green-600 font-bold">{formatPrice(property.price)}</p>
                                            <p className="text-gray-600">
                                                {property.bedrooms} bed, {property.bathrooms} bath
                                            </p>
                                            <p className="text-gray-600">
                                                {property.location.city}, {property.location.postcode}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Suggestions */}
                            {message.suggestions && message.suggestions.length > 0 && (
                                <div className="mt-3 space-y-1">
                                    {message.suggestions.map((suggestion, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            className="block w-full text-left text-xs px-2 py-1 bg-white text-gray-700 rounded border hover:bg-gray-50 transition-colors"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <p className="text-xs opacity-70 mt-1">
                                {message.timestamp.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>

                        {message.type === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-white" />
                            </div>
                        )}
                    </div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Assistant is typing...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask me about properties..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={chatMutation.isPending}
                        aria-label="Type your message"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || chatMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Send message"
                    >
                        {chatMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
});