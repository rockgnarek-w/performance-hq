'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, Creative, Offer, Entry } from '@/lib/supabase';
import CreativeUploadModal from './CreativeUploadModal';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

type CreativeMetrics = {
  spend: number;
  clicks: number;
  purchases: number;
  revenue: number;
  ads: number;
};

export default function CreativesView({ offers, entries }: { offers: Offer[]; entries: Entry[] }) {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [filterOffer, setFilterOffer] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterPerf, setFilterPerf] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'spend' | 'roas' | 'recent'>('spend');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('creatives')
      .select('*, offers(*)')
      .order('created_at', { ascending: false });
    setCreatives(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Метрики per-creative по ad_name (т.к. парсер пишет ad_name как creative_id)
  // А также проверяем по creative_id (на случай если кто-то в FB пишет именно ID)
  const metricsByName = useMemo(() => {
    const map = new Map<string, CreativeMetrics>();
    for (const e of entries) {
      const key = e.ad_name || e.creative_id;
      if (!key) continue;
      const cur = map.get(key) || { spend: 0, clicks: 0, purchases: 0, revenue: 0, ads: 0 };
      cur.spend += e.spend || 0;
      cur.clicks += e.clicks || 0;
      cur.purchases += e.purchases || 0;
      cur.revenue += e.purchase_value || 0;
      cur.ads += 1;
      map.set(key, cur);
    }
    return map;
  }, [entries]);

  const getMetrics = (c: Creative): CreativeMetrics | null => {
    // Сначала ищем по creative_id, потом по file_name (без расширения)
    return metricsByName.get(c.creative_id) || 
           (c.file_name ? metricsByName.get(c.file_name.replace(/\.[^.]+$/, '')) : null) ||
           null;
  };

  const filtered = useMemo(() => {
    let list = creatives.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterOffer !== 'all' && c.offer_id !== parseInt(filterOffer)) return false;
      if (search) {
        const q = search.toLowerCase();
        const inFields = [c.creative_id, c.notes, c.file_name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
        if (!inFields) return false;
      }
      // Фильтр по performance
      if (filterPerf !== 'all') {
        const m = getMetrics(c);
        if (filterPerf === 'winners' && (!m || m.purchases === 0 || m.revenue <= m.spend)) return false;
        if (filterPerf === 'losers' && (!m || m.spend < 20 || m.purchases > 0)) return false;
        if (filterPerf === 'no-data' && m && m.spend > 0) return false;
      }
      return true;
    });

    // Сортировка
    if (sortBy === 'spend') {
      list.sort((a, b) => {
        const ma = getMetrics(a)?.spend || 0;
        const mb = getMetrics(b)?.spend || 0;
        return mb - ma;
      });
    } else if (sortBy === 'roas') {
      list.sort((a, b) => {
        const ma = getMetrics(a);
        const mb = getMetrics(b);
        const ra = ma && ma.spend > 0 ? ma.revenue / ma.spend : 0;
        const rb = mb && mb.spend > 0 ? mb.revenue / mb.spend : 0;
        return rb - ra;
      });
    }
    // 'recent' = по умолчанию из load() (created_at DESC)

    return list;
  }, [creatives, filterOffer, filterStatus, filterPerf, search, sortBy, metricsByName]);

  const handleCopy = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleArchive = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    await supabase.from('creatives').update({ status: newStatus }).eq('id', id);
    load();
  };

  const handleDelete = async (creative: Creative) => {
    if (!confirm(`Delete creative "${creative.creative_id}"? This will also delete the file from storage.`)) return;
    if (creative.file_url) {
      const filename = creative.file_url.split('/').pop();
      if (filename) {
        await supabase.storage.from('creatives').remove([filename]);
      }
    }
    await supabase.from('creatives').delete().eq('id', creative.id);
    load();
  };

  const counts = {
    active: creatives.filter((c) => c.status === 'active').length,
    archived: creatives.filter((c) => c.status === 'archived').length,
    total: creatives.length,
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Active</div>
          <div className="stat-value profit-positive">{counts.active}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Archived</div>
          <div className="stat-value muted">{counts.archived}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total</div>
          <div className="stat-value">{counts.total}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Search by ID, notes, filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '8px 12px' }}
          />

          <select value={filterOffer} onChange={(e) => setFilterOffer(e.target.value)} style={{ width: 'auto', padding: '8px 12px' }}>
            <option value="all">All offers</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.geo_code} · {o.offer_name}
              </option>
            ))}
          </select>

          <select value={filterPerf} onChange={(e) => setFilterPerf(e.target.value)} style={{ width: 'auto', padding: '8px 12px' }}>
            <option value="all">All performance</option>
            <option value="winners">🟢 Winners (ROAS+)</option>
            <option value="losers">🔴 Losers ($20+ no purchase)</option>
            <option value="no-data">⚪ No data yet</option>
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto', padding: '8px 12px' }}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ width: 'auto', padding: '8px 12px' }}>
            <option value="spend">Sort: Spend</option>
            <option value="roas">Sort: ROAS</option>
            <option value="recent">Sort: Recent</option>
          </select>

          <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setShowUpload(true)}>
            + Upload
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Creatives ({filtered.length}{filtered.length !== creatives.length ? ` / ${creatives.length}` : ''})
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="muted">
            {creatives.length === 0
              ? 'No creatives yet. Upload your first to get started.'
              : 'No creatives match the current filters.'}
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {filtered.map((c) => {
              const m = getMetrics(c);
              const isCopied = copiedId === c.creative_id;
              const flag = c.geo_code ? FLAGS[c.geo_code] || '🏳️' : '';
              const roas = m && m.spend > 0 ? m.revenue / m.spend : 0;
              const isWinner = m && m.purchases > 0 && roas >= 1;
              const isLoser = m && m.spend >= 20 && m.purchases === 0;

              const borderColor = isWinner ? '#4ade80' 
                : isLoser ? '#ef4444' 
                : 'rgba(255,255,255,0.06)';

              return (
                <div
                  key={c.id}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${borderColor}`,
                    borderLeft: `3px solid ${borderColor}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    opacity: c.status === 'archived' ? 0.5 : 1,
                  }}
                >
                  <div style={{
                    aspectRatio: '1',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {c.file_url ? (
                      c.file_type === 'video' ? (
                        <video src={c.file_url} muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} onMouseEnter={(e) => (e.target as HTMLVideoElement).play()} onMouseLeave={(e) => (e.target as HTMLVideoElement).pause()} />
                      ) : (
                        <img src={c.file_url} alt={c.creative_id} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )
                    ) : (
                      <span className="muted">No file</span>
                    )}
                  </div>

                  <div style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span
                        onClick={() => handleCopy(c.creative_id)}
                        style={{
                          fontFamily: 'ui-monospace, monospace',
                          fontWeight: 600,
                          fontSize: 13,
                          background: isCopied ? 'rgba(74,222,128,0.15)' : 'rgba(212,160,23,0.1)',
                          color: isCopied ? '#4ade80' : '#d4a017',
                          padding: '3px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        {isCopied ? '✓ copied' : c.creative_id}
                      </span>
                      {c.offers && (
                        <span className="muted" style={{ fontSize: 11 }}>
                          {flag} {c.offers.offer_name}
                        </span>
                      )}
                    </div>

                    {m && m.spend > 0 ? (
                      <>
                        {/* Главная метрика — ROAS */}
                        <div style={{
                          padding: '8px 10px',
                          background: isWinner ? 'rgba(74,222,128,0.08)' : isLoser ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                          borderRadius: 6,
                          marginBottom: 10,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <div>
                            <div className="muted" style={{ fontSize: 10 }}>ROAS</div>
                            <div style={{
                              fontWeight: 700,
                              fontSize: 18,
                              color: isWinner ? '#4ade80' : isLoser ? '#ef4444' : '#fff'
                            }}>
                              {m.spend > 0 ? roas.toFixed(2) : '—'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="muted" style={{ fontSize: 10 }}>Purchases</div>
                            <div style={{ fontWeight: 600, fontSize: 16, color: m.purchases > 0 ? '#4ade80' : '#666' }}>
                              {m.purchases}
                            </div>
                          </div>
                        </div>

                        {/* Детальные метрики */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11, marginBottom: 8 }}>
                          <div>
                            <div className="muted" style={{ fontSize: 9 }}>Spend</div>
                            <div style={{ fontWeight: 600 }}>{formatMoney(m.spend)}</div>
                          </div>
                          <div>
                            <div className="muted" style={{ fontSize: 9 }}>Revenue</div>
                            <div style={{ fontWeight: 600 }}>{formatMoney(m.revenue)}</div>
                          </div>
                          <div>
                            <div className="muted" style={{ fontSize: 9 }}>Clicks</div>
                            <div style={{ fontWeight: 600 }}>{m.clicks}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="muted" style={{ fontSize: 11, marginBottom: 8, padding: '8px 0' }}>
                        No performance data yet
                      </div>
                    )}

                    <div className="muted" style={{ fontSize: 10, marginBottom: 8 }}>
                      Uploaded {new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleArchive(c.id, c.status)}
                        title={c.status === 'active' ? 'Archive' : 'Activate'}
                        style={{ flex: 1, padding: '4px 6px', fontSize: 11 }}
                      >
                        {c.status === 'active' ? '🗄️ Archive' : '↻ Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        title="Delete"
                        style={{ padding: '4px 8px', opacity: 0.5, fontSize: 13 }}
                      >
                        🗑
                      </button>
                    </div>

                    {c.notes && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                        {c.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>
          💡 Match by <strong>creative_id = ad_name in FB</strong>. ROAS based on FB Pixel purchases (~85% accuracy).
          Зелёная рамка = winner (ROAS ≥ 1.0 with purchases). Красная = loser ($20+ spend без покупок).
        </p>
      </div>

      {showUpload && (
        <CreativeUploadModal
          offers={offers}
          onClose={() => setShowUpload(false)}
          onUploaded={load}
        />
      )}
    </>
  );
}
