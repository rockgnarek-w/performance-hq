'use client';

import { supabase, Entry } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatDate(d: string) {
  const [, m, day] = d.split('-');
  return `${m}-${day}`;
}

export default function EntriesList({
  entries,
  onChanged,
}: {
  entries: Entry[];
  onChanged: () => void;
}) {
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    await supabase.from('entries').delete().eq('id', id);
    onChanged();
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ margin: 0 }}>Entries ({entries.length})</div>
      </div>

      {entries.length === 0 ? (
        <p className="muted">No entries yet. Add your first above.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="entries-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Geo</th>
                <th>Offer</th>
                <th>Spend</th>
                <th>Deps</th>
                <th>Payout</th>
                <th>Revenue</th>
                <th>CPA</th>
                <th>Profit</th>
                <th>ROI</th>
                <th>Src</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const revenue = e.deposits * e.payout_per_dep;
                const profit = revenue - e.spend;
                const roi = e.spend > 0 ? (profit / e.spend) * 100 : 0;
                const cpa = e.deposits > 0 ? e.spend / e.deposits : null;
                const flag = e.geo_code ? FLAGS[e.geo_code] || '🏳️' : '';

                return (
                  <tr key={e.id}>
                    <td>{formatDate(e.date)}</td>
                    <td>{flag} {e.geo_code}</td>
                    <td>{e.offers?.offer_name || '—'}</td>
                    <td>{formatMoney(e.spend)}</td>
                    <td>{e.deposits}</td>
                    <td>{formatMoney(revenue)}</td>
                    <td>{formatMoney(revenue)}</td>
                    <td>{cpa ? formatMoney(cpa) : <span className="muted">—</span>}</td>
                    <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                      {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                    </td>
                    <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                      {roi.toFixed(0)}%
                    </td>
                    <td className="muted" style={{ fontSize: 11 }}>{e.source}</td>
                    <td>
                      <button onClick={() => handleDelete(e.id)} title="Delete" style={{ opacity: 0.4 }}>
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
