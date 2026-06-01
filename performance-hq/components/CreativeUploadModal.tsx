'use client';

import { useState, useRef } from 'react';
import { supabase, Offer } from '@/lib/supabase';

// Генератор короткого уникального ID (5 символов: буквы+цифры)
function generateCreativeId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > 50 * 1024 * 1024) {
      setError('File too large (max 50 MB)');
      return;
    }

    setFile(f);
    setError(null);

    if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
      const url = URL.createObjectURL(f);
      setPreviewLocal(url);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Select a file first');
      return;
    }

    setUploading(true);
    setError(null);

    // 1. Генерируем уникальный creative_id
    let creativeId = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCreativeId();
      const { data: existing } = await supabase
        .from('creatives')
        .select('id')
        .eq('creative_id', candidate)
        .maybeSingle();
      if (!existing) {
        creativeId = candidate;
        break;
      }
    }

    if (!creativeId) {
      setError('Failed to generate unique ID. Try again.');
      setUploading(false);
      return;
    }

    // 2. Загружаем файл в Storage
    const ext = file.name.split('.').pop() || 'bin';
    const storagePath = `${creativeId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('creatives')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      setError('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    // 3. Получаем публичный URL
    const { data: urlData } = supabase.storage
      .from('creatives')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // 4. Определяем тип
    const fileType = file.type.startsWith('video/') ? 'video' : 'image';

    // 5. Находим geo_code из выбранного offer'а
    const selectedOffer = offers.find((o) => o.id === parseInt(offerId));
    const geo = selectedOffer?.geo_code || null;

    // 6. Создаём запись в creatives (author=null, без привязки к FB-аккаунтам)
    const { error: insertError } = await supabase.from('creatives').insert({
      creative_id: creativeId,
      offer_id: offerId ? parseInt(offerId) : null,
      geo_code: geo,
      file_url: publicUrl,
      preview_url: publicUrl,
      file_type: fileType,
      file_name: file.name,
      author: null,
      notes: notes || null,
      status: 'active',
    });

    setUploading(false);

    if (insertError) {
      setError('DB insert failed: ' + insertError.message);
      return;
    }

    onUploaded();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f0f0f',
          border: '1px solid rgba(212, 160, 23, 0.2)',
          borderRadius: 12,
          padding: 28,
          maxWidth: 500,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Upload Creative</h2>
          <button onClick={onClose} style={{ background: 'transparent', fontSize: 20, padding: 0 }}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="label">File (image or video, max 50 MB)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            style={{ width: '100%' }}
          />
        </div>

        {previewLocal && file && (
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            {file.type.startsWith('image/') ? (
              <img src={previewLocal} alt="preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6 }} />
            ) : (
              <video src={previewLocal} controls style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6 }} />
            )}
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label className="label">Offer (optional)</label>
          <select value={offerId} onChange={(e) => setOfferId(e.target.value)}>
            <option value="">— No offer —</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.geo_code} · {o.offer_name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="label">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="UGC style, talking head, winners list, etc."
            rows={2}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} className="nav-btn" style={{ flex: 1 }}>
            Cancel
          </button>
          <button onClick={handleUpload} className="btn-primary" disabled={uploading || !file} style={{ flex: 1 }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
