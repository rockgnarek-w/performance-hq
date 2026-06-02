'use client';

import { useEffect, useState } from 'react';
import { supabase, Entry, Offer, DailyResult } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatMoneyComma(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',')}`;
}

type OfferRow = {
  offer: Offer;
  spend: number;
  clicks: number;
  fbPurchases: number;
  fbRevenue: number;
  deposits: number;
  payoutPerDep: number;
  resultId: number | null;
  dirty: boolean;
  saving: boolean;
};

export default function DailyView({ entries, offers }: { entries: Entry[]; offers: Offer[] }) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const [date, setDate] = useState<string>(yesterday);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const loadDay = async (d: string) => {
    setLoading(true);

    // Aggregate spend/clicks/purchases/revenue per offer for selected date
    const dayEntries = entries.filter((e) => e.date === d && e.offer_id !== null);
    const aggByOffer = new Map<number, { spend: number; clicks: number; purchases: number; revenue: number }>();
    dayEntries.forEach((e) => {
      const cur = aggByOffer.get(e.offer_id!) || { spend: 0, clicks: 0, purchases: 0, revenue: 0 };
      cur.spend += e.spend || 0;
      cur.clicks += e.clicks || 0;
      cur.purchases += e.purchases || 0;
      cur.revenue += e.purchase_value || 0;
      aggByOffer.set(e.offer_id!, cur);
    });

    // Existing daily_results for date
    const { data: results } = await supabase
      .from('daily_results')
      .select('*')
      .eq('date', d);

    const resultMap = new Map<number, DailyResult>();
    (results || []).forEach((r) => resultMap.set(r.offer_id, r));

    const offerIds = new Set<number>([
      ...aggByOffer.keys(),
      ...Array.from(resultMap.keys()),
    ]);

    const { data: lastPayouts } = await supabase
      .from('daily_results')
      .select('offer_id, payout_per_dep')
      .order('date', { ascending: false })
      .limit(500);

    const lastPayoutMap = new Map<number, number>();
    (lastPayouts || []).forEach((r) => {
      if (!lastPayoutMap.has(r.offer_id)) {
        lastPayoutMap.set(r.offer_id, r.payout_per_dep);
      }
    });

    const newRows: OfferRow[] = [];
    for (const offerId of Array.from(offerIds)) {
      const offer = offers.find((o) => o.id === offerId);
      if (!offer) continue;
      const existing = resultMap.get(offerId);
      const agg = aggByOffer.get(offerId) || { spend: 0, clicks: 0, purchases: 0, revenue: 0 };
      newRows.push({
        offer,
        spend: agg.spend,
        clicks: agg.clicks,
        fbPurchases: agg.purchases,
        fbRevenue: agg.revenue,
        deposits: existing?.deposits ?? 0,
        payoutPerDep: existing?.payout_per_dep ?? lastPayoutMap.get(offerId) ?? 300,
        resultId: existing?.id ?? null,
        dirty: false,
        saving: false,
      });
    }

    newRows.sort((a, b) => b.spend - a.spend);

    setRows(newRows);
    setLoading(false);
  };

  useEffect(() => {
    loadDay(date);
  }, [date, entries]);

  const updateRow = (idx: number, patch: Partial<OfferRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, dirty: true };
      return next;
    });
  };

  const saveRow = async (idx: number) => {
    const row = rows[idx];
    updateRow(idx, { saving: true });

    const payload = {
      date,
      offer_id: row.offer.id,
      deposits: row.deposits,
      payout_per_dep: row.payoutPerDep,
    };

    if (row.resultId) {
      await supabase.from('daily_results').update(payload).eq('id', row.resultId);
    } else {
      const { data } = await supabase
        .from('daily_results')
        .upsert(payload, { onConflict: 'date,offer_id' })
        .select()
        .single();
      if (data) {
        setRows((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], resultId: data.id };
          return next;
        });
      }
    }

    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], dirty: false, saving: false };
      return next;
    });

    setSavedMessage(`Saved: ${row.offer.country_name} — ${row.offer.offer_name}`);
    setTimeout(() => setSavedMessage(null), 1500);
  };

  const saveAll = async () => {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].dirty) await saveRow(i);
    }
  };

  const dirtyCount = rows.filter((r) => r.dirty).length;

  // Сводка по дню
  const totals = rows.reduce(
    (acc, r) => {
      const revenue = r.deposits * r.payoutPerDep;
      acc.spend += r.spend;
      acc.clicks += r.clicks;
      acc.fbPurchases += r.fbPurchases;
      acc.fbRevenue += r.fbRevenue;
      acc.deposits += r.deposits;
      acc.revenue += revenue;
      return acc;
    },
    { spend: 0, clicks: 0, fbPurchases: 0, fbRevenue: 0, deposits: 0, revenue: 0 }
  );
  const totalProfit = totals.revenue - totals.spend;
  const totalROI = totals.spend > 0 ? (totalProfit / totals.spend) * 100 : 0;

  return (
    <>
      <div className="card">
        <div className="card-title">Date</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 'auto', minWidth: 200 }}
          />
          <button className="nav-btn" onClick={() => setDate(yesterday)}>Yesterday</button>
          <button className="nav-btn" onClick={() => setDate(today)}>Today</button>
        </div>
      </div>

      {/* Сводные карточки по дню */}
      {rows.length > 0 && (
        <div className="stats-grid">
          <div className="stat">
            <div className="stat-label">Spend</div>
            <div className="stat-value">{formatMoney(totals.spend)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">FB Revenue</div>
            <div className="stat-value">{formatMoney(totals.fbRevenue)}</div>
            <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>pixel · ~85%</div>
          </div>
          <div className="stat">
            <div className="stat-label">Real Revenue</div>
            <div className="stat-value">{formatMoney(totals.revenue)}</div>
            <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>from partner</div>
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
        </div>
      )}

      {savedMessage && <div className="alert alert-success">{savedMessage}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>
            By Offer — {date}
          </div>
          {dirtyCount > 0 && (
            <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={saveAll}>
              Save All ({dirtyCount})
            </button>
          )}
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="muted">No data for {date}. Either no spend was imported, or no offers worked this day.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="entries-table">
              <thead>
                <tr>
                  <th>Offer</th>
                  <th>Spend</th>
                  <th>Clicks</th>
                  <th title="Purchases from FB pixel (~85% accuracy)">FB Pur</th>
                  <th title="FB pixel revenue">FB Rev</th>
                  <th style={{ width: 100 }}>Deps (real)</th>
                  <th style={{ width: 120 }}>Payout / Dep</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                  <th>ROI</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const revenue = r.deposits * r.payoutPerDep;
                  const profit = revenue - r.spend;
                  const roi = r.spend > 0 ? (profit / r.spend) * 100 : 0;
                  const flag = FLAGS[r.offer.geo_code] || '🏳️';

                  return (
                    <tr key={r.offer.id}>
                      <td>
                        {flag} <strong>{r.offer.country_name}</strong>
                        <span className="muted"> — {r.offer.offer_name}</span>
                      </td>
                      <td>{formatMoneyComma(r.spend)}</td>
                      <td>{r.clicks}</td>
                      <td style={{ color: r.fbPurchases > 0 ? '#4ade80' : 'inherit' }}>
                        {r.fbPurchases || '—'}
                      </td>
                      <td style={{ color: r.fbRevenue > 0 ? '#4ade80' : 'inherit' }}>
                        {r.fbRevenue > 0 ? formatMoney(r.fbRevenue) : '—'}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={r.deposits}
                          onChange={(e) => updateRow(idx, { deposits: parseInt(e.target.value) || 0 })}
                          style={{ padding: '6px 8px', width: 80 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={r.payoutPerDep}
                          onChange={(e) =>
                            updateRow(idx, { payoutPerDep: parseFloat(e.target.value) || 0 })
                          }
                          style={{ padding: '6px 8px', width: 100 }}
                        />
                      </td>
                      <td>{formatMoney(revenue)}</td>
                      <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                        {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                      </td>
                      <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                        {r.spend > 0 ? `${roi.toFixed(0)}%` : '—'}
                      </td>
                      <td>
                        {r.dirty && (
                          <button
                            className="nav-btn"
                            style={{ borderColor: '#d4a017', color: '#d4a017' }}
                            onClick={() => saveRow(idx)}
                            disabled={r.saving}
                          >
                            {r.saving ? '...' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
          💡 <strong>FB Pur / FB Rev</strong> — данные из Facebook Pixel (показывают сразу, точность ~85%). <strong>Deps (real)</strong> — реальные депы от партнёрки (ты вводишь, 100% точность).
        </p>
      </div>
    </>
  );
}
