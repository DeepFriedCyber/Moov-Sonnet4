import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
    icon: LucideIcon;
    title: string;
    description: string;
    gradient: string;
}

export default function FeatureCard({ icon: Icon, title, description, gradient }: FeatureCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            className="relative p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
        >
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 rounded-2xl`} />

            <div className={`inline-flex p-3 bg-gradient-to-br ${gradient} rounded-xl mb-4`}>
                <Icon className="w-6 h-6 text-white" />
            </div>

            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-600">{description}</p>
        </motion.div>
    );
}