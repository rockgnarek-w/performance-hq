'use client';

import { useState, useMemo, useEffect } from 'react';
import { supabase, Entry, Offer } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',')}`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      onClick={handleCopy}
      title={`Copy: ${value}`}
      style={{
        marginLeft: 4,
        padding: '1px 5px',
        fontSize: 10,
        background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
        color: copied ? '#4ade80' : '#888',
        border: 'none',
        borderRadius: 3,
        cursor: 'pointer',
        verticalAlign: 'middle',
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

type CampaignRow = {
  date: string;
  account_id_fb: string | null;
  geo_code: string | null;
  offer_name: string;
  crm_id: string;
  source: string;
  spend: number;
  adCount: number;
  campaignCount: number;
  campaignName: string; // имя одной (первой) кампании группы — для отображения
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

  // Карта account_id_fb -> supplier (поставщик/агентство), тянем из accounts
  const [supplierMap, setSupplierMap] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from('accounts')
      .select('account_id_fb, supplier')
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data || []).forEach((a: any) => {
          if (a.account_id_fb) m[String(a.account_id_fb)] = a.supplier || '';
        });
        setSupplierMap(m);
      });
  }, []);

  // Достаём account_id из записи: сперва поле, иначе из начала названия кампании
  const resolveAccountId = (accountId: string | null, campaignName: string | null): string | null => {
    if (accountId) return String(accountId);
    if (campaignName) {
      const m = campaignName.match(/^(\d{6,})/);
      if (m) return m[1];
    }
    return null;
  };

  const supplierFor = (accountId: string | null, campaignName: string | null): string => {
    const id = resolveAccountId(accountId, campaignName);
    return id ? supplierMap[id] || '' : '';
  };

  const grouped: CampaignRow[] = useMemo(() => {
    const map = new Map<string, CampaignRow>();
    const campaignsByKey = new Map<string, Set<string>>();

    entries.forEach((e) => {
      if (filterDate && e.date !== filterDate) return;
      if (filterSource !== 'all' && e.source !== filterSource) return;
      if (search) {
        const q = search.toLowerCase();
        const supplierName = supplierFor(e.account_id_fb, e.campaign_name);
        const inFields = [e.campaign_name, e.note, e.account_id_fb, e.geo_code, e.offers?.crm_id, supplierName]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
        if (!inFields) return;
      }

      // Группировка по КАБ + ОФЕР (а не по отдельной кампании):
      // все кампании одного каба с одним офером схлопываются в одну строку.
      const offerKey = e.offer_id != null ? `o${e.offer_id}` : (e.offers?.crm_id || '—');
      const key = `${e.date}|${e.account_id_fb || '—'}|${offerKey}`;

      // считаем уникальные кампании внутри группы
      let cset = campaignsByKey.get(key);
      if (!cset) {
        cset = new Set<string>();
        campaignsByKey.set(key, cset);
      }
      if (e.campaign_name) cset.add(e.campaign_name);

      const cur = map.get(key);
      if (cur) {
        cur.spend += e.spend || 0;
        cur.adCount += 1;
        cur.ids.push(e.id);
        cur.campaignCount = cset.size;
      } else {
        map.set(key, {
          date: e.date,
          account_id_fb: e.account_id_fb,
          geo_code: e.geo_code,
          offer_name: e.offers?.offer_name || (e.offer_id === null ? '—' : '?'),
          crm_id: e.offers?.crm_id || '',
          source: e.source,
          spend: e.spend || 0,
          adCount: 1,
          campaignCount: cset.size,
          campaignName: '',
          ids: [e.id],
        });
      }
    });

    // У каждой группы берём имя ОДНОЙ кампании (первой по сортировке —
    // обычно это ..._1) для отображения вместо act_id.
    map.forEach((row, key) => {
      const cset = campaignsByKey.get(key);
      if (cset && cset.size) {
        row.campaignName = Array.from(cset).sort()[0];
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.spend - a.spend;
    });
  }, [entries, filterDate, filterSource, search, supplierMap]);

  const handleDeleteCampaign = async (row: CampaignRow) => {
    if (!confirm(`Delete ${row.adCount} entr${row.adCount === 1 ? 'y' : 'ies'} for account act_${row.account_id_fb || '—'} · ${row.offer_name} on ${row.date}?`)) return;
    await supabase.from('entries').delete().in('id', row.ids);
    onChanged();
  };

  const uniqueDates = useMemo(() => {
    const set = new Set(entries.map((e) => e.date));
    return Array.from(set).sort().reverse();
  }, [entries]);

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
                <th>Date</th>
                <th>Geo / Offer</th>
                <th>CRM ID</th>
                <th>Campaign</th>
                <th>Supplier</th>
                <th>Ads</th>
                <th>Cost</th>
                <th>Src</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grouped.slice(0, 500).map((r, idx) => {
                const flag = r.geo_code ? FLAGS[r.geo_code] || '🏳️' : '';
                return (
                  <tr key={`${r.date}-${r.account_id_fb}-${r.crm_id}-${idx}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td>
                      {flag} <strong>{r.geo_code || '—'}</strong>
                      <span className="muted"> · {r.offer_name}</span>
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {r.crm_id ? (
                        <>
                          <span style={{ color: '#d4a017' }}>{r.crm_id}</span>
                          <CopyButton value={r.crm_id} />
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {r.campaignName ? (
                        <>
                          <span style={{ color: '#d4a017' }}>{r.campaignName}</span>
                          <CopyButton value={r.campaignName} />
                          {r.campaignCount > 1 && (
                            <span className="muted" style={{ fontSize: 10, marginLeft: 6 }}>
                              · {r.campaignCount} camp.
                            </span>
                          )}
                        </>
                      ) : r.account_id_fb ? (
                        <>
                          <span style={{ color: '#d4a017' }}>act_{r.account_id_fb}</span>
                          <CopyButton value={`act_${r.account_id_fb}`} />
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const supplier = supplierFor(r.account_id_fb, null);
                        return supplier ? (
                          <span style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 4,
                            whiteSpace: 'nowrap',
                            background: 'rgba(212,160,23,0.1)',
                            color: '#d4a017',
                          }}>
                            {supplier}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        );
                      })()}
                    </td>
                    <td className="muted">{r.adCount}</td>
                    <td>
                      <strong>{formatMoney(r.spend)}</strong>
                      <CopyButton value={r.spend.toFixed(2)} />
                    </td>
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
        💡 Сгруппировано по кампаниям. <strong>⧉</strong> копирует значение в буфер. Удаление сносит все записи кампании за день.
      </p>
    </div>
  );
}
