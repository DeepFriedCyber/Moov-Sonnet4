import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Authentication - PropertySearch UK',
    description: 'Login or register for PropertySearch UK',
}

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="max-w-md w-full">
                {children}
            </div>
        </div>
    )
}