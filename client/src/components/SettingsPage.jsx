import React, { useState } from 'react';
import { Clock, Save, CheckCircle, LogOut, Sparkles } from 'lucide-react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const label = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
  return { value: i, label: `${label} ET` };
});

export default function SettingsPage({ user, token, onUserUpdate, onLogout }) {
  const [cronHour, setCronHour] = useState(user.daily_cron_hour ?? 20);
  const [flavor, setFlavor] = useState(user.flavor || 'digestino');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ daily_cron_hour: cronHour, flavor }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUserUpdate(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Settings save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Configure your Digestino preferences.</p>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">
          <Clock size={18} />
          Daily Digest Schedule
        </h3>
        <p className="settings-desc">
          Choose when you'd like your daily digest to be generated and emailed to you. All times are Eastern Time.
        </p>
        <select
          className="settings-select"
          value={cronHour}
          onChange={(e) => setCronHour(parseInt(e.target.value, 10))}
        >
          {HOURS.map(h => (
            <option key={h.value} value={h.value}>{h.label}</option>
          ))}
        </select>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">
          <Sparkles size={18} />
          Your Edition
        </h3>
        <p className="settings-desc">
          Switch between The Digestino and The Digestina at any time. Your sources and history stay the same — only the tone and look change.
        </p>
        <div className="flavor-toggle">
          <button
            className={`flavor-toggle-btn digestino-toggle ${flavor === 'digestino' ? 'active' : ''}`}
            onClick={() => setFlavor('digestino')}
          >
            <span className="flavor-toggle-dot digestino-dot" />
            The Digestino
          </button>
          <button
            className={`flavor-toggle-btn digestina-toggle ${flavor === 'digestina' ? 'active' : ''}`}
            onClick={() => setFlavor('digestina')}
          >
            <span className="flavor-toggle-dot digestina-dot" />
            The Digestina
          </button>
        </div>
      </div>

      <div className="settings-section settings-save-row">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || (cronHour === user.daily_cron_hour && flavor === user.flavor)}
        >
          {saved ? <><CheckCircle size={16} /> Saved</> : saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
        </button>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Account</h3>
        <div className="settings-account-card">
          {user.avatar_url && (
            <img src={user.avatar_url} alt="" className="settings-avatar" referrerPolicy="no-referrer" />
          )}
          <div className="settings-account-info">
            <span className="settings-name">{user.name}</span>
            <span className="settings-email">{user.email}</span>
          </div>
        </div>
        <div className="settings-row" style={{ marginTop: 16 }}>
          <span className="settings-label">Gmail connected</span>
          <span className={`settings-badge ${user.gmail_connected ? 'connected' : 'disconnected'}`}>
            {user.gmail_connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>

      <div className="settings-section settings-danger">
        <button className="btn btn-danger" onClick={onLogout}>
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
