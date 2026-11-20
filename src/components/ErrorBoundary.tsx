import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'خطای غیرمنتظره‌ای رخ داد.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Mizan ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center p-6 bg-[#FAF6F0] dark:bg-[#14110E] text-[#261B12] dark:text-[#F5EFE6]"
        >
          <div className="mizan-glass-strong rounded-3xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-bold">خطا در بارگذاری میزان</h1>
            <p className="text-sm text-[#6E5643] dark:text-[#B8A593] leading-relaxed">
              ارتباط با پایگاه داده یا وضعیت صفحه دچار اختلال شد. می‌توانید صفحه را دوباره بارگذاری کنید.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#9A5B13] hover:bg-[#7F4A0E] text-white text-sm font-semibold transition-colors min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>بارگذاری مجدد</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
