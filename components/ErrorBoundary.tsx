import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="max-w-md w-full mx-4 p-6 bg-gray-800 rounded-lg shadow-lg">
            <div className="text-center">
              <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
              <h2 className="text-xl font-bold text-white mb-2">
                Щось пішло не так
              </h2>
              <p className="text-gray-300 mb-4">
                Виникла неочікувана помилка. Спробуйте перезавантажити сторінку.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Перезавантажити
              </button>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-gray-400 text-sm">
                    Деталі помилки (development)
                  </summary>
                  <pre className="mt-2 text-xs text-red-300 bg-gray-900 p-2 rounded overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;