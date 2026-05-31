'use client';

import { useEffect, useState } from 'react';
import { supabase, Offer } from '@/lib/supabase';

const FLAGS: Record<string, string> = {
  AU: '🇦🇺', CA: '🇨🇦', UK: '🇬🇧', GB: '🇬🇧',
  FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', PL: '🇵🇱', US: '🇺🇸',
};

export default function OffersView() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<number | null>(null);

  const [newGeo, setNewGeo] = useState('');
  const [newOfferCode, setNewOfferCode] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newOfferName, setNewOfferName] = useState('');
  const [newCrmId, setNewCrmId] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('offers')
      .select('*')
      .order('active', { ascending: false })
      .order('country_name')
      .order('offer_name');
    setOffers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateField = async (id: number, field: keyof Offer, value: any) => {
    setOffers((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
    await supabase.from('offers').update({ [field]: value }).eq('id', id);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 1200);
  };

  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`Delete offer "${code}"?\n\nWARNING: This will break parsing for any campaigns still using this offer code. Consider setting "active" to false instead.`)) return;
    await supabase.from('offers').delete().eq('id', id);
    load();
  };

  const handleAdd = async () => {
    const geo = newGeo.trim().toUpperCase();
    const code = newOfferCode.trim().toLowerCase();
    if (!/^[A-Z]{2}$/.test(geo)) {
      alert('Geo must be exactly 2 uppercase letters (e.g. CA, AU, FR)');
      return;
    }
    if (!/^[a-z]+$/.test(code)) {
      alert('Offer code must be lowercase letters only (e.g. montr, thunder)');
      return;
    }
    if (!newCountry.trim() || !newOfferName.trim() || !newCrmId.trim()) {
      alert('Country, Offer Name, and CRM ID are required');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('offers').insert({
      geo_code: geo,
      offer_code: code,
      country_name: newCountry.trim(),
      offer_name: newOfferName.trim(),
      crm_id: newCrmId.trim(),
      active: true,
    });
    setAdding(false);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    setNewGeo(''); setNewOfferCode(''); setNewCountry(''); setNewOfferName(''); setNewCrmId('');
    load();
  };

  const counts = {
    active: offers.filter((o) => o.active).length,
    inactive: offers.filter((o) => !o.active).length,
    total: offers.length,
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Active Offers</div>
          <div className="stat-value profit-positive">{counts.active}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Inactive</div>
          <div className="stat-value muted">{counts.inactive}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total</div>
          <div className="stat-value">{counts.total}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Add New Offer</div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
          Add the offer BEFORE launching campaigns so parser maps them correctly.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 130px 1fr 1fr 100px auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label className="label">GEO</label>
            <input
              type="text"
              value={newGeo}
              onChange={(e) => setNewGeo(e.target.value.toUpperCase())}
              placeholder="CA"
              maxLength={2}
              style={{ textTransform: 'uppercase' }}
            />
          </div>
          <div>
            <label className="label">offer_code</label>
            <input
              type="text"
              value={newOfferCode}
              onChange={(e) => setNewOfferCode(e.target.value.toLowerCase())}
              placeholder="montr"
            />
          </div>
          <div>
            <label className="label">Country</label>
            <input
              type="text"
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              placeholder="Canada"
            />
          </div>
          <div>
            <label className="label">Offer Name</label>
            <input
              type="text"
              value={newOfferName}
              onChange={(e) => setNewOfferName(e.target.value)}
              placeholder="Montreal"
            />
          </div>
          <div>
            <label className="label">CRM ID</label>
            <input
              type="text"
              value={newCrmId}
              onChange={(e) => setNewCrmId(e.target.value)}
              placeholder="10982"
            />
          </div>
          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px' }}
            onClick={handleAdd}
            disabled={adding}
          >
            {adding ? '...' : 'Add'}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
          Campaign name template: <strong>[account_id]_{newGeo || 'CA'}{newOfferCode || 'montr'}_1</strong>
        </p>
      </div>

      <div className="card">
        <div className="card-title">All Offers ({offers.length})</div>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="entries-table">
              <thead>
                <tr>
                  <th>GEO</th>
                  <th>offer_code</th>
                  <th>Country</th>
                  <th>Offer Name</th>
                  <th>CRM ID</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id} style={savedId === o.id ? { background: 'rgba(74,222,128,0.05)' } : undefined}>
                    <td>{FLAGS[o.geo_code] || '🏳️'} {o.geo_code}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace' }}>{o.offer_code}</td>
                    <td>
                      <input
                        type="text"
                        defaultValue={o.country_name}
                        onBlur={(e) => e.target.value !== o.country_name && updateField(o.id, 'country_name', e.target.value)}
                        style={{ padding: '4px 8px', width: '100%' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        defaultValue={o.offer_name}
                        onBlur={(e) => e.target.value !== o.offer_name && updateField(o.id, 'offer_name', e.target.value)}
                        style={{ padding: '4px 8px', width: '100%' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        defaultValue={o.crm_id}
                        onBlur={(e) => e.target.value !== o.crm_id && updateField(o.id, 'crm_id', e.target.value)}
                        style={{ padding: '4px 8px', width: 90, fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={o.active}
                        onChange={(e) => updateField(o.id, 'active', e.target.checked)}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(o.id, o.offer_code)}
                        title="Delete"
                        style={{ opacity: 0.4 }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Edit any field by clicking. Changes save when you click out (Tab or click elsewhere). Only <strong>active</strong> offers are matched by the parser.
        </p>
      </div>
    </>
  );
}
