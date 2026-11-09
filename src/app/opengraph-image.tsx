import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'CloudStock - Hệ Thống Quản Lý Kho Đám Mây';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #151828 0%, #22263d 50%, #2f3455 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '24px',
              background: 'linear-gradient(140deg, #6c62e6, #af8afd)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 30px rgba(108, 98, 230, 0.45)',
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              <path d="m11 12 2 2 4-4" />
            </svg>
          </div>
          <div
            style={{
              fontSize: '68px',
              fontWeight: 800,
              letterSpacing: '-2px',
              display: 'flex',
            }}
          >
            <span>Cloud</span>
            <span style={{ color: '#8b7cf8' }}>Stock</span>
          </div>
        </div>

        <div
          style={{
            fontSize: '32px',
            fontWeight: 600,
            color: '#e2e8f0',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.4,
            marginBottom: '36px',
          }}
        >
          Hệ Thống Quản Lý Kho Đám Mây Đa Chi Nhánh & Kiểm Kê Tự Động
        </div>

        <div
          style={{
            display: 'flex',
            gap: '16px',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '999px',
              padding: '10px 24px',
              fontSize: '20px',
              color: '#cbd5e1',
            }}
          >
            Role-Based Access Control
          </div>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '999px',
              padding: '10px 24px',
              fontSize: '20px',
              color: '#cbd5e1',
            }}
          >
            Real-Time Audit & Tracking
          </div>
          <div
            style={{
              background: 'rgba(108, 98, 230, 0.25)',
              border: '1px solid rgba(139, 124, 248, 0.4)',
              borderRadius: '999px',
              padding: '10px 24px',
              fontSize: '20px',
              color: '#c4b5fd',
            }}
          >
            Serverless & Edge Ready
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
