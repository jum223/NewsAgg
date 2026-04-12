import React, { useState, useEffect } from 'react';
import { Ticket, Plus, Users, Copy, CheckCircle } from 'lucide-react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

export default function AdminPanel({ token }) {
  const [invites, setInvites] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/invites`, { headers }).then(r => r.json()),
      fetch(`${API}/api/admin/users`, { headers }).then(r => r.json()),
    ]).then(([inv, usr]) => {
      setInvites(inv);
      setUsers(usr);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/invites`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      // Refresh invite list
      const inv = await fetch(`${API}/api/invites`, { headers }).then(r => r.json());
      setInvites(inv);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return <div className="admin-page"><div className="loader" /></div>;
  }

  const unusedInvites = invites.filter(i => !i.used_by);
  const usedInvites = invites.filter(i => i.used_by);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>Admin Panel</h2>
        <p>Manage invite codes and view registered users.</p>
      </div>

      {/* Invite Codes */}
      <div className="admin-section">
        <div className="admin-section-header">
          <h3><Ticket size={18} /> Invite Codes</h3>
          <button className="btn btn-primary btn-sm" onClick={generateCode} disabled={generating}>
            <Plus size={14} />
            {generating ? 'Generating...' : 'Generate Code'}
          </button>
        </div>

        {unusedInvites.length > 0 && (
          <div className="invite-list">
            <div className="invite-list-label">Available</div>
            {unusedInvites.map(inv => (
              <div key={inv.id} className="invite-row">
                <code className="invite-code-display">{inv.code}</code>
                <button
                  className="btn-icon"
                  onClick={() => copyCode(inv.code)}
                  title="Copy code"
                >
                  {copied === inv.code ? <CheckCircle size={14} /> : <Copy size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}

        {usedInvites.length > 0 && (
          <div className="invite-list used">
            <div className="invite-list-label">Used</div>
            {usedInvites.map(inv => (
              <div key={inv.id} className="invite-row used">
                <code className="invite-code-display">{inv.code}</code>
                <span className="invite-used-by">
                  {inv.used_by_email || 'Unknown'}
                </span>
              </div>
            ))}
          </div>
        )}

        {invites.length === 0 && (
          <p className="admin-empty">No invite codes yet. Generate one to invite a new user.</p>
        )}
      </div>

      {/* Users */}
      <div className="admin-section">
        <div className="admin-section-header">
          <h3><Users size={18} /> Registered Users ({users.length})</h3>
        </div>
        <div className="user-list">
          {users.map(u => (
            <div key={u.id} className="user-row">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="user-avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="user-avatar-placeholder">{u.name.charAt(0)}</div>
              )}
              <div className="user-info">
                <span className="user-name">
                  {u.name}
                  {u.is_admin ? <span className="admin-badge">Admin</span> : null}
                </span>
                <span className="user-email">{u.email}</span>
              </div>
              <span className="user-joined">
                Joined {new Date(u.created_at + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
