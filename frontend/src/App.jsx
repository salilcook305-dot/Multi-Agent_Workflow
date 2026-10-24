import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Database,
  History,
  CheckCircle2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import FileUploader from './components/FileUploader';
import AgentGraphVisualizer from './components/AgentGraphVisualizer';
import LiveProgressStream from './components/LiveProgressStream';
import FinalReportViewer from './components/FinalReportViewer';
import SettingsModal from './components/SettingsModal';

export default function App() {
  // App States
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [goal, setGoal] = useState('Analyze the uploaded presentation to extract key strategic objectives, architectural components, and implementation plan.');
  const [maxRevisions, setMaxRevisions] = useState(2);

  // Workflow Run States
  const [currentRunId, setCurrentRunId] = useState(null);
  const [runData, setRunData] = useState(null);
  const [events, setEvents] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentAgent, setCurrentAgent] = useState('manager');
  const [revisionCount, setRevisionCount] = useState(0);

  // UI Tabs & Modals
  const [activeRightTab, setActiveRightTab] = useState('stream'); // 'stream', 'report', 'history'
  const [pastRuns, setPastRuns] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  // Configuration (from localStorage)
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('agent_workflow_config');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Load Initial Data
  useEffect(() => {
    fetchHealth();
    fetchFiles();
    fetchRuns();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealthStatus(data);
      }
    } catch (err) {
      console.warn('Backend not responding yet:', err);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
        if (data.length > 0 && selectedFileIds.length === 0) {
          setSelectedFileIds(data.map(f => f.file_id));
        }
      }
    } catch (err) {
      console.error('Error fetching files:', err);
    }
  };

  const fetchRuns = async () => {
    try {
      const res = await fetch('/api/runs');
      if (res.ok) {
        const data = await res.json();
        setPastRuns(data);
      }
    } catch (err) {
      console.error('Error fetching runs:', err);
    }
  };

  // Upload handler
  const handleUploadSuccess = (newFile) => {
    setFiles(prev => [newFile, ...prev]);
    setSelectedFileIds(prev => [...prev, newFile.file_id]);
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      setFiles(prev => prev.filter(f => f.file_id !== fileId));
      setSelectedFileIds(prev => prev.filter(id => id !== fileId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleToggleSelectFile = (fileId) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  // Run Multi-Agent Workflow
  const handleStartWorkflow = async () => {
    if (!goal.trim() || isRunning) return;

    setIsRunning(true);
    setIsCompleted(false);
    setEvents([]);
    setRunData(null);
    setCurrentAgent('manager');
    setRevisionCount(0);
    setActiveRightTab('stream');

    try {
      const payload = {
        goal: goal.trim(),
        file_ids: selectedFileIds,
        max_revisions: Number(maxRevisions) || 2,
        gemini_api_key: config.geminiKey || undefined,
        groq_api_key: config.groqKey || undefined,
        openrouter_api_key: config.openRouterKey || undefined,
        mongodb_uri: config.mongoUri || undefined
      };

      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to start run');

      const runId = data.run_id;
      setCurrentRunId(runId);
      listenToEventStream(runId);
    } catch (err) {
      alert('Error launching workflow: ' + err.message);
      setIsRunning(false);
    }
  };

  // Connect to SSE Stream
  const listenToEventStream = (runId) => {
    const eventSource = new EventSource(`/api/stream/${runId}`);

    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        setEvents(prev => [...prev, event]);

        if (event.agent && event.agent !== 'system') {
          setCurrentAgent(event.agent);
        }

        if (event.step_type === 'revision') {
          setRevisionCount(prev => prev + 1);
        }

        if (event.step_type === 'completed' && event.agent === 'system') {
          eventSource.close();
          setIsRunning(false);
          setIsCompleted(true);
          loadFinalRunData(runId);
          fetchRuns();
        } else if (event.step_type === 'error' && event.agent === 'system') {
          eventSource.close();
          setIsRunning(false);
          fetchRuns();
        }
      } catch (err) {
        console.error('SSE JSON error:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsRunning(false);
      loadFinalRunData(runId);
    };
  };

  const loadFinalRunData = async (runId) => {
    try {
      const res = await fetch(`/api/runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setRunData(data);
        setActiveRightTab('report');
      }
    } catch (err) {
      console.error('Failed to load final run:', err);
    }
  };

  const handleSelectPastRun = async (run) => {
    setCurrentRunId(run.run_id);
    setIsRunning(false);
    setIsCompleted(run.status === 'completed');
    try {
      const res = await fetch(`/api/runs/${run.run_id}`);
      if (res.ok) {
        const data = await res.json();
        setRunData(data);
        setEvents(data.steps || []);
        setActiveRightTab('report');
      }
    } catch (err) {
      console.error('Load run error:', err);
    }
  };

  const handleSaveConfig = (newConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('agent_workflow_config', JSON.stringify(newConfig));
    } catch {}
    fetchHealth();
  };

  const quickPrompts = [
    "Extract executive summary, strategic objectives, and key deliverables.",
    "Analyze system architecture, technical layers, and agent workflow dependencies.",
    "Audit technical risks, operational bottlenecks, and generate mitigation strategies."
  ];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1rem 1.5rem', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Navbar with AI Samrat Logo */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.4rem',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: '#ffffff',
            padding: '4px 8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)'
          }}>
            <img
              src="/logo.png"
              alt="AI Samrat Private Limited"
              style={{
                height: '42px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                AI SAMRAT
              </h1>
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>|</span>
              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#93c5fd' }}>
                Multi-Agent Workflow System
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Autonomous 4-Specialist Orchestration • Presentation RAG Grounding
            </p>
          </div>
        </div>

        {/* Status badges & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Database status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '4px 10px',
            borderRadius: '8px',
            background: healthStatus?.mongodb_connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: healthStatus?.mongodb_connected ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
            fontSize: '0.74rem',
            color: healthStatus?.mongodb_connected ? '#34d399' : '#fbbf24'
          }}>
            <Database size={13} />
            <span>{healthStatus?.mongodb_connected ? 'MongoDB Atlas' : 'Local Persistence'}</span>
          </div>

          {/* Settings modal button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.15)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              color: '#93c5fd',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
          >
            <Settings size={14} />
            Settings & Keys
          </button>
        </div>
      </header>

      {/* Main Content Layout (2 Columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '1.25rem', flex: 1 }}>
        {/* LEFT COLUMN: Input & Uploads */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* User Goal Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} color="#3b82f6" />
              <h2 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                Workflow Objective & Directives
              </h2>
            </div>

            <textarea
              rows={4}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Enter your high-level goal or research inquiry..."
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '0.75rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                resize: 'vertical'
              }}
            />

            {/* Quick Prompts */}
            <div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Suggested Directives:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                {quickPrompts.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setGoal(qp)}
                    style={{
                      textAlign: 'left',
                      fontSize: '0.73rem',
                      color: '#94a3b8',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#e2e8f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                  >
                    • {qp}
                  </button>
                ))}
              </div>
            </div>

            {/* Revision Limit & Execution Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Max Quality Loops:
                </label>
                <select
                  value={maxRevisions}
                  onChange={(e) => setMaxRevisions(e.target.value)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: '0.75rem',
                    padding: '3px 6px',
                    borderRadius: '6px'
                  }}
                >
                  <option value={1}>1 iteration</option>
                  <option value={2}>2 iterations (Recommended)</option>
                  <option value={3}>3 iterations</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleStartWorkflow}
                disabled={isRunning}
                style={{
                  background: isRunning
                    ? 'rgba(37, 99, 235, 0.5)'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)'
                }}
              >
                {isRunning ? (
                  <>
                    <RotateCcw size={15} className="pulsing-ring" />
                    Executing Agents...
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    Run Workflow
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PowerPoint File Uploader Component */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.2rem'
          }}>
            <FileUploader
              files={files}
              selectedFileIds={selectedFileIds}
              onToggleSelectFile={handleToggleSelectFile}
              onUploadSuccess={handleUploadSuccess}
              onDeleteFile={handleDeleteFile}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Pipeline Visualizer, Stream & Deliverables */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Agent Pipeline Visualizer Card */}
          <AgentGraphVisualizer
            currentAgent={currentAgent}
            revisionCount={revisionCount}
            maxRevisions={maxRevisions}
            isRunning={isRunning}
            isCompleted={isCompleted}
          />

          {/* Right Area Tabs Switcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '0.5rem'
          }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setActiveRightTab('stream')}
                style={{
                  background: activeRightTab === 'stream' ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                  border: activeRightTab === 'stream' ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid transparent',
                  color: activeRightTab === 'stream' ? '#f8fafc' : '#94a3b8',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isRunning ? '#10b981' : '#64748b'
                }} />
                Live Agent Progress ({events.length})
              </button>

              <button
                onClick={() => setActiveRightTab('report')}
                style={{
                  background: activeRightTab === 'report' ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                  border: activeRightTab === 'report' ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid transparent',
                  color: activeRightTab === 'report' ? '#f8fafc' : '#94a3b8',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <CheckCircle2 size={13} color={isCompleted ? '#34d399' : '#94a3b8'} />
                Verified Deliverable
              </button>

              <button
                onClick={() => setActiveRightTab('history')}
                style={{
                  background: activeRightTab === 'history' ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                  border: activeRightTab === 'history' ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid transparent',
                  color: activeRightTab === 'history' ? '#f8fafc' : '#94a3b8',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <History size={13} />
                Execution History ({pastRuns.length})
              </button>
            </div>

            {currentRunId && (
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                Run ID: {currentRunId.slice(0, 8)}...
              </span>
            )}
          </div>

          {/* Active Tab Panel */}
          {activeRightTab === 'stream' && (
            <LiveProgressStream
              events={events}
              isRunning={isRunning}
              isCompleted={isCompleted}
            />
          )}

          {activeRightTab === 'report' && (
            <FinalReportViewer runData={runData} />
          )}

          {activeRightTab === 'history' && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '1.25rem',
              maxHeight: '420px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.25rem' }}>
                Past Multi-Agent Workflow Executions
              </h3>

              {pastRuns.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem', fontSize: '0.82rem' }}>
                  No prior executions recorded yet.
                </div>
              ) : (
                pastRuns.map((r) => (
                  <div
                    key={r.run_id}
                    onClick={() => handleSelectPastRun(r)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: currentRunId === r.run_id ? 'rgba(37, 99, 235, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                      border: currentRunId === r.run_id ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f8fafc' }}>
                        {r.goal}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        Status: <strong style={{ color: r.status === 'completed' ? '#34d399' : '#fbbf24' }}>{r.status}</strong> • Quality Loops: {r.revision_count || 0} • {new Date((r.created_at || 0) * 1000).toLocaleString()}
                      </div>
                    </div>
                    <ChevronRight size={16} color="#94a3b8" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        dbStatus={healthStatus}
      />
    </div>
  );
}
