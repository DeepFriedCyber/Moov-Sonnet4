'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

const testimonials = [
  {
    id: 1,
    name: "Sarah Johnson",
    role: "First-time Buyer",
    content: "I simply said &apos;modern flat near good transport links with a balcony&apos; and Moov found exactly what I wanted in minutes. The AI really understands what you&apos;re looking for!",
    rating: 5,
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b96c?w=80&h=80&fit=crop&crop=face"
  },
  {
    id: 2,
    name: "David Chen",
    role: "Property Investor",
    content: "As an investor, I needed properties in specific areas with certain yields. The natural language search saved me hours of filtering through irrelevant listings.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face"
  },
  {
    id: 3,
    name: "Emma Williams",
    role: "Family Relocating",
    content: "We were moving to a new city and needed a family home near good schools and parks. Moov&apos;s AI understood our family needs perfectly and found us our dream home.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face"
  }
];

export default function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const next = () => {
    setCurrent((prev) => (prev + 1) % testimonials.length);
  };

  const prev = () => {
    setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold mb-4">What Our Users Say</h2>
          <p className="text-xl text-gray-600">Real stories from people who found their perfect home</p>
        </motion.div>

        <div className="max-w-4xl mx-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-50 rounded-2xl p-8 md:p-12"
            >
              <div className="flex items-center mb-6">
                {[...Array(testimonials[current].rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>

              <blockquote className="text-xl md:text-2xl text-gray-800 mb-8 font-light leading-relaxed">
                &ldquo;{testimonials[current].content}&rdquo;
              </blockquote>

              <div className="flex items-center">
                <Image
                  src={testimonials[current].image}
                  alt={testimonials[current].name}
                  width={48}
                  height={48}
                  className="rounded-full mr-4"
                />
                <div>
                  <div className="font-semibold text-gray-900">{testimonials[current].name}</div>
                  <div className="text-gray-600">{testimonials[current].role}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={prev}
              className="p-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>

            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrent(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${current === index ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="p-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}