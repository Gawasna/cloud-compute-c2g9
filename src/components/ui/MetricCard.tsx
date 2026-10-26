import React from 'react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  changeText?: string;
  changeType?: 'positive' | 'negative';
  icon?: string;
  className?: string;
}

export default function MetricCard({
  title,
  value,
  changeText,
  changeType = 'positive',
  icon,
  className = '',
}: MetricCardProps) {
  return (
    <div className={`metric ${className}`.trim()}>
      <span>{title}</span>
      <b>{value}</b>
      {changeText && (
        <small className={`change ${changeType}`}>{changeText}</small>
      )}
      {icon && <span className="metric-icon">{icon}</span>}
    </div>
  );
}
