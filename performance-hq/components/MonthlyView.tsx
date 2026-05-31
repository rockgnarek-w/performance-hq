'use client';

import { useMemo, useState } from 'react';
import { Entry } from '@/lib/supabase';

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function getMonthKey(date: string) {
  return date.slice(0, 7); // 'YYYY-MM'
}

export default function MonthlyView({ entries }: { entries: Entry[] }) {
  const months = useMemo(() => {
    const set = new Set(entries.map((e) => getMonthKey(e.date)));
    return Array.from(set).sort().reverse();
  }, [entries]);

  const [selectedMonth, setSelectedMonth] = useState<string>(months[0] || '');

  const monthEntries = useMemo(
    () => entries.filter((e) => getMonthKey(e.date) === selectedMonth),
    [entries, selectedMonth]
  );

  const stats = useMemo(() => {
    const spend = monthEntries.reduce((a, e) => a + e.spend, 0);
    const deposits = monthEntries.reduce((a, e) => a + e.deposits, 0);
    const revenue = monthEntries.reduce((a, e) => a + e.deposits * e.payout_per_dep, 0);
    const profit = revenue - spend;
    const roi = spend > 0 ? (profit / spend) * 100 : 0;
    return { spend, deposits, revenue, profit, roi };
  }, [monthEntries]);

  // group by offer
  const byOffer = useMemo(() => {
    const map = new Map<string, { spend: number; deposits: number; revenue: number }>();
    monthEntries.forEach((e) => {
      const key = e.offers?.offer_name || '???';
      const cur = map.get(key) || { spend: 0, deposits: 0, revenue: 0 };
      cur.spend += e.spend;
      cur.deposits += e.deposits;
      cur.revenue += e.deposits * e.payout_per_dep;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, profit: v.revenue - v.spend, roi: v.spend > 0 ? ((v.revenue - v.spend) / v.spend) * 100 : 0 }))
      .sort((a, b) => b.spend - a.spend);
  }, [monthEntries]);

  if (months.length === 0) {
    return <div className="card"><p className="muted">No data yet.</p></div>;
  }

  const formatMonthLabel = (m: string) => {
    const [year, mm] = m.split('-');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${monthNames[parseInt(mm) - 1]} ${year.slice(2)}`;
  };

  return (
    <>
      <div className="card">
        <div className="card-title">Month</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {months.map((m) => (
            <button
              key={m}
              className={`nav-btn ${m === selectedMonth ? 'active' : ''}`}
              onClick={() => setSelectedMonth(m)}
            >
              {formatMonthLabel(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Spend</div>
          <div className="stat-value">{formatMoney(stats.spend)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Deposits</div>
          <div className="stat-value">{stats.deposits}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Profit</div>
          <div className={`stat-value ${stats.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
            {stats.profit >= 0 ? '+' : ''}{formatMoney(stats.profit)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">ROI</div>
          <div className={`stat-value ${stats.roi >= 0 ? 'profit-positive' : 'profit-negative'}`}>
            {stats.roi.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">By Offer</div>
        <table className="entries-table">
          <thead>
            <tr>
              <th>Offer</th>
              <th>Spend</th>
              <th>Deps</th>
              <th>Revenue</th>
              <th>Profit</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            {byOffer.map((o) => (
              <tr key={o.name}>
                <td>{o.name}</td>
                <td>{formatMoney(o.spend)}</td>
                <td>{o.deposits}</td>
                <td>{formatMoney(o.revenue)}</td>
                <td className={o.profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                  {o.profit >= 0 ? '+' : ''}{formatMoney(o.profit)}
                </td>
                <td className={o.profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                  {o.roi.toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
