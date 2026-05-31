'use client';

import { useEffect, useState } from 'react';
import { supabase, Account } from '@/lib/supabase';

const STATUS_OPTIONS = ['active', 'banned', 'paused', 'archived'];
const SOCIAL_OPTIONS = ['Юлия Янчук', 'Ян Куприн', 'Феодора', 'unknown'];

export default function AccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<number | null>(null);

  const [newAccountId, setNewAccountId] = useState('');
  const [newSocialName, setNewSocialName] = useState('Юлия Янчук');
  const [newStatus, setNewStatus] = useState('active');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .order('status')
      .order('social_name', { ascending: true, nullsFirst: false })
      .order('account_id_fb');
    setAccounts(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateField = async (id: number, field: 'social_name' | 'status', value: string) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
    await supabase.from('accounts').update({ [field]: value }).eq('id', id);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 1200);
  };

  const handleDelete = async (id: number, accountId: string) => {
    if (!confirm(`Delete account ${accountId}?\n\nThis is a soft delete — better to set status to "archived" if you might need it later.`)) return;
    await supabase.from('accounts').delete().eq('id', id);
    load();
  };

  const handleAdd = async () => {
    const cleaned = newAccountId.trim().replace(/^act_/, '');
    if (!/^\d{10,20}$/.test(cleaned)) {
      alert('Account ID must be only digits (10-20 of them). Without "act_" prefix.');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('accounts').insert({
      account_id_fb: cleaned,
      social_name: newSocialName,
      status: newStatus,
    });
    setAdding(false);
    if (error) {
      alert('Error adding: ' + error.message);
      return;
    }
    setNewAccountId('');
    load();
  };

  const counts = {
    active: accounts.filter((a) => a.status === 'active').length,
    banned: accounts.filter((a) => a.status === 'banned').length,
    paused: accounts.filter((a) => a.status === 'paused').length,
    archived: accounts.filter((a) => a.status === 'archived').length,
    total: accounts.length,
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Active</div>
          <div className="stat-value profit-positive">{counts.active}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Banned</div>
          <div className="stat-value profit-negative">{counts.banned}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Paused</div>
          <div className="stat-value">{counts.paused}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total</div>
          <div className="stat-value">{counts.total}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Add New Account</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label className="label">Account ID (без act_)</label>
            <input
              type="text"
              value={newAccountId}
              onChange={(e) => setNewAccountId(e.target.value)}
              placeholder="2802178210159752"
            />
          </div>
          <div>
            <label className="label">Owner</label>
            <select value={newSocialName} onChange={(e) => setNewSocialName(e.target.value)}>
              {SOCIAL_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px' }}
            onClick={handleAdd}
            disabled={adding || !newAccountId}
          >
            {adding ? '...' : 'Add'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">All Accounts ({accounts.length})</div>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="entries-table">
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} style={savedId === a.id ? { background: 'rgba(74,222,128,0.05)' } : undefined}>
                    <td style={{ fontFamily: 'ui-monospace, monospace' }}>{a.account_id_fb}</td>
                    <td>
                      <select
                        value={a.social_name || 'unknown'}
                        onChange={(e) => updateField(a.id, 'social_name', e.target.value)}
                        style={{ padding: '4px 8px', minWidth: 130 }}
                      >
                        {SOCIAL_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={a.status}
                        onChange={(e) => updateField(a.id, 'status', e.target.value)}
                        style={{
                          padding: '4px 8px',
                          minWidth: 100,
                          color:
                            a.status === 'active' ? '#4ade80' :
                            a.status === 'banned' ? '#ef4444' :
                            a.status === 'paused' ? '#fbbf24' :
                            'inherit',
                        }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(a.id, a.account_id_fb)}
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
          Changes save automatically. Only <strong>active</strong> accounts are used by n8n workflows.
        </p>
      </div>
    </>
  );
}
