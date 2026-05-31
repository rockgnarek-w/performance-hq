'use client';

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

  // Сортировка: дата DESC, внутри даты по CRM ID
  const sorted = [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const aCrm = a.offers?.crm_id || '';
    const bCrm = b.offers?.crm_id || '';
    return aCrm.localeCompare(bCrm);
  });

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
                <th>CRM ID</th>
                <th>Spend</th>
                <th>Campaign Name</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const flag = e.geo_code ? FLAGS[e.geo_code] || '🏳️' : '';
                const crmId = e.offers?.crm_id || <span className="muted">—</span>;
                const offerName = e.offers?.offer_name || <span className="muted">unmapped</span>;

                return (
                  <tr key={e.id}>
                    <td>{formatDate(e.date)}</td>
                    <td>{flag} {e.geo_code || <span className="muted">—</span>}</td>
                    <td>{offerName}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{crmId}</td>
                    <td>{formatMoney(e.spend)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{e.campaign_name || '—'}</td>
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
