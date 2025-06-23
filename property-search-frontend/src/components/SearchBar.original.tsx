'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Mic, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onFocus,
  onBlur,
  placeholder = "Describe your ideal property...",
  className = ""
}: SearchBarProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      setIsProcessing(true);
      setTimeout(() => {
        onSubmit(value);
        setIsProcessing(false);
      }, 500);
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice search is not supported in your browser');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-UK';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onChange(transcript);
    };

    recognition.start();
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative group">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          className="w-full px-6 py-5 pr-32 text-lg bg-white rounded-2xl border-2 border-gray-200 
                   focus:border-blue-500 focus:outline-none transition-all duration-300
                   placeholder:text-gray-400 shadow-sm"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Voice Input */}
          <AnimatePresence>
            {!value && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                type="button"
                onClick={handleVoiceInput}
                className={`p-3 rounded-xl transition-colors ${
                  isListening 
                    ? 'bg-red-500 text-white' 
                    : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <Mic className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Clear Button */}
          <AnimatePresence>
            {value && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                type="button"
                onClick={() => onChange('')}
                className="p-3 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Search Button */}
          <button
            type="submit"
            disabled={!value.trim() || isProcessing}
            className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl
                     hover:shadow-lg transition-all duration-300 disabled:opacity-50 
                     disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Listening Indicator */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -bottom-8 left-0 text-sm text-red-500 flex items-center gap-2"
            >
              <div className="flex gap-1">
                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse" />
                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse animation-delay-200" />
                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse animation-delay-400" />
              </div>
              Listening...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}