import React from 'react';

export interface ToastProps {
  message: string;
  onClose?: () => void;
  className?: string;
}

export default function Toast({ message, onClose, className = '' }: ToastProps) {
  if (!message) return null;
  return (
    <div
      className={`toast ${className}`.trim()}
      role="status"
      onClick={onClose}
    >
      ✓ {message}
    </div>
  );
}
