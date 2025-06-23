'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Home, TrendingUp, Shield, Sparkles, MapPin, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import FeatureCard from '@/components/FeatureCard';
import PropertyShowcase from '@/components/PropertyShowcase';
import TestimonialCarousel from '@/components/TestimonialCarousel';
import { ChatWidget } from '@/components/chat/ChatWidget';

const stats = [
  { label: 'Properties Listed', value: '50,000+', icon: Home },
  { label: 'Happy Customers', value: '10,000+', icon: TrendingUp },
  { label: 'UK Coverage', value: '100%', icon: MapPin },
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearch = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
          <div className="absolute top-40 right-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
        </div>

        <div className="container mx-auto px-4 pt-20 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* AI Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600/10 to-purple-600/10 px-4 py-2 rounded-full mb-6 border border-blue-200/20"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">AI-Powered Property Search</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
              Find Your Perfect Home
              <br />
              <span className="text-3xl md:text-5xl">With Natural Language</span>
            </h1>

            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
              Simply describe your dream property in your own words. Our AI understands exactly what you're looking for.
            </p>

            {/* Semantic Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <motion.div
                animate={{ 
                  boxShadow: isSearchFocused 
                    ? '0 20px 40px -15px rgba(0, 0, 0, 0.2)' 
                    : '0 10px 25px -10px rgba(0, 0, 0, 0.1)'
                }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSubmit={handleSearch}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="Try: 'Modern flat near tube station with a balcony' or 'Family home with garden near good schools'"
                  className="w-full"
                />
              </motion.div>

              {/* Example Searches */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 flex flex-wrap gap-2 justify-center"
              >
                {[
                  'Pet-friendly flat with outdoor space',
                  'Victorian house needing renovation',
                  'New build near tech companies',
                ].map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchQuery(example);
                      handleSearch(example);
                    }}
                    className="text-sm px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </motion.div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mt-20"
          >
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <stat.icon className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Why Choose Moov?</h2>
            <p className="text-xl text-gray-600">Experience the future of property search</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={Search}
              title="Natural Language Search"
              description="Describe your ideal home in plain English. No more complex filters or forms."
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={Sparkles}
              title="AI-Powered Matching"
              description="Our AI understands context and finds properties that truly match your needs."
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={Shield}
              title="Verified Listings"
              description="All properties are verified and updated in real-time for accuracy."
              gradient="from-green-500 to-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Property Showcase */}
      <PropertyShowcase />

      {/* Testimonials */}
      <TestimonialCarousel />

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-4">Ready to Find Your Dream Home?</h2>
            <p className="text-xl mb-8 opacity-90">Join thousands who've found their perfect property with Moov</p>
            <button
              onClick={() => router.push('/search')}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Start Searching
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      <ChatWidget />
    </div>
  );
}
