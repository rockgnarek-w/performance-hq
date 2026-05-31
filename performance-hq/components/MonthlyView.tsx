'use client';

import { useMemo, useState } from 'react';
import { Entry, DailyResult } from '@/lib/supabase';

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

export default function MonthlyView({
  entries,
  dailyResults,
}: {
  entries: Entry[];
  dailyResults: DailyResult[];
}) {
  const months = useMemo(() => {
    const set = new Set<string>([
      ...entries.map((e) => getMonthKey(e.date)),
      ...dailyResults.map((r) => getMonthKey(r.date)),
    ]);
    return Array.from(set).sort().reverse();
  }, [entries, dailyResults]);

  const [selectedMonth, setSelectedMonth] = useState<string>(months[0] || '');

  // Spend from entries (auto-imported from FB), Revenue from daily_results (manual)
  const monthSpendByOffer = useMemo(() => {
    const map = new Map<number, number>();
    entries
      .filter((e) => getMonthKey(e.date) === selectedMonth && e.offer_id !== null)
      .forEach((e) => {
        const cur = map.get(e.offer_id!) || 0;
        map.set(e.offer_id!, cur + e.spend);
      });
    return map;
  }, [entries, selectedMonth]);

  const monthResultsByOffer = useMemo(() => {
    const map = new Map<number, { deposits: number; revenue: number; name: string }>();
    dailyResults
      .filter((r) => getMonthKey(r.date) === selectedMonth)
      .forEach((r) => {
        const cur = map.get(r.offer_id) || { deposits: 0, revenue: 0, name: r.offers?.offer_name || '???' };
        cur.deposits += r.deposits;
        cur.revenue += r.deposits * r.payout_per_dep;
        cur.name = r.offers?.offer_name || cur.name;
        map.set(r.offer_id, cur);
      });
    return map;
  }, [dailyResults, selectedMonth]);

  // Combine: every offer that has spend OR results
  const byOffer = useMemo(() => {
    const ids = new Set<number>([
      ...Array.from(monthSpendByOffer.keys()),
      ...Array.from(monthResultsByOffer.keys()),
    ]);
    const rows: Array<{
      name: string;
      spend: number;
      deposits: number;
      revenue: number;
      profit: number;
      roi: number;
    }> = [];

    // Try to find name from entries first, then daily_results
    const nameMap = new Map<number, string>();
    entries.forEach((e) => {
      if (e.offer_id && e.offers?.offer_name) nameMap.set(e.offer_id, e.offers.offer_name);
    });
    dailyResults.forEach((r) => {
      if (r.offers?.offer_name && !nameMap.has(r.offer_id)) nameMap.set(r.offer_id, r.offers.offer_name);
    });

    Array.from(ids).forEach((id) => {
      const spend = monthSpendByOffer.get(id) || 0;
      const results = monthResultsByOffer.get(id) || { deposits: 0, revenue: 0, name: '???' };
      const profit = results.revenue - spend;
      const roi = spend > 0 ? (profit / spend) * 100 : 0;
      rows.push({
        name: nameMap.get(id) || results.name,
        spend,
        deposits: results.deposits,
        revenue: results.revenue,
        profit,
        roi,
      });
    });

    return rows.sort((a, b) => b.spend - a.spend);
  }, [monthSpendByOffer, monthResultsByOffer, entries, dailyResults]);

  const stats = useMemo(() => {
    const spend = byOffer.reduce((a, r) => a + r.spend, 0);
    const deposits = byOffer.reduce((a, r) => a + r.deposits, 0);
    const revenue = byOffer.reduce((a, r) => a + r.revenue, 0);
    const profit = revenue - spend;
    const roi = spend > 0 ? (profit / spend) * 100 : 0;
    return { spend, deposits, revenue, profit, roi };
  }, [byOffer]);

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
                  {o.spend > 0 ? `${o.roi.toFixed(0)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
