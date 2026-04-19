import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SourceManager from './components/SourceManager';
import DigestView from './components/DigestView';
import DigestHistory from './components/DigestHistory';
import WeeklyDigestView from './components/WeeklyDigestView';
import SettingsPage from './components/SettingsPage';
import AdminPanel from './components/AdminPanel';
import LoginPage from './components/LoginPage';
import FlavorPicker from './components/FlavorPicker';

// In production, API is served from the same origin. In dev, Vite proxies to localhost:3001.
const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('digestino_token'));
  const [user, setUser] = useState(null);
  const [view, setView] = useState('digest');
  const [sources, setSources] = useState([]);
  const [latestDigest, setLatestDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null);

  // Helper for authenticated fetch
  const authFetch = (url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: {
        ...opts.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  // Check URL params for auth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    const newToken = params.get('token');

    if (authResult === 'success' && newToken) {
      localStorage.setItem('digestino_token', newToken);
      setToken(newToken);
      window.history.replaceState({}, '', '/');
    } else if (authResult === 'no-invite') {
      setAuthError('An invite code is required to sign up. Switch to the Sign Up tab and enter your code.');
      window.history.replaceState({}, '', '/');
    } else if (authResult === 'invalid-invite') {
      setAuthError('That invite code is invalid or has already been used.');
      window.history.replaceState({}, '', '/');
    } else if (authResult === 'error') {
      setAuthError('Authentication failed. Please try again.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Load user data when token is available
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    async function init() {
      try {
        // Verify token + get user info
        const meRes = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meRes.ok) {
          // Token is invalid/expired — clear it
          localStorage.removeItem('digestino_token');
          setToken(null);
          setLoading(false);
          return;
        }

        const userData = await meRes.json();
        setUser(userData);

        // Apply flavor theme to document
        if (userData.flavor) {
          document.documentElement.setAttribute('data-flavor', userData.flavor);
        }

        // Load sources and latest digest in parallel
        const [srcRes, digestRes] = await Promise.all([
          fetch(`${API}/api/sources`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/newsletters/latest`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const srcData = await srcRes.json();
        setSources(srcData);

        const digestData = await digestRes.json();
        setLatestDigest(digestData);

        // If no sources yet, take them to sources page
        if (srcData.length === 0) setView('sources');
      } catch (err) {
        setError('Could not connect to server. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [token]);

  const logout = () => {
    localStorage.removeItem('digestino_token');
    setToken(null);
    setUser(null);
    setSources([]);
    setLatestDigest(null);
    setView('digest');
    document.documentElement.removeAttribute('data-flavor');
  };

  const handleFlavorSelected = (flavor) => {
    setUser(prev => ({ ...prev, flavor }));
    document.documentElement.setAttribute('data-flavor', flavor);
    // If no sources yet, go straight to sources page
    if (sources.length === 0) setView('sources');
  };

  const addSource = async (email, name) => {
    try {
      const res = await authFetch(`${API}/api/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const source = await res.json();
      setSources(prev => [source, ...prev]);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const removeSource = async (id) => {
    await authFetch(`${API}/api/sources/${id}`, { method: 'DELETE' });
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const updateSource = (id, fields) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s));
  };

  const fetchDigest = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await authFetch(`${API}/api/newsletters/fetch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.digest) {
        setLatestDigest({ content: data.digest, date: new Date().toISOString().split('T')[0] });
        setView('digest');
      } else {
        setError(data.message || 'No new newsletters found');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loader" />
        <p>Loading The Digestino...</p>
      </div>
    );
  }

  // ── Not logged in — show login page ──
  if (!token || !user) {
    return <LoginPage authError={authError} />;
  }

  // ── Logged in but no flavor chosen yet — show picker ──
  if (!user.flavor) {
    return (
      <FlavorPicker
        user={user}
        token={token}
        onComplete={handleFlavorSelected}
      />
    );
  }

  // ── Logged in — main app ──
  return (
    <div className="app">
      <Header
        view={view}
        setView={setView}
        user={user}
        sourceCount={sources.length}
        onFetch={fetchDigest}
        fetching={fetching}
        onLogout={logout}
      />

      <main className="main-content">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        {view === 'sources' && (
          <SourceManager
            sources={sources}
            onAdd={addSource}
            onRemove={removeSource}
            onUpdateSource={updateSource}
            token={token}
          />
        )}

        {view === 'digest' && (
          <DigestView
            digest={latestDigest}
            onFetch={fetchDigest}
            fetching={fetching}
            hasSources={sources.length > 0}
            token={token}
          />
        )}

        {view === 'history' && <DigestHistory token={token} />}
        {view === 'weekly' && <WeeklyDigestView token={token} />}
        {view === 'settings' && (
          <SettingsPage
            user={user}
            token={token}
            onUserUpdate={(u) => {
              setUser(prev => ({ ...prev, ...u }));
              if (u.flavor) document.documentElement.setAttribute('data-flavor', u.flavor);
            }}
            onLogout={logout}
          />
        )}
        {view === 'admin' && user.is_admin && <AdminPanel token={token} />}
      </main>
    </div>
  );
}
