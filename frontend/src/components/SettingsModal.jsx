import React, { useState } from 'react';
import { Database, Key, CheckCircle2, AlertCircle, X, ExternalLink } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  dbStatus
}) {
  const [mongoUri, setMongoUri] = useState(config.mongoUri || '');
  const [geminiKey, setGeminiKey] = useState(config.geminiKey || '');
  const [groqKey, setGroqKey] = useState(config.groqKey || '');
  const [openRouterKey, setOpenRouterKey] = useState(config.openRouterKey || '');
  const [testingDb, setTestingDb] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleTestMongo = async () => {
    if (!mongoUri) {
      setTestResult({ success: false, message: 'Please enter a MongoDB connection string first.' });
      return;
    }
    setTestingDb(true);
    setTestResult(null);

    try {
      const resp = await fetch('/api/settings/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mongodb_uri: mongoUri })
      });
      const data = await resp.json();
      setTestResult({ success: data.connected, message: data.message });
    } catch (err) {
      setTestResult({ success: false, message: 'Failed to test connection: ' + err.message });
    } finally {
      setTestingDb(false);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      mongoUri,
      geminiKey,
      groqKey,
      openRouterKey
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1.5rem'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.15rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Database size={18} color="#3b82f6" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              System Configuration & API Integrations
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.4rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* MongoDB Atlas Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                MongoDB Atlas Database
              </label>
              <span style={{
                fontSize: '0.7rem',
                color: dbStatus?.mongodb_connected ? '#34d399' : '#fbbf24',
                fontWeight: 600
              }}>
                {dbStatus?.mongodb_connected ? 'Connected to Atlas' : 'Local Persistence Active'}
              </span>
            </div>
            <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Persists runs, agent trace logs, and document embeddings.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="mongodb+srv://<user>:<password>@cluster0.mongodb.net/..."
                value={mongoUri}
                onChange={(e) => setMongoUri(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  fontFamily: "'JetBrains Mono', monospace"
                }}
              />
              <button
                type="button"
                onClick={handleTestMongo}
                disabled={testingDb}
                style={{
                  background: 'rgba(37, 99, 235, 0.15)',
                  border: '1px solid rgba(37, 99, 235, 0.3)',
                  color: '#60a5fa',
                  borderRadius: '8px',
                  padding: '0 0.85rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                {testingDb ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            {testResult && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: testResult.success ? '#34d399' : '#f87171'
              }}>
                {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

          {/* LLM APIs Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
              <Key size={16} color="#60a5fa" />
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                AI Model Provider Integrations
              </label>
            </div>
            <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
              Multi-model fallback chain: <strong>Gemini → Groq → OpenRouter → Specialist Engine</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#cbd5e1', marginBottom: '0.2rem' }}>
                  <span>Google Gemini API Key</span>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    Console <ExternalLink size={10} />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: '#f8fafc',
                    fontSize: '0.8rem'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#cbd5e1', marginBottom: '0.2rem' }}>
                  <span>Groq API Key</span>
                  <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    Console <ExternalLink size={10} />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: '#f8fafc',
                    fontSize: '0.8rem'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#cbd5e1', marginBottom: '0.2rem' }}>
                  <span>OpenRouter API Key</span>
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    Console <ExternalLink size={10} />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: '#f8fafc',
                    fontSize: '0.8rem'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.82rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: '#2563eb',
              border: 'none',
              color: '#ffffff',
              padding: '0.45rem 1.25rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
