'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);

        // Send to error tracking service
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'exception', {
                description: error.toString(),
                fatal: true,
            });
        }

        // Log to your backend error service
        fetch('/api/errors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: error.toString(),
                stack: error.stack,
                errorInfo,
                url: window.location.href,
                userAgent: navigator.userAgent,
            }),
        }).catch(console.error);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
                        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
                        <p className="text-gray-600 mb-4 text-center max-w-md">
                            We're sorry, but something unexpected happened. Please try refreshing the page.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    this.setState({ hasError: false, error: null });
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => {
                                    window.location.reload();
                                }}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Refresh Page
                            </button>
                        </div>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-4 p-4 bg-gray-100 rounded-lg max-w-2xl w-full">
                                <summary className="cursor-pointer font-semibold">Error Details</summary>
                                <pre className="mt-2 text-sm text-red-600 whitespace-pre-wrap">
                                    {this.state.error.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                )
            );
        }

        return this.props.children;
    }
}