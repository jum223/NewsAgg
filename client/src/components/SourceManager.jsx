import React, { useState } from 'react';
import { Plus, Trash2, Mail } from 'lucide-react';

export default function SourceManager({ sources, onAdd, onRemove }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

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
    </div>
  );
}
