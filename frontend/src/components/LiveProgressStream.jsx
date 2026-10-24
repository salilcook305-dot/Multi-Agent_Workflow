import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Bot, Search, FileEdit, CheckCheck, Info, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function LiveProgressStream({ events, isRunning, isCompleted }) {
  const [filterAgent, setFilterAgent] = useState('all');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const filteredEvents = events.filter((ev) => {
    if (filterAgent === 'all') return true;
    return ev.agent === filterAgent;
  });

  const getAgentBadge = (agent) => {
    switch (agent) {
      case 'manager':
        return { label: 'Manager', color: '#6366f1', icon: Bot };
      case 'researcher':
        return { label: 'Researcher', color: '#06b6d4', icon: Search };
      case 'writer':
        return { label: 'Writer', color: '#a855f7', icon: FileEdit };
      case 'reviewer':
        return { label: 'Reviewer', color: '#10b981', icon: CheckCheck };
      default:
        return { label: 'System', color: '#64748b', icon: Info };
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '14px',
      display: 'flex',
      flexDirection: 'column',
      height: '380px',
      overflow: 'hidden'
    }}>
      {/* Console Header */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={16} color="#818cf8" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
            Live Agent Execution Stream (SSE)
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.7rem',
            background: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
            color: isRunning ? '#34d399' : '#94a3b8'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isRunning ? '#10b981' : '#64748b'
            }} />
            {isRunning ? 'Streaming Live' : isCompleted ? 'Completed' : 'Idle'}
          </div>
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {['all', 'manager', 'researcher', 'writer', 'reviewer'].map((agent) => (
            <button
              key={agent}
              onClick={() => setFilterAgent(agent)}
              style={{
                fontSize: '0.7rem',
                textTransform: 'capitalize',
                padding: '3px 8px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: filterAgent === agent ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: filterAgent === agent ? '#a5b4fc' : '#94a3b8',
                fontWeight: filterAgent === agent ? 600 : 400,
                transition: 'all 0.15s ease'
              }}
            >
              {agent}
            </button>
          ))}
        </div>
      </div>

      {/* Events Log List */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          padding: '1rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8rem'
        }}
      >
        {filteredEvents.length === 0 ? (
          <div style={{
            margin: 'auto',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.8rem'
          }}>
            Waiting for agent execution to start...
          </div>
        ) : (
          filteredEvents.map((ev, index) => {
            const badge = getAgentBadge(ev.agent);
            const Icon = badge.icon;
            const isError = ev.step_type === 'error';
            const isRevision = ev.step_type === 'revision';

            return (
              <div
                key={ev.event_id || index}
                style={{
                  display: 'flex',
                  gap: '0.65rem',
                  alignItems: 'flex-start',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  background: isError
                    ? 'rgba(239, 68, 68, 0.1)'
                    : isRevision
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(255, 255, 255, 0.02)',
                  borderLeft: `3px solid ${badge.color}`,
                  lineHeight: '1.4'
                }}
              >
                <div style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: `${badge.color}22`,
                  color: badge.color,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  flexShrink: 0
                }}>
                  <Icon size={12} />
                  <span>{badge.label}</span>
                </div>

                <div style={{ flex: 1, color: isError ? '#f87171' : isRevision ? '#fbbf24' : '#e2e8f0' }}>
                  <span>{ev.message}</span>

                  {/* Render detail payloads if present (like tasks, citations, critiques) */}
                  {ev.details && ev.details.slide_citations && (
                    <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {ev.details.slide_citations.map((c, i) => (
                        <span key={i} style={{
                          fontSize: '0.7rem',
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: '#67e8f9',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {ev.details && ev.details.tasks && (
                    <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {ev.details.tasks.map((t) => (
                        <div key={t.id} style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          • <strong>Task {t.id}:</strong> {t.title} <em>({t.assigned_to})</em>
                        </div>
                      ))}
                    </div>
                  )}

                  {ev.details && ev.details.critiques && (
                    <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#fcd34d' }}>
                      <strong>Review Critiques:</strong>
                      <ul style={{ margin: '0.2rem 0 0 1rem' }}>
                        {ev.details.critiques.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                <span style={{ fontSize: '0.68rem', color: '#64748b', flexShrink: 0 }}>
                  {formatTime(ev.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
