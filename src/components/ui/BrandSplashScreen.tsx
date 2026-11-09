export interface BrandSplashScreenProps {
  title?: string;
  message?: string;
}

export default function BrandSplashScreen({
  title = 'CloudStock',
  message = 'Đang xác minh phiên đăng nhập và vai trò…',
}: BrandSplashScreenProps) {
  return (
    <div className="splash-container" role="status" aria-live="polite">
      <div className="splash-card">
        <div className="splash-logo-wrap">
          <div className="splash-logo-icon" aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              <path d="m11 12 2 2 4-4" />
            </svg>
          </div>
        </div>
        <h1 className="splash-title">
          {title === 'CloudStock' ? (
            <>
              Cloud<span>Stock</span>
            </>
          ) : (
            title
          )}
        </h1>
        <p className="splash-message">{message}</p>
        <div className="splash-progress-track" aria-hidden="true">
          <div className="splash-progress-bar" />
        </div>
      </div>
    </div>
  );
}
