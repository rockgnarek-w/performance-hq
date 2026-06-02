'use client';

import { useState, useEffect } from 'react';
import { supabase, Offer } from '@/lib/supabase';

// 5-символьный auto-ID — fallback если ручной не задан
function generateId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 5; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default function CreativeUploadModal({
  offers,
  onClose,
  onUploaded,
}: {
  offers: Offer[];
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [creativeId, setCreativeId] = useState<string>('');
  const [offerId, setOfferId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idTaken, setIdTaken] = useState(false);
  const [checking, setChecking] = useState(false);

  // Auto-generate ID on mount (если пользователь не введёт своё)
  useEffect(() => {
    if (!creativeId) setCreativeId(generateId());
  }, []);

  // Проверка что creative_id не занят — на изменение поля
  useEffect(() => {
    if (!creativeId || creativeId.length < 2) {
      setIdTaken(false);
      return;
    }
    const t = setTimeout(async () => {
      setChecking(true);
      const { data } = await supabase
        .from('creatives')
        .select('id')
        .eq('creative_id', creativeId)
        .maybeSingle();
      setIdTaken(!!data);
      setChecking(false);
    }, 400);
    return () => clearTimeout(t);
  }, [creativeId]);

  const handleSubmit = async () => {
    if (!file) {
      setError('Pick a file');
      return;
    }
    if (!creativeId || creativeId.length < 2) {
      setError('Creative ID is required (min 2 chars)');
      return;
    }
    if (idTaken) {
      setError('This Creative ID is already used. Pick another.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload file to storage
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${creativeId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('creatives')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from('creatives').getPublicUrl(path);

      // Detect type
      let fileType = 'image';
      if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) fileType = 'video';

      // Detect geo from offer
      const offer = offers.find((o) => o.id === parseInt(offerId));
      const geoCode = offer?.geo_code || null;

      // Insert record in creatives table
      const { error: dbError } = await supabase.from('creatives').insert({
        creative_id: creativeId,
        offer_id: offerId ? parseInt(offerId) : null,
        geo_code: geoCode,
        file_url: urlData.publicUrl,
        file_type: fileType,
        file_name: file.name,
        notes: notes || null,
        status: 'active',
      });

      if (dbError) throw dbError;

      onUploaded();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 500, width: '100%', margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>Upload Creative</div>
          <button onClick={onClose} style={{ padding: '4px 10px', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* File */}
          <div>
            <label className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              File (image or video)
            </label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ padding: 8 }}
            />
          </div>

          {/* Creative ID — ВАЖНОЕ ПОЛЕ, можно редактировать */}
          <div>
            <label className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Creative ID <span style={{ color: '#d4a017' }}>★</span> — must match your FB ad_name
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={creativeId}
                onChange={(e) => setCreativeId(e.target.value.trim())}
                placeholder="e.g. wildlife_img1"
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontWeight: 600,
                  color: idTaken ? '#ef4444' : '#d4a017',
                  borderColor: idTaken ? '#ef4444' : undefined,
                  padding: '8px 12px',
                }}
              />
              <button
                onClick={() => setCreativeId(generateId())}
                title="Generate random ID"
                style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap' }}
              >
                🎲 Random
              </button>
            </div>
            <div style={{ marginTop: 4, fontSize: 11 }}>
              {checking && <span className="muted">Checking...</span>}
              {!checking && idTaken && (
                <span style={{ color: '#ef4444' }}>⚠ This ID is already used</span>
              )}
              {!checking && !idTaken && creativeId.length >= 2 && (
                <span style={{ color: '#4ade80' }}>✓ Available</span>
              )}
            </div>
            <p className="muted" style={{ fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
              💡 In Facebook, name your ad with this exact ID (e.g. <code>wildlife_img1</code>).
              The dashboard will then match purchases & spend per creative.
            </p>
          </div>

          {/* Offer */}
          <div>
            <label className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Offer (optional)
            </label>
            <select value={offerId} onChange={(e) => setOfferId(e.target.value)} style={{ padding: 8 }}>
              <option value="">— Select offer —</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.geo_code} · {o.offer_name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Hook variant A, voice over by Sarah"
              style={{ padding: '8px 12px' }}
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={uploading || idTaken || !file}
            style={{ marginTop: 8 }}
          >
            {uploading ? 'Uploading...' : 'Upload Creative'}
          </button>
        </div>
      </div>
    </div>
  );
}
