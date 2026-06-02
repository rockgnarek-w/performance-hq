'use client';

import { useMemo, useState } from 'react';
import { Entry, Offer, DailyResult } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function monthKey(d: string) {
  return d.substring(0, 7); // YYYY-MM
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export default function MonthlyView({
  entries,
  offers,
  dailyResults,
}: {
  entries: Entry[];
  offers: Offer[];
  dailyResults: DailyResult[];
}) {
  // Все месяцы где есть данные
  const months = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(monthKey(e.date)));
    dailyResults.forEach((r) => set.add(monthKey(r.date)));
    return Array.from(set).sort().reverse();
  }, [entries, dailyResults]);

  const currentMonth = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    months[0] || currentMonth
  );

  // Aggregate per offer for selected month
  const offerRows = useMemo(() => {
    const monthEntries = entries.filter((e) => monthKey(e.date) === selectedMonth);
    const monthResults = dailyResults.filter((r) => monthKey(r.date) === selectedMonth);

    const agg = new Map<number, {
      offer: Offer;
      spend: number;
      clicks: number;
      fbPurchases: number;
      fbRevenue: number;
      deposits: number;
      revenue: number;
    }>();

    monthEntries.forEach((e) => {
      if (e.offer_id === null) return;
      const offer = offers.find((o) => o.id === e.offer_id);
      if (!offer) return;
      const cur = agg.get(e.offer_id) || {
        offer, spend: 0, clicks: 0, fbPurchases: 0, fbRevenue: 0, deposits: 0, revenue: 0,
      };
      cur.spend += e.spend || 0;
      cur.clicks += e.clicks || 0;
      cur.fbPurchases += e.purchases || 0;
      cur.fbRevenue += e.purchase_value || 0;
      agg.set(e.offer_id, cur);
    });

    monthResults.forEach((r) => {
      const offer = offers.find((o) => o.id === r.offer_id);
      if (!offer) return;
      const cur = agg.get(r.offer_id) || {
        offer, spend: 0, clicks: 0, fbPurchases: 0, fbRevenue: 0, deposits: 0, revenue: 0,
      };
      cur.deposits += r.deposits || 0;
      cur.revenue += (r.deposits || 0) * (r.payout_per_dep || 0);
      agg.set(r.offer_id, cur);
    });

    return Array.from(agg.values()).sort((a, b) => b.spend - a.spend);
  }, [entries, offers, dailyResults, selectedMonth]);

  // Сводка
  const totals = offerRows.reduce(
    (acc, r) => {
      acc.spend += r.spend;
      acc.clicks += r.clicks;
      acc.fbPurchases += r.fbPurchases;
      acc.fbRevenue += r.fbRevenue;
      acc.deposits += r.deposits;
      acc.revenue += r.revenue;
      return acc;
    },
    { spend: 0, clicks: 0, fbPurchases: 0, fbRevenue: 0, deposits: 0, revenue: 0 }
  );

  const totalProfit = totals.revenue - totals.spend;
  const totalROI = totals.spend > 0 ? (totalProfit / totals.spend) * 100 : 0;
  const totalROAS = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  return (
    <>
      <div className="card">
        <div className="card-title">Month</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {months.map((m) => (
            <button
              key={m}
              className="nav-btn"
              onClick={() => setSelectedMonth(m)}
              style={{
                background: selectedMonth === m ? 'rgba(212,160,23,0.15)' : undefined,
                borderColor: selectedMonth === m ? '#d4a017' : undefined,
                color: selectedMonth === m ? '#d4a017' : undefined,
              }}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {offerRows.length === 0 ? (
        <div className="card">
          <p className="muted">No data for {monthLabel(selectedMonth)}.</p>
        </div>
      ) : (
        <>
          {/* Сводка по месяцу */}
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-label">Spend</div>
              <div className="stat-value">{formatMoney(totals.spend)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Real Revenue</div>
              <div className="stat-value">{formatMoney(totals.revenue)}</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{totals.deposits} deps</div>
            </div>
            <div className="stat">
              <div className="stat-label">Profit / ROI</div>
              <div className={`stat-value ${totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                {totalProfit >= 0 ? '+' : ''}{formatMoney(totalProfit)}
              </div>
              <div className={`muted ${totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}`} style={{ fontSize: 11, marginTop: 2 }}>
                {totals.spend > 0 ? `${totalROI.toFixed(0)}%` : '—'}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">FB Pixel</div>
              <div className="stat-value">{totals.fbPurchases}</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                {formatMoney(totals.fbRevenue)} · ROAS {totalROAS > 0 ? totalROAS.toFixed(2) : '—'}
              </div>
            </div>
          </div>

          {/* By Offer */}
          <div className="card">
            <div className="card-title">By Offer — {monthLabel(selectedMonth)}</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="entries-table">
                <thead>
                  <tr>
                    <th>Offer</th>
                    <th>Spend</th>
                    <th>Clicks</th>
                    <th title="FB Pixel purchases (~85%)">FB Pur</th>
                    <th title="FB Pixel revenue">FB Rev</th>
                    <th>Real Deps</th>
                    <th>Revenue</th>
                    <th>Profit</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {offerRows.map((r) => {
                    const profit = r.revenue - r.spend;
                    const roi = r.spend > 0 ? (profit / r.spend) * 100 : 0;
                    const flag = FLAGS[r.offer.geo_code] || '🏳️';

                    return (
                      <tr key={r.offer.id}>
                        <td>
                          {flag} <strong>{r.offer.country_name}</strong>
                          <span className="muted"> — {r.offer.offer_name}</span>
                        </td>
                        <td>{formatMoney(r.spend)}</td>
                        <td>{r.clicks}</td>
                        <td style={{ color: r.fbPurchases > 0 ? '#4ade80' : 'inherit' }}>
                          {r.fbPurchases || '—'}
                        </td>
                        <td style={{ color: r.fbRevenue > 0 ? '#4ade80' : 'inherit' }}>
                          {r.fbRevenue > 0 ? formatMoney(r.fbRevenue) : '—'}
                        </td>
                        <td>{r.deposits}</td>
                        <td>{formatMoney(r.revenue)}</td>
                        <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                          {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                        </td>
                        <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                          {r.spend > 0 ? `${roi.toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
              💡 <strong>FB Pur/Rev</strong> — данные пикселя за каждый день месяца. <strong>Real Deps</strong> — то что ты ввёл вручную из партнёрки.
            </p>
          </div>
        </>
      )}
    </>
  );
}
