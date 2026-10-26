import React, { type ReactNode } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  actions,
  className = '',
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`dialog ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}
