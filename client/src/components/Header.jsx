import React from 'react';
import { Mail, Clock, Settings, RefreshCw, Zap, Trophy } from 'lucide-react';
import Logo from './Logo';

export default function Header({ view, setView, authenticated, sourceCount, onFetch, fetching }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand" onClick={() => setView('digest')} style={{ cursor: 'pointer' }}>
          <Logo size={38} variant="full" />
        </div>

        <nav className="header-nav">
          <button
            className={`nav-btn ${view === 'digest' ? 'active' : ''}`}
            onClick={() => setView('digest')}
          >
            <Zap size={16} />
            <span>Today</span>
          </button>
          <button
            className={`nav-btn ${view === 'weekly' ? 'active' : ''}`}
            onClick={() => setView('weekly')}
          >
            <Trophy size={16} />
            <span>Weekly</span>
          </button>
          <button
            className={`nav-btn ${view === 'sources' ? 'active' : ''}`}
            onClick={() => setView('sources')}
          >
            <Mail size={16} />
            <span>Sources</span>
            {sourceCount > 0 && <span className="badge">{sourceCount}</span>}
          </button>
          <button
            className={`nav-btn ${view === 'history' ? 'active' : ''}`}
            onClick={() => setView('history')}
          >
            <Clock size={16} />
            <span>History</span>
          </button>
          <button
            className={`nav-btn ${view === 'setup' ? 'active' : ''}`}
            onClick={() => setView('setup')}
          >
            <Settings size={16} />
            <span>Setup</span>
          </button>
        </nav>

        <div className="header-actions">
          {authenticated && sourceCount > 0 && (
            <button
              className="fetch-btn"
              onClick={onFetch}
              disabled={fetching}
            >
              <RefreshCw size={16} className={fetching ? 'spin' : ''} />
              {fetching ? 'Curating...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
