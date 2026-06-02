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
  return d.substring(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

type GeoBucket = {
  geo: string;
  spend: number;
  clicks: number;
  fbPurchases: number;
  fbRevenue: number;
  deposits: number;
  revenue: number;
  offers: Set<number>;
};

export default function ByGeoView({
  entries,
  offers,
  dailyResults,
}: {
  entries: Entry[];
  offers: Offer[];
  dailyResults: DailyResult[];
}) {
  const months = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(monthKey(e.date)));
    dailyResults.forEach((r) => set.add(monthKey(r.date)));
    set.add('all');
    return Array.from(set).sort().reverse();
  }, [entries, dailyResults]);

  const [period, setPeriod] = useState<string>(months[1] || 'all');

  const inPeriod = (d: string) => period === 'all' || monthKey(d) === period;

  const buckets = useMemo(() => {
    const map = new Map<string, GeoBucket>();

    const getBucket = (geo: string) => {
      let b = map.get(geo);
      if (!b) {
        b = { geo, spend: 0, clicks: 0, fbPurchases: 0, fbRevenue: 0, deposits: 0, revenue: 0, offers: new Set() };
        map.set(geo, b);
      }
      return b;
    };

    entries.forEach((e) => {
      if (!inPeriod(e.date)) return;
      const geo = e.geo_code || 'Unknown';
      const b = getBucket(geo);
      b.spend += e.spend || 0;
      b.clicks += e.clicks || 0;
      b.fbPurchases += e.purchases || 0;
      b.fbRevenue += e.purchase_value || 0;
      if (e.offer_id !== null) b.offers.add(e.offer_id);
    });

    dailyResults.forEach((r) => {
      if (!inPeriod(r.date)) return;
      const offer = offers.find((o) => o.id === r.offer_id);
      if (!offer) return;
      const b = getBucket(offer.geo_code);
      b.deposits += r.deposits || 0;
      b.revenue += (r.deposits || 0) * (r.payout_per_dep || 0);
      b.offers.add(r.offer_id);
    });

    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [entries, offers, dailyResults, period]);

  const totals = buckets.reduce(
    (acc, b) => {
      acc.spend += b.spend;
      acc.revenue += b.revenue;
      return acc;
    },
    { spend: 0, revenue: 0 }
  );

  return (
    <>
      <div className="card">
        <div className="card-title">Period</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="nav-btn"
            onClick={() => setPeriod('all')}
            style={{
              background: period === 'all' ? 'rgba(212,160,23,0.15)' : undefined,
              borderColor: period === 'all' ? '#d4a017' : undefined,
              color: period === 'all' ? '#d4a017' : undefined,
            }}
          >
            All Time
          </button>
          {months.filter((m) => m !== 'all').map((m) => (
            <button
              key={m}
              className="nav-btn"
              onClick={() => setPeriod(m)}
              style={{
                background: period === m ? 'rgba(212,160,23,0.15)' : undefined,
                borderColor: period === m ? '#d4a017' : undefined,
                color: period === m ? '#d4a017' : undefined,
              }}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {buckets.length === 0 ? (
        <div className="card">
          <p className="muted">No data for {period === 'all' ? 'all time' : monthLabel(period)}.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {buckets.map((b) => {
            const profit = b.revenue - b.spend;
            const roi = b.spend > 0 ? (profit / b.spend) * 100 : 0;
            const roas = b.spend > 0 ? b.revenue / b.spend : 0;
            const flag = FLAGS[b.geo] || '🏳️';

            return (
              <div key={b.geo} className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {flag} {b.geo}
                  </div>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {b.offers.size} offer{b.offers.size === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 10 }}>Spend</div>
                    <div style={{ fontWeight: 600 }}>{formatMoney(b.spend)}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 10 }}>Revenue</div>
                    <div style={{ fontWeight: 600 }}>{formatMoney(b.revenue)}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 10 }}>Real Deps</div>
                    <div style={{ fontWeight: 600 }}>{b.deposits}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 10 }}>FB Pixel</div>
                    <div style={{ fontWeight: 600, color: b.fbPurchases > 0 ? '#4ade80' : undefined }}>
                      {b.fbPurchases || '—'} · {formatMoney(b.fbRevenue)}
                    </div>
                  </div>
                </div>

                <div style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div className="muted" style={{ fontSize: 10 }}>Profit</div>
                    <div className={profit >= 0 ? 'profit-positive' : 'profit-negative'} style={{ fontWeight: 700, fontSize: 16 }}>
                      {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="muted" style={{ fontSize: 10 }}>ROI</div>
                    <div className={profit >= 0 ? 'profit-positive' : 'profit-negative'} style={{ fontWeight: 700, fontSize: 16 }}>
                      {b.spend > 0 ? `${roi.toFixed(0)}%` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
