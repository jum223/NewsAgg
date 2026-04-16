import React, { useState } from 'react';
import { Plus, Trash2, Mail, ExternalLink, Sparkles } from 'lucide-react';

const RECOMMENDATIONS = {
  digestino: [
    {
      name: 'Morning Brew',
      description: 'Daily business, finance & tech news — sharp and actually fun to read.',
      url: 'https://www.morningbrew.com',
      tag: 'Business · Tech',
    },
    {
      name: 'The Hustle',
      description: 'Business and tech stories with attitude. Millions of readers.',
      url: 'https://thehustle.co',
      tag: 'Business · Startups',
    },
    {
      name: 'Axios Markets',
      description: 'Concise market-moving news and economic analysis every morning.',
      url: 'https://www.axios.com/newsletters/axios-markets',
      tag: 'Finance · Markets',
    },
    {
      name: 'Milk Road',
      description: 'The #1 crypto newsletter — daily crypto & Web3 in plain English.',
      url: 'https://www.milkroad.com',
      tag: 'Crypto · Web3',
    },
    {
      name: 'The Daily Upside',
      description: 'Intelligent finance and investing news without the Wall Street spin.',
      url: 'https://www.thedailyupside.com',
      tag: 'Finance · Investing',
    },
  ],
  digestina: [
    {
      name: 'The Skimm',
      description: 'The newsletter that makes it easier to be smarter — 7M+ subscribers.',
      url: 'https://www.theskimm.com',
      tag: 'News · Lifestyle',
    },
    {
      name: 'Well+Good',
      description: 'Wellness trends, healthy living tips, and expert-backed advice.',
      url: 'https://www.wellandgood.com/newsletters',
      tag: 'Wellness · Health',
    },
    {
      name: 'Refinery29',
      description: 'Fashion, culture, and real-life stories for modern women.',
      url: 'https://www.refinery29.com/en-us/newsletter-sign-up',
      tag: 'Fashion · Culture',
    },
    {
      name: 'Who What Wear',
      description: 'Daily style inspiration, trend reports, and shopping picks.',
      url: 'https://www.whowhatwear.com',
      tag: 'Fashion · Style',
    },
    {
      name: 'CNBC Make It',
      description: 'Career growth, money moves, and financial wellness made actionable.',
      url: 'https://www.cnbc.com/makeitnewsletter',
      tag: 'Career · Finance',
    },
  ],
};

export default function SourceManager({ sources, onAdd, onRemove }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const flavor = document.documentElement.getAttribute('data-flavor') || 'digestino';
  const recommendations = RECOMMENDATIONS[flavor] || RECOMMENDATIONS.digestino;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    const success = await onAdd(email.trim(), name.trim() || email.trim());
    if (success) {
      setEmail('');
      setName('');
    }
    setAdding(false);
  };

  const handleQuickAdd = async (rec) => {
    const nameToUse = rec.name;
    // Pre-fill the form so user can enter the email themselves
    setName(nameToUse);
  };

  return (
    <div className="sources-page">
      <div className="sources-header">
        <h2>Newsletter Sources</h2>
        <p>Add the email addresses that send you newsletters. We'll fetch and curate content from these senders.</p>
      </div>

      <form className="source-form" onSubmit={handleAdd}>
        <div className="form-row">
          <div className="form-field">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="newsletter@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label>Display Name</label>
            <input
              type="text"
              placeholder="Morning Brew (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding || !email}>
            <Plus size={16} />
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>

      {sources.length === 0 ? (
        <div className="empty-state subtle">
          <Mail size={40} />
          <h3>No sources yet</h3>
          <p>Add your first newsletter source above to get started.</p>
        </div>
      ) : (
        <div className="source-list">
          {sources.map(source => (
            <div key={source.id} className="source-card">
              <div className="source-avatar">
                {source.name.charAt(0).toUpperCase()}
              </div>
              <div className="source-info">
                <span className="source-name">{source.name}</span>
                <span className="source-email">{source.email}</span>
              </div>
              <button
                className="btn-icon danger"
                onClick={() => onRemove(source.id)}
                title="Remove source"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      <div className="recommendations-section">
        <div className="recommendations-header">
          <Sparkles size={16} />
          <span>Recommended for you</span>
        </div>
        <p className="recommendations-sub">
          Popular newsletters picked for your edition. Click a card to visit their site and sign up — once you're subscribed, add the sender email above.
        </p>
        <div className="recommendations-grid">
          {recommendations.map((rec) => (
            <a
              key={rec.name}
              href={rec.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rec-card"
            >
              <div className="rec-card-top">
                <div className="rec-avatar">{rec.name.charAt(0)}</div>
                <ExternalLink size={14} className="rec-external" />
              </div>
              <div className="rec-name">{rec.name}</div>
              <div className="rec-tag">{rec.tag}</div>
              <div className="rec-description">{rec.description}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
