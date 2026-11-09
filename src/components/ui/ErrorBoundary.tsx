"use client";

import React, { Component, type ReactNode, type ComponentType } from "react";
import { captureLooseError } from "@/lib/observability";

export interface SafeBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((reset: () => void, error: Error | null) => ReactNode);
  name?: string;
}

interface SafeBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Isolated React Error Boundary component.
 * Catches JavaScript errors anywhere in its child component tree,
 * logs them to Bugsink via captureLooseError, and displays a fallback UI.
 */
export class SafeBoundary extends Component<SafeBoundaryProps, SafeBoundaryState> {
  constructor(props: SafeBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SafeBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    try {
      captureLooseError(error, {
        source: `ui.boundary.${this.props.name || "generic"}`,
        componentStack: errorInfo.componentStack,
      });
    } catch {
      /* telemetry error must not break rendering */
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.reset, this.state.error);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-900 dark:text-amber-200 text-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Thành phần này tạm thời không thể hiển thị.</p>
            <button
              type="button"
              onClick={this.reset}
              className="px-3 py-1 bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 rounded text-xs font-medium transition-colors"
            >
              Thử lại
            </button>
          </div>
          {this.state.error?.message && (
            <p className="text-xs text-amber-700 dark:text-amber-300 font-mono break-all">
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Higher-Order Component (HOC) wrapping any React component inside a SafeBoundary.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  boundaryProps?: Omit<SafeBoundaryProps, "children">
) {
  const ComponentWithErrorBoundary = (props: P) => (
    <SafeBoundary
      {...boundaryProps}
      name={boundaryProps?.name || WrappedComponent.displayName || WrappedComponent.name}
    >
      <WrappedComponent {...props} />
    </SafeBoundary>
  );
  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;
  return ComponentWithErrorBoundary;
}
