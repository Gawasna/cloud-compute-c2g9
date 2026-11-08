"use client";

import { useEffect } from "react";
import { captureLooseError } from "@/lib/observability";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureLooseError(error, {
      digest: error.digest,
      source: "app/error",
    });
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-md text-center space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Không thể tải dữ liệu trang
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Đã xảy ra lỗi trong quá trình hiển thị giao diện.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-900 p-2 rounded">
            Mã định danh: {error.digest}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium transition-colors"
          >
            Tải lại phần này
          </button>
        </div>
      </div>
    </div>
  );
}
