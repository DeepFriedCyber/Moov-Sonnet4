// src/components/homepage/HeroSection.tsx - REFACTORED
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Home, TrendingUp, Shield, Sparkles, MapPin, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface HeroSectionProps {
    onSearch: (query: string) => void;
}

const stats = [
    { label: 'Properties Listed', value: '50,000+', icon: Home },
    { label: 'Happy Customers', value: '10,000+', icon: TrendingUp },
    { label: 'UK Coverage', value: '100%', icon: MapPin },
];

const exampleSearches = [
    'Pet-friendly flat with outdoor space',
    'Victorian house needing renovation',
    'New build near tech companies',
];

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
};

export const HeroSection = ({ onSearch }: HeroSectionProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            onSearch(searchQuery.trim());
        }
    };

    const handleExampleClick = (example: string) => {
        setSearchQuery(example);
        onSearch(example);
    };

    return (
        <section className="relative min-h-[80vh] overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
                <div className="absolute top-40 right-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
                <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
            </div>

            <div className="container mx-auto px-4 pt-20 pb-32">
                <motion.div
                    className="text-center max-w-4xl mx-auto"
                    initial="initial"
                    animate="animate"
                >
                    {/* AI Badge */}
                    <motion.div
                        {...fadeInUp}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600/10 to-purple-600/10 
                                   px-4 py-2 rounded-full mb-6 border border-blue-200/20"
                    >
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">AI-Powered Property Search</span>
                    </motion.div>

                    <motion.h1
                        {...fadeInUp}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 
                                   bg-clip-text text-transparent"
                    >
                        Find Your Perfect Home
                        <br />
                        <span className="text-3xl md:text-5xl">With Natural Language</span>
                    </motion.h1>

                    <motion.p
                        {...fadeInUp}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto"
                    >
                        Simply describe your dream property in your own words. Our AI understands exactly what you're looking for.
                    </motion.p>

                    {/* Enhanced Search Form */}
                    <motion.div
                        {...fadeInUp}
                        transition={{ delay: 0.3 }}
                        className="relative max-w-2xl mx-auto mb-4"
                    >
                        <motion.div
                            animate={{
                                boxShadow: isSearchFocused
                                    ? '0 20px 40px -15px rgba(0, 0, 0, 0.2)'
                                    : '0 10px 25px -10px rgba(0, 0, 0, 0.1)'
                            }}
                            transition={{ duration: 0.3 }}
                            className="relative"
                        >
                            <form onSubmit={handleSubmit}>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => setIsSearchFocused(false)}
                                    placeholder="Try: 'Modern flat near tube station with a balcony' or 'Family home with garden near good schools'"
                                    className="w-full px-6 py-5 pr-16 text-lg bg-white rounded-2xl border-2 border-gray-200 
                                             focus:border-blue-500 focus:outline-none transition-all duration-300
                                             placeholder:text-gray-400 shadow-sm"
                                />
                                <button
                                    type="submit"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-gradient-to-r 
                                             from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg 
                                             transition-all duration-300 disabled:opacity-50"
                                    disabled={!searchQuery.trim()}
                                >
                                    <Search className="w-5 h-5" />
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>

                    {/* Example Searches */}
                    <motion.div
                        {...fadeInUp}
                        transition={{ delay: 0.4 }}
                        className="flex flex-wrap gap-2 justify-center"
                    >
                        {exampleSearches.map((example, index) => (
                            <motion.button
                                key={example}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 + index * 0.1 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleExampleClick(example)}
                                className="text-sm px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 
                                         rounded-full hover:bg-gray-50 hover:shadow-md transition-all duration-300"
                            >
                                {example}
                            </motion.button>
                        ))}
                    </motion.div>
                </motion.div>

                {/* Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mt-20"
                >
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 + index * 0.1 }}
                            whileHover={{ scale: 1.05 }}
                            className="text-center group cursor-pointer"
                        >
                            <motion.div
                                whileHover={{ rotate: 360 }}
                                transition={{ duration: 0.6 }}
                            >
                                <stat.icon className="w-8 h-8 mx-auto mb-2 text-blue-600 group-hover:text-purple-600 transition-colors" />
                            </motion.div>
                            <div className="text-3xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {stat.value}
                            </div>
                            <div className="text-sm text-gray-600">{stat.label}</div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};