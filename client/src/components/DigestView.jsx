import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Cpu, Bitcoin, Briefcase, Globe, Trophy,
  Zap, BarChart3, RefreshCw, Newspaper, Image, Info,
  Sparkles, Heart, Leaf, Shirt, Palette, HeartPulse, Rocket,
} from 'lucide-react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

const categoryIcons = {
  finance: TrendingUp,
  tech: Cpu,
  crypto: Bitcoin,
  business: Briefcase,
  news: Globe,
  sports: Trophy,
  lifestyle: Sparkles,
  wellness: Leaf,
  fashion: Shirt,
  culture: Palette,
  health: HeartPulse,
  career: Rocket,
};

const categoryColors = {
  finance: '#10b981',
  tech: '#6366f1',
  crypto: '#f59e0b',
  business: '#3b82f6',
  news: '#8b5cf6',
  sports: '#ef4444',
  lifestyle: '#ec4899',
  wellness: '#22c55e',
  fashion: '#a855f7',
  culture: '#f97316',
  health: '#14b8a6',
  career: '#6366f1',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function VisualCard({ visual }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const hasImage = visual.imageUrl && !imgFailed;
  return (
    <div className={`visual-card ${!hasImage ? 'visual-card-no-img' : ''}`}>
      {hasImage && (
        <img
          src={visual.imageUrl}
          alt={visual.description}
          className="visual-img"
          onError={() => setImgFailed(true)}
        />
      )}
      {!hasImage && (
        <div className="visual-placeholder">
          <Image size={28} />
        </div>
      )}
      <div className="visual-body">
        <p className="visual-desc">{visual.description}</p>
        <span className="visual-source">{visual.source}</span>
      </div>
    </div>
  );
}

// ─── Goodie/Baddie rating widget ──────────────────────────────

function StoryRating({ story, digestId, token }) {
  const [rating, setRating] = useState(null);        // 'up' | 'down' | null
  const [confirm, setConfirm] = useState(null);      // brief confirmation text
  const [loading, setLoading] = useState(false);

  const TOOLTIP_TEXT = "Ratings help us learn what's relevant to you AND what's well-written — both signals improve your next digest.";

  const handleRate = async (value) => {
    if (loading) return;
    // Toggle off if tapping same button again
    const next = rating === value ? null : value;
    setRating(next);
    setLoading(true);

    if (next === 'up') setConfirm('Goodie logged! 🎉');
    else if (next === 'down') setConfirm('Baddie noted. 👎');
    else setConfirm('Rating removed.');

    setTimeout(() => setConfirm(null), 2500);

    try {
      await fetch(`${API}/api/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          story_id: story.story_id,
          digest_id: digestId,
          rating: next,
          story_topic: story.category || null,
          story_source: story.source || null,
        }),
      });
    } catch (err) {
      console.error('Rating error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="story-rating">
      <div className="story-rating-label">
        <span>Goodie or Baddie?</span>
        <div className="rating-tooltip-wrap">
          <Info size={13} className="rating-info-icon" />
          <div className="rating-tooltip">{TOOLTIP_TEXT}</div>
        </div>
      </div>
      <div className="rating-buttons">
        <button
          className={`rating-btn goodie ${rating === 'up' ? 'active' : ''}`}
          onClick={() => handleRate('up')}
          disabled={loading}
          title="Goodie"
        >
          👍 Goodie
        </button>
        <button
          className={`rating-btn baddie ${rating === 'down' ? 'active' : ''}`}
          onClick={() => handleRate('down')}
          disabled={loading}
          title="Baddie"
        >
          👎 Baddie
        </button>
      </div>
      {confirm && <div className="rating-confirm">{confirm}</div>}
    </div>
  );
}

// ─── Training banner ──────────────────────────────────────────

function TrainingBanner() {
  return (
    <div className="training-banner">
      <span className="training-banner-icon">⚠️</span>
      <span className="training-banner-text">
        Rate each story to get smarter digests! Your Goodies &amp; Baddies train your recommendation engine.
      </span>
      <span className="training-banner-icon">⚠️</span>
    </div>
  );
}

// ─── Main DigestView ──────────────────────────────────────────

export default function DigestView({ digest, onFetch, fetching, hasSources, token }) {
  // Load existing ratings for this digest so buttons restore on page reload
  const [ratings, setRatings] = useState({});

  useEffect(() => {
    if (!digest?.id || !token) return;
    fetch(`${API}/api/rate/digest/${digest.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(map => setRatings(map))
      .catch(() => {});
  }, [digest?.id, token]);

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

  const flavor = content.flavor || digest.flavor || document.documentElement.getAttribute('data-flavor') || 'digestino';
  const editionName = flavor === 'digestina' ? "Today's Digestina" : "Today's Digestino";

  // Merge server-loaded ratings into local component state for story widgets
  const mergeRating = (storyId, localRating) => localRating ?? ratings[storyId] ?? null;

  return (
    <div className="digest-page">
      {/* Training banner */}
      <TrainingBanner />

      {/* Digest Header */}
      <div className="digest-header">
        <div className="digest-date">{formatDate(content.date || digest.date)}</div>
        <h2 className="digest-title">{editionName}</h2>
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
                <article key={story.story_id || i} className="story-card">
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
                  {story.story_id && (
                    <StoryRating
                      key={story.story_id}
                      story={{ ...story, _initialRating: ratings[story.story_id] }}
                      digestId={digest.id}
                      token={token}
                    />
                  )}
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
              <VisualCard key={i} visual={visual} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
