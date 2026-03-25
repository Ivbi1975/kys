import { Component, Suspense, type ReactNode, type ErrorInfo } from "react";

interface LazyLoadBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface LazyLoadBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class LazyErrorBoundary extends Component<LazyLoadBoundaryProps, LazyLoadBoundaryState> {
  state: LazyLoadBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Lazy load error:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Loading chunk") ||
        this.state.error?.message?.includes("ChunkLoadError");

      return (
        <div className="flex flex-col items-center justify-center p-6 gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            {isChunkError
              ? "Bileşen yüklenemedi. İnternet bağlantınızı kontrol edin."
              : "Bir hata oluştu."}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const defaultFallback = (
  <div className="flex items-center justify-center p-6">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export function LazyLoadBoundary({ children, fallback = defaultFallback }: LazyLoadBoundaryProps) {
  return (
    <LazyErrorBoundary>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </LazyErrorBoundary>
  );
}
