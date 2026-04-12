import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, ChevronRight, TrendingUp, Cpu, Bitcoin, Briefcase, Globe, Star } from 'lucide-react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

const categoryIcons = {
  finance: TrendingUp, tech: Cpu, crypto: Bitcoin,
  business: Briefcase, news: Globe, sports: Trophy,
};
const categoryColors = {
  finance: '#10b981', tech: '#6366f1', crypto: '#f59e0b',
  business: '#3b82f6', news: '#8b5cf6', sports: '#ef4444',
};
const rankLabel = ['', '🥇', '🥈', '🥉', '4', '5'];

function parseUtc(str) {
  if (!str) return new Date();
  return new Date(str.replace(' ', 'T') + 'Z');
}

function formatWeekRange(start, end) {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(ey, em - 1, ed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

// ── Weekly Digest Detail ─────────────────────────────────────────
function WeeklyDetail({ digest, onBack }) {
  const { content } = digest;
  const { weekOf, weekSummary, topStories = [] } = content;

  return (
    <div className="weekly-detail">
      {onBack && (
        <button className="btn btn-ghost back-btn" onClick={onBack}>← Back</button>
      )}

      <div className="weekly-header">
        <div className="weekly-badge">Week in Review</div>
        <div className="weekly-range">{weekOf || formatWeekRange(digest.week_start, digest.week_end)}</div>
        <h2 className="weekly-title">The 5 Stories That Mattered</h2>
        {weekSummary && <p className="weekly-summary">{weekSummary}</p>}
      </div>

      <div className="weekly-stories">
        {topStories.map((story, i) => {
          const Icon = categoryIcons[story.category] || Globe;
          const color = categoryColors[story.category] || '#6b7280';
          return (
            <article key={i} className="weekly-story-card" style={{ borderLeftColor: color }}>
              <div className="weekly-story-rank">{rankLabel[story.rank || i + 1] || `${i + 1}`}</div>
              <div className="weekly-story-body">
                <div className="story-category" style={{ color }}>
                  <Icon size={13} />
                  <span>{story.category}</span>
                </div>
                <h3 className="weekly-story-headline">{story.headline}</h3>
                <p className="weekly-why">{story.whyItMatters}</p>
                {story.sources?.length > 0 && (
                  <div className="weekly-sources">
                    Covered by: {story.sources.join(' · ')}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Weekly View ─────────────────────────────────────────────
export default function WeeklyDigestView() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/weekly/latest`).then(r => r.json()),
      fetch(`${API}/api/weekly/history`).then(r => r.json()),
    ]).then(([lat, hist]) => {
      setLatest(lat);
      setHistory(hist);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/weekly/generate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Reload latest
      const updated = await fetch(`${API}/api/weekly/latest`).then(r => r.json());
      setLatest(updated);
      const updatedHistory = await fetch(`${API}/api/weekly/history`).then(r => r.json());
      setHistory(updatedHistory);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const openHistory = async (id) => {
    const res = await fetch(`${API}/api/weekly/${id}`);
    const data = await res.json();
    setSelected(data);
  };

  if (selected) {
    return <WeeklyDetail digest={selected} onBack={() => setSelected(null)} />;
  }

  if (loading) {
    return <div className="weekly-page"><div className="loader" /></div>;
  }

  return (
    <div className="weekly-page">
      <div className="weekly-page-header">
        <div>
          <h2>Week in Review</h2>
          <p>The 5 most important stories from each week, auto-generated every Sunday at 9 AM ET.</p>
        </div>
        <button className="btn btn-weekly" onClick={generate} disabled={generating}>
          <RefreshCw size={15} className={generating ? 'spin' : ''} />
          {generating ? 'Generating...' : 'Generate Now'}
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 20 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Latest weekly */}
      {latest?.content && (
        <div className="weekly-latest-wrapper">
          <div className="weekly-latest-label">
            <Star size={13} /> Latest
          </div>
          <WeeklyDetail digest={latest} />
        </div>
      )}

      {!latest?.content && (
        <div className="empty-state subtle">
          <Trophy size={44} />
          <h3>No weekly digest yet</h3>
          <p>Click "Generate Now" to synthesize this week's top stories from your daily digests, or wait for the automatic Sunday delivery.</p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="weekly-history">
          <h3 className="weekly-history-title">Past Weeks</h3>
          {history.slice(1).map(w => (
            <button key={w.id} className="history-item" onClick={() => openHistory(w.id)}>
              <div className="history-date">
                <Trophy size={15} />
                <span>{formatWeekRange(w.week_start, w.week_end)}</span>
              </div>
              <div className="history-right">
                <span className="history-time">
                  {parseUtc(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <ChevronRight size={16} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
