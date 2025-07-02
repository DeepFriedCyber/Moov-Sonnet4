import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Check } from 'lucide-react';
import { ErrorFallbackProps } from './ErrorBoundary';

export function ErrorFallback({ 
  error, 
  errorInfo, 
  resetError, 
  errorId 
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyError = async () => {
    const errorDetails = {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      errorId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = JSON.stringify(errorDetails, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReportBug = () => {
    const subject = encodeURIComponent(`Bug Report: ${error?.message || 'Unknown Error'}`);
    const body = encodeURIComponent(`
Error ID: ${errorId}
Error Message: ${error?.message}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}

Please describe what you were doing when this error occurred:
[Your description here]

Technical Details:
${error?.stack}
    `);
    
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
  };

  const goHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        {/* Error Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Oops! Something went wrong
          </h1>
          <p className="text-gray-600">
            We're sorry, but something unexpected happened. 
            Don't worry, our team has been notified.
          </p>
          {errorId && (
            <p className="text-sm text-gray-500 mt-2">
              Error ID: <code className="bg-gray-100 px-1 rounded">{errorId}</code>
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-4">
          <button
            onClick={resetError}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>

          <button
            onClick={goHome}
            className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </button>
        </div>

        {/* Error Details Toggle */}
        <div className="border-t pt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            {showDetails ? 'Hide' : 'Show'} technical details
          </button>

          {showDetails && (
            <div className="bg-gray-50 rounded-md p-3 text-xs font-mono">
              <div className="mb-2">
                <strong>Error:</strong> {error?.message}
              </div>
              {error?.stack && (
                <div className="mb-2">
                  <strong>Stack:</strong>
                  <pre className="whitespace-pre-wrap text-xs mt-1 max-h-32 overflow-y-auto">
                    {error.stack}
                  </pre>
                </div>
              )}
              {errorInfo?.componentStack && (
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="whitespace-pre-wrap text-xs mt-1 max-h-32 overflow-y-auto">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}

          {showDetails && (
            <div className="flex space-x-2 mt-3">
              <button
                onClick={handleCopyError}
                className="flex items-center px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy Details
                  </>
                )}
              </button>

              <button
                onClick={handleReportBug}
                className="flex items-center px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                <Bug className="w-3 h-3 mr-1" />
                Report Bug
              </button>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center mt-4 text-xs text-gray-500">
          If this problem persists, please contact our support team.
        </div>
      </div>
    </div>
  );
}

// Minimal error fallback for critical errors
export function MinimalErrorFallback({ resetError }: { resetError: () => void }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
      <div className="flex items-center">
        <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
        <div>
          <h3 className="text-sm font-medium text-red-800">
            Something went wrong
          </h3>
          <p className="text-sm text-red-700 mt-1">
            Please try refreshing the page.
          </p>
        </div>
      </div>
      <button
        onClick={resetError}
        className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
      >
        Try again
      </button>
    </div>
  );
}