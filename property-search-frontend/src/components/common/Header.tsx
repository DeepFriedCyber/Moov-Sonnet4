import Link from 'next/link'
import { Home, Search, User, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const { user, isAuthenticated, logout } = useAuth()

    return (
        <header className="border-b border-border bg-background shadow-sm">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2">
                        <Home className="w-8 h-8 text-primary" />
                        <span className="text-xl font-bold text-foreground">PropertySearch UK</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-8">
                        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                            Home
                        </Link>
                        <Link href="/search" className="text-muted-foreground hover:text-foreground transition-colors">
                            Search
                        </Link>
                        <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                            About
                        </Link>
                        <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                            Contact
                        </Link>

                        {/* Add role-specific navigation items */}
                        {user?.role === 'agent' && (
                            <Link
                                href="/agent/properties"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                My Properties
                            </Link>
                        )}

                        {user?.role === 'admin' && (
                            <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
                                Admin
                            </Link>
                        )}
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center space-x-4">
                        <Link href="/search" className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                            <Search className="w-5 h-5" />
                        </Link>

                        {isAuthenticated ? (
                            <div className="flex items-center space-x-2">
                                <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                                    Dashboard
                                </Link>
                                <button
                                    onClick={logout}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <Link href="/auth/login" className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                                <User className="w-5 h-5" />
                            </Link>
                        )}

                        <button
                            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label="Toggle mobile menu"
                        >
                            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <nav className="md:hidden border-t border-border bg-background">
                        <div className="px-4 py-2 space-y-2">
                            <Link
                                href="/"
                                className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Home
                            </Link>
                            <Link
                                href="/search"
                                className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Search
                            </Link>
                            <Link
                                href="/about"
                                className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                About
                            </Link>
                            <Link
                                href="/contact"
                                className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Contact
                            </Link>
                            <Link
                                href="/account"
                                className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Account
                            </Link>
                        </div>
                    </nav>
                )}
            </div>
        </header>
    )
}