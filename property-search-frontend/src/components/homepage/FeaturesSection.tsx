// src/components/homepage/FeaturesSection.tsx - REFACTORED
import React from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, Shield } from 'lucide-react';

const features = [
    {
        icon: Search,
        title: 'Natural Language Search',
        description: 'Describe your ideal home in plain English. No more complex filters or forms.',
        testId: 'search-icon',
        gradient: 'from-blue-500 to-cyan-500',
    },
    {
        icon: Sparkles,
        title: 'AI-Powered Matching',
        description: 'Our AI understands context and finds properties that truly match your needs.',
        testId: 'sparkles-icon',
        gradient: 'from-purple-500 to-pink-500',
    },
    {
        icon: Shield,
        title: 'Verified Listings',
        description: 'All properties are verified and updated in real-time for accuracy.',
        testId: 'shield-icon',
        gradient: 'from-green-500 to-emerald-500',
    },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6,
            ease: "easeOut",
        },
    },
};

export const FeaturesSection = () => {
    return (
        <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-blue-50">
            <div className="container mx-auto px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-slate-900 to-blue-900 bg-clip-text text-transparent">
                        Why Choose Moov?
                    </h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Experience the future of property search with cutting-edge AI technology
                    </p>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
                >
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            variants={itemVariants}
                            whileHover={{
                                y: -10,
                                transition: { duration: 0.3 }
                            }}
                            className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl 
                                     transition-all duration-300 border border-gray-100 overflow-hidden"
                        >
                            {/* Background Gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 
                                          group-hover:opacity-5 transition-opacity duration-300`} />

                            {/* Icon with Animation */}
                            <motion.div
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                transition={{ duration: 0.3 }}
                                className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.gradient} 
                                          p-4 mb-6 shadow-lg`}
                            >
                                <feature.icon
                                    className="w-full h-full text-white"
                                    data-testid={feature.testId}
                                />
                            </motion.div>

                            <h3 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-blue-600 transition-colors">
                                {feature.title}
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                {feature.description}
                            </p>

                            {/* Hover Effect Border */}
                            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${feature.gradient} 
                                          opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                                style={{
                                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                                    maskComposite: 'xor',
                                    padding: '2px'
                                }}
                            />
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};