import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import heLegal from '@/components/i18n/locales/he/legal';
import enLegal from '@/components/i18n/locales/en/legal';
import { captureError } from "@/lib/errorTracking";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }

    // Store error for potential reporting
    try {
      const errorLog = JSON.parse(localStorage.getItem('error_log') || '[]');
      errorLog.push({
        message: error.message,
        stack: error.stack?.slice(0, 500),
        componentStack: errorInfo.componentStack?.slice(0, 500),
        timestamp: Date.now(),
        url: window.location.href,
      });
      // Keep only last 20 errors
      if (errorLog.length > 20) errorLog.splice(0, errorLog.length - 20);
      localStorage.setItem('error_log', JSON.stringify(errorLog));
    } catch (e) { /* ignore storage errors */ }

    // Forward to error tracking (Sentry when available, console in dev)
    captureError(error, { componentStack: errorInfo.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Detect language from localStorage to determine direction
      const storedLanguage = typeof window !== 'undefined'
        ? localStorage.getItem('language') || 'hebrew'
        : 'hebrew';
      const isRTL = storedLanguage === 'hebrew' || storedLanguage === 'yiddish';
      const labels = (storedLanguage === 'english' ? enLegal : heLegal).legal;
      const { errorTitle: heading, errorDescription: description, retry: tryAgainLabel, home: goHomeLabel } = labels;

      return (
        <div
          className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4"
          dir={isRTL ? "rtl" : "ltr"}
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-amber-500" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {heading}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {description}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleReset} variant="default" className="gap-2 min-h-11" style={{ minHeight: 44 }} aria-label={tryAgainLabel}>
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                {tryAgainLabel}
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" className="gap-2 min-h-11" style={{ minHeight: 44 }} aria-label={goHomeLabel}>
                <Home className="w-4 h-4" aria-hidden="true" />
                {goHomeLabel}
              </Button>
            </div>
            <a className="inline-flex min-h-11 items-center underline" href="mailto:support@sipurai.ai">{labels.help}</a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
