import React from 'react';
import { EmptyState } from '@/components/ui';
import { type MovementTx, formatDate } from './types';

export interface TransactionsTabProps {
  transactions: MovementTx[];
  onCreateTicket?: () => void;
}

export default function TransactionsTab({
  transactions,
  onCreateTicket,
}: TransactionsTabProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Transaction History</h2>
          <p>Timestamped stock movement log with actor attribution</p>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Ticket ID</th>
              <th>Type</th>
              <th>SKU</th>
              <th>Quantity</th>
              <th>Performed By</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{formatDate(t.date)}</td>
                <td className="mono">{t.id.slice(0, 8)}</td>
                <td>
                  <span className={`tag ${t.type === 'IN' ? 'success' : 'warning'}`}>
                    {t.type === 'IN' ? 'Inbound' : 'Outbound'}
                  </span>
                </td>
                <td className="mono">{t.sku}</td>
                <td>{t.quantity.toLocaleString('en-US')}</td>
                <td>{t.actor}</td>
                <td>{t.note || '—'}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    message="No transaction movements have been recorded yet."
                    actionText={onCreateTicket ? 'Create first stock ticket' : undefined}
                    onAction={onCreateTicket}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
