import React from 'react';
import { CheckCircle2Icon } from './Icons';

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
      <CheckCircle2Icon size={16} />
      <span>{message}</span>
    </div>
  );
}
