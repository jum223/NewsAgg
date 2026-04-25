import React, { useState } from 'react';
import { Clock, Save, CheckCircle, LogOut, Sparkles, AlertTriangle, RefreshCw, Mail, WifiOff } from 'lucide-react';

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
  const [reconnecting, setReconnecting] = useState(false);
  const [emailUnsubscribed, setEmailUnsubscribed] = useState(!!user.email_unsubscribed);
  const [togglingEmail, setTogglingEmail] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);

  const handleReconnectGmail = async () => {
    setReconnecting(true);
    try {
      const res = await fetch(`${API}/auth/google/reconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error('Reconnect error:', err);
      setReconnecting(false);
    }
  };

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

  const handleToggleEmail = async () => {
    setTogglingEmail(true);
    try {
      const newVal = !emailUnsubscribed;
      const res = await fetch(`${API}/api/settings/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ unsubscribed: newVal }),
      });
      if (res.ok) {
        setEmailUnsubscribed(newVal);
        onUserUpdate({ email_unsubscribed: newVal });
      }
    } catch (err) {
      console.error('Email toggle error:', err);
    } finally {
      setTogglingEmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`${API}/api/settings/disconnect-gmail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onUserUpdate({ gmail_connected: false, gmail_token_invalid: false });
        setDisconnectConfirm(false);
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const gmailConnected = user.gmail_connected && !user.gmail_token_invalid;

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

      {/* Email Notifications */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          <Mail size={18} />
          Email Notifications
        </h3>
        <p className="settings-desc">
          Control whether you receive your daily digest by email. You can always read it in the app regardless.
        </p>
        <div className="settings-toggle-row">
          <div>
            <div className="settings-toggle-label">Daily digest emails</div>
            <div className="settings-toggle-sub">
              {emailUnsubscribed ? 'Emails are paused — digest is still generated in the app.' : 'You receive an email each day at your scheduled time.'}
            </div>
          </div>
          <button
            className={`settings-toggle-switch ${emailUnsubscribed ? '' : 'on'}`}
            onClick={handleToggleEmail}
            disabled={togglingEmail}
            aria-label="Toggle email notifications"
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>
      </div>

      {/* Account */}
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
          <span className="settings-label">Gmail</span>
          {user.gmail_token_invalid ? (
            <span className="settings-badge disconnected">Token expired</span>
          ) : (
            <span className={`settings-badge ${user.gmail_connected ? 'connected' : 'disconnected'}`}>
              {user.gmail_connected ? 'Connected' : 'Not connected'}
            </span>
          )}
        </div>

        {user.gmail_token_invalid && (
          <div className="gmail-reconnect-alert">
            <AlertTriangle size={16} className="gmail-reconnect-alert-icon" />
            <div>
              <strong>Gmail access expired.</strong> Your daily digest stopped working because Google revoked access to your inbox. This happens after long inactivity or a password change.
            </div>
            <button
              className="btn btn-primary gmail-reconnect-btn"
              onClick={handleReconnectGmail}
              disabled={reconnecting}
            >
              <RefreshCw size={15} className={reconnecting ? 'spin' : ''} />
              {reconnecting ? 'Redirecting...' : 'Reconnect Gmail'}
            </button>
          </div>
        )}

        {gmailConnected && (
          <div style={{ marginTop: 16 }}>
            {!disconnectConfirm ? (
              <button
                className="btn btn-secondary-danger"
                onClick={() => setDisconnectConfirm(true)}
              >
                <WifiOff size={15} />
                Disconnect Gmail
              </button>
            ) : (
              <div className="disconnect-confirm">
                <p>This will revoke the app's access to your Gmail. Your digest will stop working until you reconnect. Are you sure?</p>
                <div className="disconnect-confirm-actions">
                  <button
                    className="btn btn-danger"
                    onClick={handleDisconnectGmail}
                    disabled={disconnecting}
                  >
                    {disconnecting ? 'Disconnecting...' : 'Yes, disconnect'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setDisconnectConfirm(false)}
                    disabled={disconnecting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
