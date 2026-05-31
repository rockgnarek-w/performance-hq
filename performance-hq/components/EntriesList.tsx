'use client';

import { useMemo } from 'react';
import { supabase, Entry } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  const [, m, day] = d.split('-');
  return `${m}-${day}`;
}

type AggregatedRow = {
  date: string;
  account_id_fb: string;
  geo_code: string | null;
  offer_id: number | null;
  offer_name: string;
  crm_id: string;
  spend: number;
  campaign_name: string;
  entry_ids: number[];
  source: string;
};

export default function EntriesList({
  entries,
  onChanged,
}: {
  entries: Entry[];
  onChanged: () => void;
}) {
  const aggregated = useMemo<AggregatedRow[]>(() => {
    const map = new Map<string, AggregatedRow>();

    for (const e of entries) {
      const key = `${e.date}|${e.account_id_fb || ''}|${e.offer_id ?? 'null'}`;
      const existing = map.get(key);

      if (existing) {
        existing.spend += e.spend;
        existing.entry_ids.push(e.id);
        if (e.campaign_name && (!existing.campaign_name || e.campaign_name < existing.campaign_name)) {
          existing.campaign_name = e.campaign_name;
        }
      } else {
        map.set(key, {
          date: e.date,
          account_id_fb: e.account_id_fb || '',
          geo_code: e.geo_code,
          offer_id: e.offer_id,
          offer_name: e.offers?.offer_name || 'unmapped',
          crm_id: e.offers?.crm_id || '—',
          spend: e.spend,
          campaign_name: e.campaign_name || '',
          entry_ids: [e.id],
          source: e.source,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.account_id_fb !== b.account_id_fb) return a.account_id_fb.localeCompare(b.account_id_fb);
      return a.crm_id.localeCompare(b.crm_id);
    });
  }, [entries]);

  const handleDelete = async (ids: number[]) => {
    const count = ids.length;
    if (!confirm(`Delete ${count} ${count === 1 ? 'entry' : 'entries'} (whole group)?`)) return;
    await supabase.from('entries').delete().in('id', ids);
    onChanged();
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ margin: 0 }}>
          Entries ({aggregated.length} groups / {entries.length} raw)
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="muted">No entries yet. Add your first above.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="entries-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account ID</th>
                <th>Geo</th>
                <th>Offer</th>
                <th>CRM ID</th>
                <th>Spend</th>
                <th>Campaign Name</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {aggregated.map((r, idx) => {
                const flag = r.geo_code ? FLAGS[r.geo_code] || '🏳️' : '';
                const groupSize = r.entry_ids.length;

                return (
                  <tr key={idx}>
                    <td>{formatDate(r.date)}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {r.account_id_fb || <span className="muted">—</span>}
                    </td>
                    <td>{flag} {r.geo_code || <span className="muted">—</span>}</td>
                    <td>{r.offer_name}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                      {r.crm_id}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(r.spend)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {r.campaign_name || '—'}
                      {groupSize > 1 && (
                        <span className="muted" style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>
                          (+{groupSize - 1})
                        </span>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: 11 }}>{r.source}</td>
                    <td>
                      <button
                        onClick={() => handleDelete(r.entry_ids)}
                        title={`Delete ${groupSize} entries`}
                        style={{ opacity: 0.4 }}
                      >
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
