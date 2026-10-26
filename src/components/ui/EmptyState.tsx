import React from 'react';

export interface EmptyStateProps {
  message?: string;
  icon?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  message = 'Không có dữ liệu phù hợp.',
  icon = '◈',
  actionText,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`empty-state-container ${className}`.trim()}
      style={{
        textAlign: 'center',
        padding: '36px 16px',
        color: 'var(--muted, #7c8498)',
      }}
    >
      <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.6 }}>{icon}</div>
      <p style={{ margin: '0 0 12px', fontSize: '13px' }}>{message}</p>
      {actionText && onAction && (
        <button
          type="button"
          className="btn secondary small-btn"
          onClick={onAction}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
