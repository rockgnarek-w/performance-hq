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

export default function CreativesView({ offers, entries }: { offers: Offer[]; entries: Entry[] }) {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Фильтры
  const [filterOffer, setFilterOffer] = useState<string>('all');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [search, setSearch] = useState('');

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

  // Метрики per-creative из entries
  const metricsByCreative = useMemo(() => {
    const map = new Map<string, { spend: number; campaigns: number }>();
    for (const e of entries) {
      if (!e.creative_id) continue;
      const cur = map.get(e.creative_id) || { spend: 0, campaigns: 0 };
      cur.spend += e.spend;
      cur.campaigns += 1;
      map.set(e.creative_id, cur);
    }
    return map;
  }, [entries]);

  // Доступные авторы для фильтра
  const authors = useMemo(() => {
    const set = new Set<string>();
    creatives.forEach((c) => c.author && set.add(c.author));
    return Array.from(set).sort();
  }, [creatives]);

  // Фильтрация
  const filtered = useMemo(() => {
    return creatives.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterOffer !== 'all' && c.offer_id !== parseInt(filterOffer)) return false;
      if (filterAuthor !== 'all' && c.author !== filterAuthor) return false;
      if (search) {
        const q = search.toLowerCase();
        const inFields = [c.creative_id, c.notes, c.file_name, c.author]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
        if (!inFields) return false;
      }
      return true;
    });
  }, [creatives, filterOffer, filterAuthor, filterStatus, search]);

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

    // Удаляем файл из storage
    if (creative.file_url) {
      const filename = creative.file_url.split('/').pop();
      if (filename) {
        await supabase.storage.from('creatives').remove([filename]);
      }
    }

    await supabase.from('creatives').delete().eq('id', creative.id);
    load();
  };

  // Счётчики
  const counts = {
    active: creatives.filter((c) => c.status === 'active').length,
    archived: creatives.filter((c) => c.status === 'archived').length,
    total: creatives.length,
  };

  return (
    <>
      {/* Stat cards */}
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

      {/* Filters + Upload */}
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Search by ID, notes, author..."
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

          <select value={filterAuthor} onChange={(e) => setFilterAuthor(e.target.value)} style={{ width: 'auto', padding: '8px 12px' }}>
            <option value="all">All authors</option>
            {authors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto', padding: '8px 12px' }}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>

          <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setShowUpload(true)}>
            + Upload
          </button>
        </div>
      </div>

      {/* Grid */}
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}>
            {filtered.map((c) => {
              const metrics = metricsByCreative.get(c.creative_id);
              const isCopied = copiedId === c.creative_id;
              const flag = c.geo_code ? FLAGS[c.geo_code] || '🏳️' : '';

              return (
                <div
                  key={c.id}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    opacity: c.status === 'archived' ? 0.5 : 1,
                  }}
                >
                  {/* Preview */}
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

                  {/* Info */}
                  <div style={{ padding: 12 }}>
                    {/* ID with copy */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
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

                    {/* Metrics */}
                    {metrics ? (
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 8 }}>
                        <div>
                          <div className="muted" style={{ fontSize: 10 }}>Spend</div>
                          <div style={{ fontWeight: 600 }}>{formatMoney(metrics.spend)}</div>
                        </div>
                        <div>
                          <div className="muted" style={{ fontSize: 10 }}>Camps</div>
                          <div style={{ fontWeight: 600 }}>{metrics.campaigns}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
                        No data yet
                      </div>
                    )}

                    {/* Meta */}
                    <div className="muted" style={{ fontSize: 10, marginBottom: 8 }}>
                      {c.author} · {new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </div>

                    {/* Actions */}
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
          💡 Click on creative ID to copy. Use it in campaign names: <strong>[account_id]_[GEO][offer]_[creative_id]_1</strong>
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
