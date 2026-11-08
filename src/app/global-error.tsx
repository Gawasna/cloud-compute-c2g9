"use client";

import { useEffect } from "react";
import { captureStrictError } from "@/lib/observability";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureStrictError(error, {
      digest: error.digest,
      source: "app/global-error",
    });
  }, [error]);

  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-xl text-center space-y-4">
          <h2 className="text-xl font-bold text-red-400">
            Đã xảy ra sự cố hệ thống nghiêm trọng
          </h2>
          <p className="text-sm text-slate-300">
            Hệ thống đã tự động ghi nhận báo cáo sự cố kỹ thuật. Vui lòng thử tải lại trang hoặc liên hệ quản trị viên nếu sự cố tiếp diễn.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-slate-400 bg-slate-950 p-2 rounded">
              Mã lỗi: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-colors"
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
