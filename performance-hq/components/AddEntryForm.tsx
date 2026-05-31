'use client';

import { useState } from 'react';
import { supabase, Offer } from '@/lib/supabase';

export default function AddEntryForm({
  offers,
  onAdded,
}: {
  offers: Offer[];
  onAdded: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [offerId, setOfferId] = useState<string>(offers[0]?.id.toString() || '');
  const [spend, setSpend] = useState('');
  const [deposits, setDeposits] = useState('');
  const [payoutPerDep, setPayoutPerDep] = useState('300');
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSubmit = async () => {
    if (!offerId) {
      setMessage({ type: 'error', text: 'Select an offer' });
      return;
    }

    const offer = offers.find((o) => o.id.toString() === offerId);
    if (!offer) return;

    setSubmitting(true);
    setMessage(null);

    const { error } = await supabase.from('entries').insert({
      date,
      offer_id: parseInt(offerId),
      geo_code: offer.geo_code,
      spend: parseFloat(spend) || 0,
      deposits: parseInt(deposits) || 0,
      payout_per_dep: parseFloat(payoutPerDep) || 0,
      account_id_fb: accountId || null,
      note: note || null,
      source: 'manual',
    });

    setSubmitting(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Entry added' });
      setSpend('');
      setDeposits('');
      setAccountId('');
      setNote('');
      onAdded();
      setTimeout(() => setMessage(null), 2000);
    }
  };

  return (
    <div className="card">
      <div className="card-title">New Entry</div>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="form-grid">
        <div>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label>Offer (Geo)</label>
          <select value={offerId} onChange={(e) => setOfferId(e.target.value)}>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.country_name} — {o.offer_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Spend ($)</label>
          <input
            type="number"
            step="0.01"
            placeholder="0"
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
          />
        </div>
      </div>

      <div className="form-grid">
        <div>
          <label>Deposits</label>
          <input
            type="number"
            placeholder="0"
            value={deposits}
            onChange={(e) => setDeposits(e.target.value)}
          />
        </div>
        <div>
          <label>Payout per Dep ($)</label>
          <input
            type="number"
            step="0.01"
            placeholder="300"
            value={payoutPerDep}
            onChange={(e) => setPayoutPerDep(e.target.value)}
          />
        </div>
        <div>
          <label>Account ID (optional)</label>
          <input
            placeholder="e.g. 1620007262638779"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
        </div>
      </div>

      <div className="form-grid-2">
        <div style={{ gridColumn: 'span 2' }}>
          <label>Note (optional)</label>
          <input
            placeholder="any comment"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Adding...' : 'Add Entry'}
      </button>
    </div>
  );
}
