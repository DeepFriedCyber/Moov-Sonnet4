import Link from 'next/link'
import { Home, Mail, Phone, MapPin } from 'lucide-react'

export function Footer() {
    return (
        <footer className="bg-gray-900 text-white">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Company Info */}
                    <div>
                        <Link href="/" className="flex items-center space-x-2 mb-4">
                            <Home className="w-8 h-8 text-blue-400" />
                            <span className="text-xl font-bold">PropertySearch UK</span>
                        </Link>
                        <p className="text-gray-400 mb-4">
                            AI-powered property search platform helping you find your perfect home in the UK.
                        </p>
                        <div className="flex space-x-4">
                            <a href="#" className="text-gray-400 hover:text-white transition-colors">
                                Facebook
                            </a>
                            <a href="#" className="text-gray-400 hover:text-white transition-colors">
                                Twitter
                            </a>
                            <a href="#" className="text-gray-400 hover:text-white transition-colors">
                                LinkedIn
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link href="/search" className="text-gray-400 hover:text-white transition-colors">
                                    Search Properties
                                </Link>
                            </li>
                            <li>
                                <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
                                    About Us
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                                    Contact
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Services */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Services</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                                    Property Valuation
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                                    Mortgage Advice
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                                    Legal Services
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                                    Property Management
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <MapPin className="w-4 h-4 text-blue-400" />
                                <span className="text-gray-400">London, UK</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Phone className="w-4 h-4 text-blue-400" />
                                <span className="text-gray-400">+44 20 1234 5678</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-blue-400" />
                                <span className="text-gray-400">info@propertysearch.co.uk</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-800 mt-8 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <p className="text-gray-400">
                            © 2024 PropertySearch UK. All rights reserved.
                        </p>
                        <div className="flex space-x-6 mt-4 md:mt-0">
                            <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                                Privacy Policy
                            </Link>
                            <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                                Terms of Service
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}