'use client';

import React from 'react';
import { EmptyState } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { MovementTx } from './types';

export interface TransactionsTabProps {
  transactions: MovementTx[];
  onCreateTicket?: () => void;
}

export default function TransactionsTab({
  transactions,
  onCreateTicket,
}: TransactionsTabProps) {
  const { t, formatNumber, formatDate } = useI18n();

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{t.transactionsTab.title}</h2>
          <p>{t.transactionsTab.desc}</p>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.common.timestamp}</th>
              <th>{t.common.ticketId}</th>
              <th>{t.common.type}</th>
              <th>{t.common.sku}</th>
              <th>{t.common.quantity}</th>
              <th>{t.common.performedBy}</th>
              <th>{t.common.note}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tItem) => (
              <tr key={tItem.id}>
                <td>{formatDate(tItem.date)}</td>
                <td className="mono">{tItem.id.slice(0, 8)}</td>
                <td>
                  <span className={`tag ${tItem.type === 'IN' ? 'success' : 'warning'}`}>
                    {tItem.type === 'IN' ? t.common.inbound : t.common.outbound}
                  </span>
                </td>
                <td className="mono">{tItem.sku}</td>
                <td>{formatNumber(tItem.quantity)}</td>
                <td>{tItem.actor}</td>
                <td>{tItem.note || '—'}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    message={t.transactionsTab.empty}
                    actionText={onCreateTicket ? t.transactionsTab.createFirst : undefined}
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
