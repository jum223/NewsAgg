import React, { useState, useEffect } from 'react';
import { Clock, ChevronRight, RefreshCw, Layers } from 'lucide-react';
import DigestView from './DigestView';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

// Parse a YYYY-MM-DD string as local date (avoids UTC midnight off-by-one)
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

// Parse SQLite UTC datetime string to a Date object
function parseUtcDatetime(str) {
  if (!str) return new Date();
  return new Date(str.replace(' ', 'T') + 'Z');
}

function formatTime(str) {
  return parseUtcDatetime(str).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/New_York',
  });
}

export default function DigestHistory({ token }) {
  const [allDigests, setAllDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDigest, setSelectedDigest] = useState(null);
  const [loadingDigest, setLoadingDigest] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/newsletters/history`, { headers })
      .then(r => r.json())
      .then(data => { setAllDigests(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Group digests by date, each date sorted newest-first
  const grouped = allDigests.reduce((acc, d) => {
    if (!acc[d.date]) acc[d.date] = [];
    acc[d.date].push(d);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const openDate = async (date) => {
    setSelectedDate(date);
    const versions = grouped[date];
    const latest = versions[0];
    setSelectedId(latest.id);
    await loadDigest(latest.id);
  };

  const loadDigest = async (id) => {
    setLoadingDigest(true);
    setSelectedId(id);
    try {
      const res = await fetch(`${API}/api/newsletters/${id}`, { headers });
      const data = await res.json();
      setSelectedDigest(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDigest(false);
    }
  };

  const goBack = () => {
    setSelectedDate(null);
    setSelectedId(null);
    setSelectedDigest(null);
  };

  // ── Version detail view ──────────────────────────────────────
  if (selectedDate) {
    const versions = grouped[selectedDate] || [];
    return (
      <div className="history-detail">
        <button className="btn btn-ghost back-btn" onClick={goBack}>
          ← Back to history
        </button>

        <div className="history-detail-inner">
          {/* Version sidebar */}
          <aside className="version-sidebar">
            <div className="version-sidebar-title">
              <Layers size={14} />
              Versions
            </div>
            {versions.map((v, i) => (
              <button
                key={v.id}
                className={`version-btn ${selectedId === v.id ? 'active' : ''}`}
                onClick={() => loadDigest(v.id)}
              >
                <div className="version-label">
                  <span className="version-num">v{versions.length - i}</span>
                  <span className="version-time">{formatTime(v.created_at)}</span>
                </div>
                {i === 0 && <span className="version-latest-badge">latest</span>}
              </button>
            ))}
          </aside>

          {/* Digest content */}
          <div className="version-content">
            {loadingDigest ? (
              <div className="empty-state subtle">
                <div className="loader" />
              </div>
            ) : (
              <DigestView digest={selectedDigest} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Date list view ───────────────────────────────────────────
  if (loading) {
    return <div className="history-page"><div className="loader" /></div>;
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h2>Digest History</h2>
        <p>Browse your past curated newsletters.</p>
      </div>

      {sortedDates.length === 0 ? (
        <div className="empty-state subtle">
          <Clock size={40} />
          <h3>No history yet</h3>
          <p>Your curated digests will appear here after you create your first one.</p>
        </div>
      ) : (
        <div className="history-list">
          {sortedDates.map(date => {
            const versions = grouped[date];
            const latest = versions[0];
            return (
              <button key={date} className="history-item" onClick={() => openDate(date)}>
                <div className="history-date">
                  <Clock size={16} />
                  <span>{formatDay(date)}</span>
                </div>
                <div className="history-right">
                  {versions.length > 1 && (
                    <span className="version-count">
                      <RefreshCw size={11} />
                      {versions.length} versions
                    </span>
                  )}
                  <span className="history-time">Last at {formatTime(latest.created_at)}</span>
                  <ChevronRight size={18} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
