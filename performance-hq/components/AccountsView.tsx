'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, Account } from '@/lib/supabase';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(74,222,128,0.12)', text: '#4ade80', label: 'Active' },
  banned: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: 'Banned' },
  deleted: { bg: 'rgba(120,120,120,0.12)', text: '#888', label: 'Deleted' },
  paused: { bg: 'rgba(212,160,23,0.12)', text: '#d4a017', label: 'Paused' },
};

const STATUS_CYCLE = ['active', 'paused', 'banned', 'deleted'];

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

export default function AccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [newAccountId, setNewAccountId] = useState('');
  const [newSocialName, setNewSocialName] = useState('');
  const [newStatus, setNewStatus] = useState('active');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false });
    setAccounts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const inFields = [a.account_id_fb, a.social_name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
        if (!inFields) return false;
      }
      return true;
    });
  }, [accounts, filterStatus, search]);

  const counts = useMemo(() => {
    return {
      all: accounts.length,
      active: accounts.filter((a) => a.status === 'active').length,
      paused: accounts.filter((a) => a.status === 'paused').length,
      banned: accounts.filter((a) => a.status === 'banned').length,
      deleted: accounts.filter((a) => a.status === 'deleted').length,
    };
  }, [accounts]);

  const cycleStatus = async (acc: Account) => {
    const currentIdx = STATUS_CYCLE.indexOf(acc.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    await supabase.from('accounts').update({ status: nextStatus }).eq('id', acc.id);
    load();
  };

  const handleDelete = async (acc: Account) => {
    if (!confirm(`Полностью удалить аккаунт ${acc.account_id_fb} (${acc.social_name || '—'}) из базы?\n\nЭто навсегда. Если просто не нужен в синхроне — лучше поставь статус "deleted".`)) return;
    await supabase.from('accounts').delete().eq('id', acc.id);
    load();
  };

  const handleAdd = async () => {
    setAddError(null);
    if (!newAccountId.trim()) {
      setAddError('Account ID is required');
      return;
    }
    // Очищаем от act_ префикса если есть
    const cleanId = newAccountId.trim().replace(/^act_/, '');

    setAdding(true);
    const { error } = await supabase.from('accounts').insert({
      account_id_fb: cleanId,
      social_name: newSocialName.trim() || null,
      status: newStatus,
    });

    if (error) {
      setAddError(error.message);
      setAdding(false);
      return;
    }

    setNewAccountId('');
    setNewSocialName('');
    setNewStatus('active');
    setShowAdd(false);
    setAdding(false);
    load();
  };

  return (
    <>
      {/* Сводка */}
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Total</div>
          <div className="stat-value">{counts.all}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active</div>
          <div className="stat-value profit-positive">{counts.active}</div>
          <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>в синхроне</div>
        </div>
        <div className="stat">
          <div className="stat-label">Paused / Banned</div>
          <div className="stat-value">{counts.paused + counts.banned}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Deleted</div>
          <div className="stat-value muted">{counts.deleted}</div>
        </div>
      </div>

      {/* Контролы */}
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Search by FB ID or social name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '8px 12px' }}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: 'auto', padding: '8px 12px' }}
          >
            <option value="all">All status ({counts.all})</option>
            <option value="active">Active ({counts.active})</option>
            <option value="paused">Paused ({counts.paused})</option>
            <option value="banned">Banned ({counts.banned})</option>
            <option value="deleted">Deleted ({counts.deleted})</option>
          </select>

          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px' }}
            onClick={() => setShowAdd(!showAdd)}
          >
            {showAdd ? '✕ Cancel' : '+ Add Account'}
          </button>
        </div>

        {/* Форма добавления */}
        {showAdd && (
          <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 150px auto', gap: 10, alignItems: 'end' }}>
              <div>
                <label className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                  FB Account ID (без act_)
                </label>
                <input
                  type="text"
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                  placeholder="2802178210159752"
                  style={{ fontFamily: 'ui-monospace, monospace', padding: '8px 12px' }}
                />
              </div>
              <div>
                <label className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                  Social Profile
                </label>
                <input
                  type="text"
                  value={newSocialName}
                  onChange={(e) => setNewSocialName(e.target.value)}
                  placeholder="Yan Cuprin, Юлия Янчук..."
                  style={{ padding: '8px 12px' }}
                />
              </div>
              <div>
                <label className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                  Status
                </label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ padding: '8px 12px' }}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="banned">Banned</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>
              <button
                className="btn-primary"
                onClick={handleAdd}
                disabled={adding}
                style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
              >
                {adding ? '...' : 'Add'}
              </button>
            </div>
            {addError && <div className="alert alert-error" style={{ marginTop: 10 }}>{addError}</div>}
          </div>
        )}
      </div>

      {/* Список */}
      <div className="card">
        <div className="card-title">
          Accounts ({filtered.length}{filtered.length !== accounts.length ? ` / ${accounts.length}` : ''})
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="muted">
            {accounts.length === 0
              ? 'No accounts yet. Add your first FB ad account.'
              : 'No accounts match the current filters.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="entries-table">
              <thead>
                <tr>
                  <th>FB Account ID</th>
                  <th>Social Profile</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const statusInfo = STATUS_COLORS[a.status] || STATUS_COLORS.deleted;
                  return (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                        <span style={{ color: '#d4a017' }}>act_{a.account_id_fb}</span>
                        <CopyButton value={`act_${a.account_id_fb}`} />
                      </td>
                      <td>{a.social_name || <span className="muted">—</span>}</td>
                      <td>
                        <button
                          onClick={() => cycleStatus(a)}
                          title="Click to change status"
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            background: statusInfo.bg,
                            color: statusInfo.text,
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          {statusInfo.label}
                        </button>
                      </td>
                      <td className="muted" style={{ fontSize: 11 }}>
                        {new Date(a.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                        })}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(a)}
                          title="Permanently delete"
                          style={{ padding: '4px 8px', opacity: 0.5, fontSize: 13 }}
                        >
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

        <p className="muted" style={{ fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
          💡 <strong>Клик на статус</strong> — циклически переключает: Active → Paused → Banned → Deleted. Только аккаунты со статусом <strong>active</strong> попадают в auto-import. <strong>🗑</strong> — полное удаление из БД (необратимо, лучше используй статус "deleted").
        </p>
      </div>
    </>
  );
}
