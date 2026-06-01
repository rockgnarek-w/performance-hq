'use client';

import { useMemo, useState } from 'react';
import { supabase, Entry } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

// Формат с запятой как разделитель десятичных
function formatMoneyComma(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',');
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
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const [filterDate, setFilterDate] = useState<string>(yesterday);
  const [filterMode, setFilterMode] = useState<'date' | 'all'>('date');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Список доступных дат
  const availableDates = useMemo(() => {
    const set = new Set(entries.map((e) => e.date));
    return Array.from(set).sort().reverse();
  }, [entries]);

  // Агрегация
  const aggregated = useMemo<AggregatedRow[]>(() => {
    const map = new Map<string, AggregatedRow>();

    const filtered = filterMode === 'all'
      ? entries
      : entries.filter((e) => e.date === filterDate);

    for (const e of filtered) {
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
  }, [entries, filterDate, filterMode]);

  const handleDelete = async (ids: number[]) => {
    const count = ids.length;
    if (!confirm(`Delete ${count} ${count === 1 ? 'entry' : 'entries'} (whole group)?`)) return;
    await supabase.from('entries').delete().in('id', ids);
    onChanged();
  };

  const handleCopyRow = async (r: AggregatedRow, key: string) => {
    // TSV формат — удобен для вставки в Excel/Sheets/CRM
    const spendFormatted = formatMoneyComma(r.spend);
    const line = `${r.date}\t${r.account_id_fb}\t${r.geo_code || ''}\t${r.offer_name}\t${r.crm_id}\t${spendFormatted}\t${r.campaign_name}`;
    
    try {
      await navigator.clipboard.writeText(line);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch (e) {
      alert('Copy failed. Manual copy: ' + line);
    }
  };

  // Группировка по датам для разделителей в режиме All
  const renderRows = () => {
    const rows: JSX.Element[] = [];
    let lastDate: string | null = null;

    aggregated.forEach((r, idx) => {
      const key = `${r.date}-${r.account_id_fb}-${r.offer_id}`;
      const flag = r.geo_code ? FLAGS[r.geo_code] || '🏳️' : '';
      const groupSize = r.entry_ids.length;
      const isCopied = copiedKey === key;

      // Разделитель между датами (только в режиме All)
      if (filterMode === 'all' && r.date !== lastDate) {
        rows.push(
          <tr key={`sep-${r.date}`}>
            <td colSpan={9} style={{
              padding: '20px 0 8px 0',
              borderBottom: '1px solid rgba(212, 160, 23, 0.15)',
              color: '#d4a017',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              ━━━ {r.date} ━━━
            </td>
          </tr>
        );
        lastDate = r.date;
      }

      rows.push(
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
          <td style={{ fontWeight: 600 }}>{formatMoneyComma(r.spend)}</td>
          <td className="muted" style={{ fontSize: 12 }}>
            {r.campaign_name || '—'}
            {groupSize > 1 && (
              <span className="muted" style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>
                (+{groupSize - 1})
              </span>
            )}
          </td>
          <td className="muted" style={{ fontSize: 11 }}>{r.source}</td>
          <td style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => handleCopyRow(r, key)}
              title="Copy row"
              style={{
                opacity: isCopied ? 1 : 0.5,
                background: isCopied ? 'rgba(74, 222, 128, 0.15)' : 'transparent',
                color: isCopied ? '#4ade80' : 'inherit',
                padding: '2px 6px',
                fontSize: 13,
              }}
            >
              {isCopied ? '✓' : '📋'}
            </button>
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
    });

    return rows;
  };

  // Подсчёт суммарного спенда для отображения
  const totalSpend = aggregated.reduce((sum, r) => sum + r.spend, 0);

  return (
    <div className="card">
      {/* Фильтр сверху */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="label" style={{ margin: 0 }}>Date:</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setFilterMode('date'); }}
            style={{ width: 'auto', minWidth: 180, padding: '6px 10px' }}
          />
          <button
            className={`nav-btn ${filterMode === 'date' && filterDate === yesterday ? 'active' : ''}`}
            onClick={() => { setFilterDate(yesterday); setFilterMode('date'); }}
          >
            Yesterday
          </button>
          <button
            className={`nav-btn ${filterMode === 'date' && filterDate === today ? 'active' : ''}`}
            onClick={() => { setFilterDate(today); setFilterMode('date'); }}
          >
            Today
          </button>
          <button
            className={`nav-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All ({entries.length})
          </button>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Total spend</div>
          <div style={{ fontWeight: 600, fontSize: 18 }}>${formatMoneyComma(totalSpend)}</div>
        </div>
      </div>

      <div className="card-title" style={{ marginBottom: 12 }}>
        Entries ({aggregated.length} groups{filterMode === 'date' ? ` for ${filterDate}` : ' total'})
      </div>

      {aggregated.length === 0 ? (
        <p className="muted">No entries for {filterMode === 'date' ? filterDate : 'this filter'}.</p>
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
            <tbody>{renderRows()}</tbody>
          </table>
        </div>
      )}

      <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>
        📋 Click to copy row as TSV (tab-separated, ready to paste in Excel/CRM). Format: Date · Account · Geo · Offer · CRM ID · Spend · Campaign
      </p>
    </div>
  );
}
