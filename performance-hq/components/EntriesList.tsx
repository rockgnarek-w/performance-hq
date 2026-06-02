'use client';

import { useState, useMemo } from 'react';
import { supabase, Entry, Offer } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function EntriesList({
  entries,
  offers,
  onChanged,
}: {
  entries: Entry[];
  offers: Offer[];
  onChanged: () => void;
}) {
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterDate && e.date !== filterDate) return false;
      if (filterSource !== 'all' && e.source !== filterSource) return false;
      if (search) {
        const q = search.toLowerCase();
        const inFields = [e.campaign_name, e.ad_name, e.creative_id, e.note, e.account_id_fb]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
        if (!inFields) return false;
      }
      return true;
    });
  }, [entries, filterDate, filterSource, search]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    await supabase.from('entries').delete().eq('id', id);
    onChanged();
  };

  const uniqueDates = useMemo(() => {
    const set = new Set(entries.map((e) => e.date));
    return Array.from(set).sort().reverse();
  }, [entries]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div className="card-title" style={{ margin: 0 }}>
          Entries ({filtered.length}{filtered.length !== entries.length ? ` / ${entries.length}` : ''})
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 'auto', padding: '6px 10px' }}
          />
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }}>
            <option value="">All dates</option>
            {uniqueDates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }}>
            <option value="all">All sources</option>
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">No entries match the filters.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="entries-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Geo / Offer</th>
                <th>Ad Name</th>
                <th>Spend</th>
                <th>Clicks</th>
                <th title="FB Pixel purchases">FB Pur</th>
                <th title="FB Pixel revenue">FB Rev</th>
                <th>Src</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((e) => {
                const flag = e.geo_code ? FLAGS[e.geo_code] || '🏳️' : '';
                const offerName = e.offers?.offer_name || (e.offer_id === null ? '—' : '?');
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td>
                      {flag} <strong>{e.geo_code || '—'}</strong>
                      <span className="muted"> · {offerName}</span>
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {e.ad_name || <span className="muted">—</span>}
                    </td>
                    <td>{formatMoney(e.spend)}</td>
                    <td>{e.clicks || '—'}</td>
                    <td style={{ color: e.purchases > 0 ? '#4ade80' : undefined }}>
                      {e.purchases || '—'}
                    </td>
                    <td style={{ color: e.purchase_value > 0 ? '#4ade80' : undefined }}>
                      {e.purchase_value > 0 ? formatMoney(e.purchase_value) : '—'}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: e.source === 'auto' ? 'rgba(212,160,23,0.15)' : 'rgba(255,255,255,0.06)',
                        color: e.source === 'auto' ? '#d4a017' : '#888',
                      }}>
                        {e.source}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(e.id)}
                        title="Delete"
                        style={{ padding: '4px 8px', opacity: 0.5, fontSize: 12 }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 500 && (
            <p className="muted" style={{ fontSize: 11, marginTop: 12, textAlign: 'center' }}>
              Showing first 500 of {filtered.length}. Use filters to narrow down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
