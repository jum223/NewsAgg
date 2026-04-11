import React from 'react';
import {
  TrendingUp, Cpu, Bitcoin, Briefcase, Globe, Trophy,
  Zap, BarChart3, RefreshCw, Newspaper, Image
} from 'lucide-react';

const categoryIcons = {
  finance: TrendingUp,
  tech: Cpu,
  crypto: Bitcoin,
  business: Briefcase,
  news: Globe,
  sports: Trophy,
};

const categoryColors = {
  finance: '#10b981',
  tech: '#6366f1',
  crypto: '#f59e0b',
  business: '#3b82f6',
  news: '#8b5cf6',
  sports: '#ef4444',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function DigestView({ digest, onFetch, fetching, hasSources }) {
  if (!digest || !digest.content) {
    return (
      <div className="digest-page">
        <div className="empty-state">
          <Newspaper size={56} />
          <h3>No digest yet</h3>
          <p>
            {hasSources
              ? "Hit the Refresh button to fetch and curate today's newsletters."
              : "Add some newsletter sources first, then we'll create your daily digest."
            }
          </p>
          {hasSources && (
            <button className="btn btn-primary" onClick={onFetch} disabled={fetching}>
              <RefreshCw size={16} className={fetching ? 'spin' : ''} />
              {fetching ? 'Curating your digest...' : 'Create Today\'s Digest'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { content } = digest;
  const { topStories = [], quickHits = [], visuals = [], digestSummary, sourcesUsed = [] } = content;

  return (
    <div className="digest-page">
      {/* Digest Header */}
      <div className="digest-header">
        <div className="digest-date">{formatDate(content.date || digest.date)}</div>
        <h2 className="digest-title">Your Daily Digest</h2>
        {digestSummary && <p className="digest-summary">{digestSummary}</p>}
        <div className="digest-sources-bar">
          Curated from: {sourcesUsed.map(s => s.name).join(' · ')}
        </div>
      </div>

      {/* Top Stories */}
      {topStories.length > 0 && (
        <section className="digest-section">
          <h3 className="section-title">
            <Zap size={20} />
            Top Stories
          </h3>
          <div className="stories-grid">
            {topStories.map((story, i) => {
              const Icon = categoryIcons[story.category] || Globe;
              const color = categoryColors[story.category] || '#6b7280';
              return (
                <article key={i} className="story-card">
                  <div className="story-category" style={{ color }}>
                    <Icon size={14} />
                    <span>{story.category}</span>
                  </div>
                  <h4 className="story-headline">{story.headline}</h4>
                  <p className="story-text">{story.summary}</p>
                  <div className="story-source">
                    <span className="source-dot" style={{ background: color }} />
                    {story.source}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Hits */}
      {quickHits.length > 0 && (
        <section className="digest-section">
          <h3 className="section-title">
            <BarChart3 size={20} />
            Quick Hits
          </h3>
          <div className="quick-hits">
            {quickHits.map((hit, i) => (
              <div key={i} className="quick-hit">
                <span className="hit-bullet">{i + 1}</span>
                <div>
                  <p className="hit-text">{hit.text}</p>
                  <span className="hit-source">{hit.source}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Visuals */}
      {visuals.length > 0 && (
        <section className="digest-section">
          <h3 className="section-title">
            <Image size={20} />
            Charts & Visuals
          </h3>
          <div className="visuals-grid">
            {visuals.map((visual, i) => (
              <div key={i} className="visual-card">
                {visual.imageUrl && (
                  <img
                    src={visual.imageUrl}
                    alt={visual.description}
                    className="visual-img"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <p className="visual-desc">{visual.description}</p>
                <span className="visual-source">{visual.source}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
