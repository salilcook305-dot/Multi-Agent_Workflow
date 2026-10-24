import React from 'react';
import { Bot, Search, FileEdit, CheckCheck, RefreshCw } from 'lucide-react';

export default function AgentGraphVisualizer({ currentAgent, revisionCount, maxRevisions, isRunning, isCompleted }) {
  const agents = [
    {
      id: 'manager',
      name: 'Manager',
      role: 'Goal Decomposition & Orchestration',
      model: 'Fast Decomposition Model',
      color: '#2563eb',
      icon: Bot,
      statusDesc: 'Analyzing objectives & assigning tasks'
    },
    {
      id: 'researcher',
      name: 'Researcher',
      role: 'PowerPoint RAG & Live Web Intel',
      model: 'Multimodal Research Model',
      color: '#0284c7',
      icon: Search,
      statusDesc: 'Extracting slide evidence & web sources'
    },
    {
      id: 'writer',
      name: 'Writer',
      role: 'Structured Technical Drafting',
      model: 'Advanced Synthesis Engine',
      color: '#8b5cf6',
      icon: FileEdit,
      statusDesc: 'Synthesizing report & addressing feedback'
    },
    {
      id: 'reviewer',
      name: 'Reviewer',
      role: 'Quality, Grounding & Fact Audit',
      model: 'Independent Audit Model',
      color: '#10b981',
      icon: CheckCheck,
      statusDesc: 'Verifying citations & deciding revision handoff'
    }
  ];

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '14px',
      padding: '1.25rem',
      position: 'relative'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isRunning ? '#10b981' : isCompleted ? '#2563eb' : '#64748b',
            boxShadow: isRunning ? '0 0 10px #10b981' : 'none'
          }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
            Autonomous Multi-Agent Pipeline
          </h3>
        </div>

        {revisionCount > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            <RefreshCw size={12} className={isRunning && currentAgent === 'writer' ? 'pulsing-ring' : ''} />
            Revision Loop: Round {revisionCount} of {maxRevisions}
          </div>
        )}
      </div>

      {/* 4 Agent Nodes Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.85rem',
        position: 'relative'
      }}>
        {agents.map((ag, idx) => {
          const Icon = ag.icon;
          const isActive = isRunning && currentAgent === ag.id;
          const isDone = isCompleted || (isRunning && agents.findIndex(a => a.id === currentAgent) > idx);

          return (
            <div
              key={ag.id}
              style={{
                background: isActive
                  ? `rgba(15, 23, 42, 0.95)`
                  : 'rgba(15, 23, 42, 0.5)',
                border: isActive
                  ? `1px solid ${ag.color}`
                  : isDone
                  ? '1px solid rgba(255, 255, 255, 0.12)'
                  : '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '0.95rem',
                position: 'relative',
                boxShadow: isActive ? `0 0 20px -3px ${ag.color}44` : 'none',
                transition: 'all 0.25s ease'
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: '-9px',
                  right: '12px',
                  background: ag.color,
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '1px 8px',
                  borderRadius: '9999px',
                  letterSpacing: '0.05em'
                }}>
                  Active
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `${ag.color}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: ag.color
                }}>
                  <Icon size={17} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                    {ag.name}
                  </h4>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    {ag.model}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '0.55rem', minHeight: '34px', lineHeight: '1.4' }}>
                {ag.role}
              </p>

              <div style={{
                fontSize: '0.7rem',
                color: isActive ? ag.color : '#64748b',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '4px 8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isActive ? ag.color : isDone ? '#10b981' : '#475569'
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isActive ? 'Processing...' : isDone ? 'Step Completed' : 'Standby'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revision Loop Annotation Banner */}
      <div style={{
        marginTop: '0.9rem',
        padding: '0.6rem 0.9rem',
        background: 'rgba(37, 99, 235, 0.06)',
        border: '1px dashed rgba(37, 99, 235, 0.25)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={14} color="#60a5fa" />
          <span>
            <strong style={{ color: '#e0e7ff' }}>Automated Quality Assurance:</strong> If the Reviewer detects missing evidence or inaccuracies, the draft is returned to the Writer for refinement.
          </span>
        </div>
        <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.72rem' }}>
          LangGraph Conditional Routing
        </span>
      </div>
    </div>
  );
}
