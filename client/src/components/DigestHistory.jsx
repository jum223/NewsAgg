import React, { useState, useEffect } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import DigestView from './DigestView';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

export default function DigestHistory() {
  const [digests, setDigests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/newsletters/history`)
      .then(r => r.json())
      .then(data => {
        setDigests(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const viewDigest = async (id) => {
    const res = await fetch(`${API}/api/newsletters/${id}`);
    const data = await res.json();
    setSelected(data);
  };

  if (selected) {
    return (
      <div>
        <button className="btn btn-ghost back-btn" onClick={() => setSelected(null)}>
          &larr; Back to history
        </button>
        <DigestView digest={selected} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="history-page">
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h2>Digest History</h2>
        <p>Browse your past curated newsletters.</p>
      </div>

      {digests.length === 0 ? (
        <div className="empty-state subtle">
          <Clock size={40} />
          <h3>No history yet</h3>
          <p>Your curated digests will appear here after you create your first one.</p>
        </div>
      ) : (
        <div className="history-list">
          {digests.map(d => (
            <button key={d.id} className="history-item" onClick={() => viewDigest(d.id)}>
              <div className="history-date">
                <Clock size={16} />
                <span>{new Date(d.date).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                })}</span>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
