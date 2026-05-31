'use client';

import { useMemo, useState } from 'react';
import { Entry, DailyResult } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

export default function ByGeoView({
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

  const byGeo = useMemo(() => {
    const map = new Map<
      string,
      { country: string; spend: number; deposits: number; revenue: number }
    >();

    entries
      .filter((e) => getMonthKey(e.date) === selectedMonth && e.geo_code)
      .forEach((e) => {
        const key = e.geo_code!;
        const country = e.offers?.country_name || key;
        const cur = map.get(key) || { country, spend: 0, deposits: 0, revenue: 0 };
        cur.spend += e.spend;
        map.set(key, cur);
      });

    dailyResults
      .filter((r) => getMonthKey(r.date) === selectedMonth)
      .forEach((r) => {
        const key = r.offers?.geo_code || 'XX';
        const country = r.offers?.country_name || key;
        const cur = map.get(key) || { country, spend: 0, deposits: 0, revenue: 0 };
        cur.deposits += r.deposits;
        cur.revenue += r.deposits * r.payout_per_dep;
        map.set(key, cur);
      });

    return Array.from(map.entries())
      .map(([code, v]) => ({
        code,
        ...v,
        profit: v.revenue - v.spend,
        roi: v.spend > 0 ? ((v.revenue - v.spend) / v.spend) * 100 : 0,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [entries, dailyResults, selectedMonth]);

  const formatMonthLabel = (m: string) => {
    const [year, mm] = m.split('-');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${monthNames[parseInt(mm) - 1]} ${year.slice(2)}`;
  };

  if (months.length === 0) {
    return <div className="card"><p className="muted">No data yet.</p></div>;
  }

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

      {byGeo.map((g) => (
        <div
          key={g.code}
          className="card"
          style={{ borderLeft: `3px solid ${g.profit >= 0 ? '#4ade80' : '#ef4444'}` }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {FLAGS[g.code] || '🏳️'} {g.country}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {g.code}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={`stat-value ${g.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                {g.profit >= 0 ? '+' : ''}{formatMoney(g.profit)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                ROI: {g.spend > 0 ? `${g.roi.toFixed(0)}%` : '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
            <div>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Spend</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{formatMoney(g.spend)}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Deposits</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{g.deposits}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Revenue</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{formatMoney(g.revenue)}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>CPA</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>
                {g.deposits > 0 ? formatMoney(g.spend / g.deposits) : <span className="muted">—</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
