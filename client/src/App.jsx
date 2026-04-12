import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SourceManager from './components/SourceManager';
import DigestView from './components/DigestView';
import DigestHistory from './components/DigestHistory';
import WeeklyDigestView from './components/WeeklyDigestView';
import SetupGuide from './components/SetupGuide';

// In production, API is served from the same origin. In dev, Vite proxies to localhost:3001.
const API = import.meta.env.DEV ? 'http://localhost:3001' : '';
//test

export default function App() {
  const [view, setView] = useState('digest'); // 'digest' | 'sources' | 'history' | 'setup'
  const [authenticated, setAuthenticated] = useState(false);
  const [sources, setSources] = useState([]);
  const [latestDigest, setLatestDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  // Check auth & load data on mount
  useEffect(() => {
    async function init() {
      try {
        const authRes = await fetch(`${API}/api/auth/status`);
        const authData = await authRes.json();
        setAuthenticated(authData.authenticated);

        const srcRes = await fetch(`${API}/api/sources`);
        const srcData = await srcRes.json();
        setSources(srcData);

        const digestRes = await fetch(`${API}/api/newsletters/latest`);
        const digestData = await digestRes.json();
        setLatestDigest(digestData);

        // Auto-show setup if not authenticated
        if (!authData.authenticated) setView('setup');
      } catch (err) {
        setError('Could not connect to server. Make sure the backend is running on port 3001.');
      } finally {
        setLoading(false);
      }
    }
    init();

    // Check URL for auth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setAuthenticated(true);
      setView('sources');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const connectGmail = async () => {
    try {
      const res = await fetch(`${API}/auth/google`);
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      setError('Failed to start Gmail authentication');
    }
  };

  const addSource = async (email, name) => {
    try {
      const res = await fetch(`${API}/api/sources`, {
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
    await fetch(`${API}/api/sources/${id}`, { method: 'DELETE' });
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const fetchDigest = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/newsletters/fetch`, { method: 'POST' });
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

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loader" />
        <p>Loading The Digestino...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        view={view}
        setView={setView}
        authenticated={authenticated}
        sourceCount={sources.length}
        onFetch={fetchDigest}
        fetching={fetching}
      />

      <main className="main-content">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        {view === 'setup' && (
          <SetupGuide
            authenticated={authenticated}
            onConnect={connectGmail}
            onDone={() => setView('sources')}
          />
        )}

        {view === 'sources' && (
          <SourceManager
            sources={sources}
            onAdd={addSource}
            onRemove={removeSource}
            authenticated={authenticated}
            onConnect={connectGmail}
          />
        )}

        {view === 'digest' && (
          <DigestView
            digest={latestDigest}
            onFetch={fetchDigest}
            fetching={fetching}
            hasSources={sources.length > 0}
          />
        )}

        {view === 'history' && <DigestHistory />}
        {view === 'weekly' && <WeeklyDigestView />}
      </main>
    </div>
  );
}
