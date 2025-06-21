'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

export function SearchBox() {
    const [query, setQuery] = useState('')

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            // Navigate to search results
            window.location.href = `/search?q=${encodeURIComponent(query)}`
        }
    }

    return (
        <form onSubmit={handleSearch} className="relative">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for properties... e.g., '3 bedroom house with garden near good schools'"
                    className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none shadow-lg"
                />
            </div>
            <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
                Search
            </button>
        </form>
    )
}