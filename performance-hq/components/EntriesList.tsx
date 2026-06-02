'use client';

import { useState, useMemo } from 'react';
import { supabase, Entry, Offer } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',')}`;
}

type CampaignRow = {
  date: string;
  campaign_name: string | null;
  account_id_fb: string | null;
  geo_code: string | null;
  offer_name: string;
  crm_id: string;
  source: string;
  spend: number;
  adCount: number;
  ids: number[];
};

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

  // Группировка по (date + campaign_name + account_id_fb)
  const grouped: CampaignRow[] = useMemo(() => {
    const map = new Map<string, CampaignRow>();

    entries.forEach((e) => {
      // Фильтры применяем перед группировкой
      if (filterDate && e.date !== filterDate) return;
      if (filterSource !== 'all' && e.source !== filterSource) return;
      if (search) {
        const q = search.toLowerCase();
        const inFields = [e.campaign_name, e.note, e.account_id_fb, e.geo_code]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
        if (!inFields) return;
      }

      const key = `${e.date}|${e.campaign_name || '—'}|${e.account_id_fb || '—'}`;
      const cur = map.get(key);
      if (cur) {
        cur.spend += e.spend || 0;
        cur.adCount += 1;
        cur.ids.push(e.id);
      } else {
        map.set(key, {
          date: e.date,
          campaign_name: e.campaign_name,
          account_id_fb: e.account_id_fb,
          geo_code: e.geo_code,
          offer_name: e.offers?.offer_name || (e.offer_id === null ? '—' : '?'),
          crm_id: e.offers?.crm_id || '',
          source: e.source,
          spend: e.spend || 0,
          adCount: 1,
          ids: [e.id],
        });
      }
    });

    // Сортируем — последние даты сверху, внутри даты по спенду
    return Array.from(map.values()).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.spend - a.spend;
    });
  }, [entries, filterDate, filterSource, search]);

  const handleDeleteCampaign = async (row: CampaignRow) => {
    if (!confirm(`Delete ${row.adCount} entr${row.adCount === 1 ? 'y' : 'ies'} for "${row.campaign_name || '—'}" on ${row.date}?`)) return;
    await supabase.from('entries').delete().in('id', row.ids);
    onChanged();
  };

  const uniqueDates = useMemo(() => {
    const set = new Set(entries.map((e) => e.date));
    return Array.from(set).sort().reverse();
  }, [entries]);

  // Сводка
  const totals = grouped.reduce(
    (acc, r) => {
      acc.spend += r.spend;
      acc.ads += r.adCount;
      return acc;
    },
    { spend: 0, ads: 0 }
  );

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div className="card-title" style={{ margin: 0 }}>
          Entries — {grouped.length} campaign{grouped.length === 1 ? '' : 's'}
          <span className="muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 10 }}>
            · {totals.ads} ad{totals.ads === 1 ? '' : 's'} · {formatMoney(totals.spend)}
          </span>
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

      {grouped.length === 0 ? (
        <p className="muted">No entries match the filters.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="entries-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Geo / Offer</th>
                <th>Campaign</th>
                <th>Ads</th>
                <th>Cost</th>
                <th>Src</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grouped.slice(0, 500).map((r, idx) => {
                const flag = r.geo_code ? FLAGS[r.geo_code] || '🏳️' : '';
                const idDisplay = r.ids.length === 1 
                  ? `#${r.ids[0]}` 
                  : `#${Math.min(...r.ids)}–${Math.max(...r.ids)}`;
                return (
                  <tr key={`${r.date}-${r.campaign_name}-${idx}`}>
                    <td className="muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, whiteSpace: 'nowrap' }} title={r.ids.join(', ')}>
                      {idDisplay}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td>
                      {flag} <strong>{r.geo_code || '—'}</strong>
                      <span className="muted"> · {r.offer_name}</span>
                      {r.crm_id && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 3,
                          background: 'rgba(212,160,23,0.1)',
                          color: '#d4a017',
                          fontFamily: 'ui-monospace, monospace',
                        }}>
                          {r.crm_id}
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {r.campaign_name || <span className="muted">—</span>}
                    </td>
                    <td className="muted">{r.adCount}</td>
                    <td><strong>{formatMoney(r.spend)}</strong></td>
                    <td>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: r.source === 'auto' ? 'rgba(212,160,23,0.15)' : 'rgba(255,255,255,0.06)',
                        color: r.source === 'auto' ? '#d4a017' : '#888',
                      }}>
                        {r.source}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteCampaign(r)}
                        title={`Delete ${r.adCount} entr${r.adCount === 1 ? 'y' : 'ies'}`}
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
          {grouped.length > 500 && (
            <p className="muted" style={{ fontSize: 11, marginTop: 12, textAlign: 'center' }}>
              Showing first 500 of {grouped.length}. Use filters to narrow down.
            </p>
          )}
        </div>
      )}

      <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
        💡 Сгруппировано по кампаниям. Колонка <strong>Ads</strong> — сколько объявлений было в кампании за этот день. <strong>Cost</strong> — суммарный спенд по всем объявлениям кампании. Удаление сносит все записи кампании за день.
      </p>
    </div>
  );
}
