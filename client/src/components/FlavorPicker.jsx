import React, { useState } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

const DIGESTINO_SOURCES = [
  { name: 'Morning Brew', email: 'crew@morningbrew.com' },
  { name: 'The Hustle', email: 'thehustle@thehustle.co' },
  { name: 'Axios Markets', email: 'axios@axios.com' },
  { name: 'Milk Road (Crypto)', email: 'hello@milkroad.com' },
  { name: 'Tifo Football', email: 'newsletter@tifoillustr8d.com' },
];

const DIGESTINA_SOURCES = [
  { name: 'The Skimm', email: 'theskimm@theskimm.com' },
  { name: 'Well+Good', email: 'newsletter@wellandgood.com' },
  { name: 'Refinery29', email: 'newsletter@refinery29.com' },
  { name: 'Who What Wear', email: 'newsletter@whowhatwear.com' },
  { name: 'CNBC Make It', email: 'makeit@cnbc.com' },
];

export default function FlavorPicker({ user, token, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ flavor: selected }),
      });
      onComplete(selected);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const suggestions = selected === 'digestina' ? DIGESTINA_SOURCES : DIGESTINO_SOURCES;

  return (
    <div className="flavor-picker-overlay">
      <div className="flavor-picker-card">
        <div className="flavor-picker-welcome">
          <span className="flavor-picker-hi">Hi {user.name.split(' ')[0]} 👋</span>
          <h1 className="flavor-picker-title">Choose your edition</h1>
          <p className="flavor-picker-subtitle">
            Pick the experience that's made for you. You can always switch later in Settings.
          </p>
        </div>

        <div className="flavor-options">
          {/* Digestino */}
          <button
            className={`flavor-option digestino-option ${selected === 'digestino' ? 'selected' : ''}`}
            onClick={() => setSelected('digestino')}
          >
            <div className="flavor-option-icon">
              <svg viewBox="0 0 44 44" width="44" height="44">
                <circle cx="22" cy="22" r="22" fill="#c2410c" />
                <rect x="10" y="13" width="24" height="18" rx="2" fill="white" opacity="0.9" />
                <rect x="13" y="17" width="18" height="2.5" rx="1" fill="#c2410c" />
                <rect x="13" y="21.5" width="14" height="1.5" rx="0.75" fill="#c2410c" opacity="0.5" />
                <rect x="13" y="24.5" width="16" height="1.5" rx="0.75" fill="#c2410c" opacity="0.5" />
              </svg>
            </div>
            <div className="flavor-option-text">
              <span className="flavor-option-name digestino-name">
                <em>The</em> Digestino
              </span>
              <span className="flavor-option-tagline">For him</span>
              <p className="flavor-option-desc">
                Finance, tech, crypto, sports, and business. Direct, data-driven, no fluff.
              </p>
            </div>
            <div className="flavor-option-check">
              {selected === 'digestino' && (
                <svg viewBox="0 0 20 20" width="20" height="20" fill="#c2410c">
                  <circle cx="10" cy="10" r="10" />
                  <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </div>
          </button>

          {/* Digestina */}
          <button
            className={`flavor-option digestina-option ${selected === 'digestina' ? 'selected' : ''}`}
            onClick={() => setSelected('digestina')}
          >
            <div className="flavor-option-icon">
              <svg viewBox="0 0 44 44" width="44" height="44">
                <circle cx="22" cy="22" r="22" fill="#be185d" />
                <rect x="10" y="13" width="24" height="18" rx="2" fill="white" opacity="0.9" />
                <rect x="13" y="17" width="18" height="2.5" rx="1" fill="#be185d" />
                <rect x="13" y="21.5" width="14" height="1.5" rx="0.75" fill="#be185d" opacity="0.5" />
                <rect x="13" y="24.5" width="16" height="1.5" rx="0.75" fill="#be185d" opacity="0.5" />
              </svg>
            </div>
            <div className="flavor-option-text">
              <span className="flavor-option-name digestina-name">
                <em>The</em> Digestina
              </span>
              <span className="flavor-option-tagline">For her</span>
              <p className="flavor-option-desc">
                Lifestyle, wellness, fashion, culture, and career. Warm, conversational, and smart.
              </p>
            </div>
            <div className="flavor-option-check">
              {selected === 'digestina' && (
                <svg viewBox="0 0 20 20" width="20" height="20" fill="#be185d">
                  <circle cx="10" cy="10" r="10" />
                  <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </div>
          </button>
        </div>

        {selected && (
          <div className="flavor-suggestions">
            <p className="flavor-suggestions-label">
              Popular newsletters to get you started:
            </p>
            <div className="flavor-suggestions-list">
              {suggestions.map(s => (
                <span key={s.email} className={`flavor-suggestion-chip ${selected}`}>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          className={`flavor-confirm-btn ${selected ? selected : ''}`}
          onClick={handleConfirm}
          disabled={!selected || saving}
        >
          {saving ? 'Setting up your edition...' : selected
            ? `Start with ${selected === 'digestina' ? 'The Digestina' : 'The Digestino'} →`
            : 'Choose an edition to continue'}
        </button>
      </div>
    </div>
  );
}
