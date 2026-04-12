import React, { useState, useRef, useEffect } from 'react';
import { Mail, Clock, Settings, RefreshCw, Zap, Trophy, Shield, LogOut, ChevronDown } from 'lucide-react';
import Logo from './Logo';

export default function Header({ view, setView, user, sourceCount, onFetch, fetching, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
        </nav>

        <div className="header-actions">
          {sourceCount > 0 && (
            <button
              className="fetch-btn"
              onClick={onFetch}
              disabled={fetching}
            >
              <RefreshCw size={16} className={fetching ? 'spin' : ''} />
              {fetching ? 'Curating...' : 'Refresh'}
            </button>
          )}

          {/* User menu */}
          <div className="user-menu-container" ref={menuRef}>
            <button className="user-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="user-menu-avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="user-menu-avatar-placeholder">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <ChevronDown size={14} className={`user-menu-chevron ${menuOpen ? 'open' : ''}`} />
            </button>

            {menuOpen && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <span className="user-dropdown-name">{user.name}</span>
                  <span className="user-dropdown-email">{user.email}</span>
                </div>
                <div className="user-dropdown-divider" />
                <button className="user-dropdown-item" onClick={() => { setView('settings'); setMenuOpen(false); }}>
                  <Settings size={15} />
                  Settings
                </button>
                {user.is_admin && (
                  <button className="user-dropdown-item" onClick={() => { setView('admin'); setMenuOpen(false); }}>
                    <Shield size={15} />
                    Admin Panel
                  </button>
                )}
                <div className="user-dropdown-divider" />
                <button className="user-dropdown-item danger" onClick={onLogout}>
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
