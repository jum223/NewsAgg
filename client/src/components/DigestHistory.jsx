import React, { useState, useEffect } from 'react';
import { Clock, ChevronRight, RefreshCw, Layers, ThumbsUp, ThumbsDown, Star } from 'lucide-react';
import DigestView from './DigestView';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function parseUtcDatetime(str) {
  if (!str) return new Date();
  return new Date(str.replace(' ', 'T') + (str.includes('Z') ? '' : 'Z'));
}

function formatTime(str) {
  return parseUtcDatetime(str).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/New_York',
  });
}

function formatRelativeDate(str) {
  const d = parseUtcDatetime(str);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Ratings View ─────────────────────────────────────────────

function RatingsView({ token }) {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'up' | 'down'

  useEffect(() => {
    fetch(`${API}/api/ratings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setRatings(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const filtered = filter === 'all' ? ratings : ratings.filter(r => r.rating === filter);

  const goodies = ratings.filter(r => r.rating === 'up').length;
  const baddies = ratings.filter(r => r.rating === 'down').length;

  if (loading) return <div className="history-page"><div className="loader" /></div>;

  return (
    <div className="ratings-history">
      {/* Summary row */}
      <div className="ratings-summary">
        <div className="ratings-summary-stat">
          <ThumbsUp size={18} className="ratings-stat-icon up" />
          <span className="ratings-stat-num">{goodies}</span>
          <span className="ratings-stat-label">Goodies</span>
        </div>
        <div className="ratings-summary-divider" />
        <div className="ratings-summary-stat">
          <ThumbsDown size={18} className="ratings-stat-icon down" />
          <span className="ratings-stat-num">{baddies}</span>
          <span className="ratings-stat-label">Baddies</span>
        </div>
        <div className="ratings-summary-divider" />
        <div className="ratings-summary-stat">
          <Star size={18} className="ratings-stat-icon total" />
          <span className="ratings-stat-num">{ratings.length}</span>
          <span className="ratings-stat-label">Total</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="ratings-filter-row">
        {['all', 'up', 'down'].map(f => (
          <button
            key={f}
            className={`ratings-filter-pill ${filter === f ? 'active' : ''} ${f}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'up' ? '👍 Goodies' : '👎 Baddies'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state subtle">
          <Star size={40} />
          <h3>{filter === 'all' ? 'No ratings yet' : `No ${filter === 'up' ? 'Goodies' : 'Baddies'} yet`}</h3>
          <p>Rate stories in your digest to see them here.</p>
        </div>
      ) : (
        <div className="ratings-list">
          {filtered.map((r, i) => (
            <div key={`${r.story_id}-${i}`} className={`rating-history-item ${r.rating}`}>
              <div className={`rating-history-badge ${r.rating}`}>
                {r.rating === 'up' ? '👍' : '👎'}
              </div>
              <div className="rating-history-body">
                <div className="rating-history-headline">
                  {r.story_headline || <span className="rating-history-no-title">Story</span>}
                </div>
                <div className="rating-history-meta">
                  {r.story_source && (
                    <span className="rating-history-source">{r.story_source}</span>
                  )}
                  {r.story_topic && (
                    <span className="rating-history-topic">{r.story_topic}</span>
                  )}
                  <span className="rating-history-date">{formatRelativeDate(r.rated_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main DigestHistory component ────────────────────────────

export default function DigestHistory({ token }) {
  const [tab, setTab] = useState('digests'); // 'digests' | 'ratings'

  // ── Digest list state ──
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

  const grouped = allDigests.reduce((acc, d) => {
    if (!acc[d.date]) acc[d.date] = [];
    acc[d.date].push(d);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const openDate = async (date) => {
    setSelectedDate(date);
    const latest = grouped[date][0];
    setSelectedId(latest.id);
    await loadDigest(latest.id);
  };

  const loadDigest = async (id) => {
    setLoadingDigest(true);
    setSelectedId(id);
    try {
      const res = await fetch(`${API}/api/newsletters/${id}`, { headers });
      setSelectedDigest(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoadingDigest(false); }
  };

  const goBack = () => {
    setSelectedDate(null);
    setSelectedId(null);
    setSelectedDigest(null);
  };

  // ── Digest detail view ─────────────────────────────────────
  if (selectedDate) {
    const versions = grouped[selectedDate] || [];
    return (
      <div className="history-detail">
        <button className="btn btn-ghost back-btn" onClick={goBack}>
          ← Back to history
        </button>
        <div className="history-detail-inner">
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
          <div className="version-content">
            {loadingDigest ? (
              <div className="empty-state subtle"><div className="loader" /></div>
            ) : (
              <DigestView digest={selectedDigest} token={token} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Tab list view ──────────────────────────────────────────
  return (
    <div className="history-page">
      <div className="history-header">
        <h2>History</h2>
        <p>Your past digests and story ratings.</p>
      </div>

      {/* Tab toggle */}
      <div className="history-tabs">
        <button
          className={`history-tab ${tab === 'digests' ? 'active' : ''}`}
          onClick={() => setTab('digests')}
        >
          <Clock size={15} />
          Digests
        </button>
        <button
          className={`history-tab ${tab === 'ratings' ? 'active' : ''}`}
          onClick={() => setTab('ratings')}
        >
          <ThumbsUp size={15} />
          Ratings
        </button>
      </div>

      {/* ── Digests tab ── */}
      {tab === 'digests' && (
        loading ? (
          <div className="loader" style={{ margin: '48px auto' }} />
        ) : sortedDates.length === 0 ? (
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
        )
      )}

      {/* ── Ratings tab ── */}
      {tab === 'ratings' && <RatingsView token={token} />}
    </div>
  );
}
