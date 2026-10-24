import React, { useState } from 'react';
import { Copy, Download, Check, Award, ShieldCheck, BookOpen, Clock, FileText, ExternalLink, RefreshCw } from 'lucide-react';

export default function FinalReportViewer({ runData }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('report');

  if (!runData || !runData.run) {
    return null;
  }

  const { run } = runData;
  const reviews = run.reviews || [];
  const latestReview = reviews.length > 0 ? reviews[reviews.length - 1] : null;
  const citations = run.citations || [];
  const reportText = run.final_output || run.draft || '';
  const outputType = run.output_type || 'code';
  const isCode = outputType === 'code';

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([reportText], { type: isCode ? 'text/plain' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi_agent_${outputType}_${run.run_id.slice(0, 8)}.${isCode ? 'txt' : 'md'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Basic markdown renderer for headers, tables, lists, quotes, and bolding
  const renderSimpleMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let tableLines = [];
    let inTable = false;

    const flushTable = (key) => {
      if (tableLines.length === 0) return null;
      const headerLine = tableLines[0];
      const dataLines = tableLines.slice(2); // skip separator

      const headers = headerLine.split('|').map(h => h.strip ? h.strip() : h.trim()).filter(Boolean);

      const tableEl = (
        <table key={`table-${key}`}>
          <thead>
            <tr>
              {headers.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {dataLines.map((row, rIdx) => {
              const cells = row.split('|').map(c => c.trim()).filter(Boolean);
              return (
                <tr key={rIdx}>
                  {cells.map((c, cIdx) => <td key={cIdx}>{c}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      );
      tableLines = [];
      inTable = false;
      return tableEl;
    };

    lines.forEach((line, index) => {
      // Table check
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        tableLines.push(line);
        return;
      } else if (inTable) {
        elements.push(flushTable(index));
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(<h1 key={index}>{line.replace('# ', '')}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={index}>{line.replace('## ', '')}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={index}>{line.replace('### ', '')}</h3>);
      } else if (line.startsWith('> ')) {
        elements.push(<blockquote key={index}>{line.replace('> ', '')}</blockquote>);
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        elements.push(<li key={index}>{line.replace(/^[-*]\s*/, '')}</li>);
      } else if (line.trim()) {
        elements.push(<p key={index}>{line}</p>);
      }
    });

    if (inTable) {
      elements.push(flushTable('end'));
    }

    return elements;
  };

  return (
    <div style={{
      background: 'rgba(17, 24, 39, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '14px',
      overflow: 'hidden'
    }}>
      {/* Viewer Header */}
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981'
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                Verified Deliverable
              </h3>
              {latestReview && (
                <span style={{
                  background: latestReview.approved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: latestReview.approved ? '#34d399' : '#fbbf24',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px'
                }}>
                  Score: {latestReview.score}/100
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Goal: {run.goal}
            </p>
          </div>
        </div>

        {/* Tab & Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.3)', padding: '2px', borderRadius: '8px' }}>
            <button
              onClick={() => setActiveTab('report')}
              style={{
                background: activeTab === 'report' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                color: activeTab === 'report' ? '#a5b4fc' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: activeTab === 'report' ? 600 : 400
              }}
            >
              {isCode ? 'Final Code' : 'Final Report'}
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              style={{
                background: activeTab === 'audit' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                color: activeTab === 'audit' ? '#a5b4fc' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: activeTab === 'audit' ? 600 : 400
              }}
            >
              Reviewer Audit ({reviews.length})
            </button>
            <button
              onClick={() => setActiveTab('citations')}
              style={{
                background: activeTab === 'citations' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                color: activeTab === 'citations' ? '#a5b4fc' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: activeTab === 'citations' ? 600 : 400
              }}
            >
              Citations ({citations.length})
            </button>
          </div>

          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#e2e8f0',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: '#6366f1',
              border: 'none',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <Download size={14} />
            Export .md
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '1.5rem', maxHeight: '520px', overflowY: 'auto' }}>
        {activeTab === 'report' && (
          <div className={isCode ? 'prose-report code-output' : 'prose-report'}>
            {isCode ? <pre>{reportText}</pre> : renderSimpleMarkdown(reportText)}
          </div>
        )}

        {activeTab === 'audit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '10px',
              padding: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <Award size={18} color="#34d399" />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#34d399' }}>
                  Reviewer Decision: {latestReview?.approved ? 'Approved for Release' : 'Revisions Required'}
                </h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                {latestReview?.quality_summary}
              </p>
            </div>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
              Feedback Loop Iteration History ({reviews.length} Rounds)
            </h4>

            {reviews.map((rev, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>
                    Iteration {rev.iteration || (idx + 1)}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: rev.approved ? '#34d399' : '#fbbf24'
                  }}>
                    Quality Score: {rev.score}/100 ({rev.approved ? 'Approved' : 'Returned to Writer'})
                  </span>
                </div>

                {rev.critiques && rev.critiques.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    <strong>Audit Findings:</strong>
                    <ul style={{ margin: '0.3rem 0 0 1.25rem' }}>
                      {rev.critiques.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}

                {rev.suggestions && (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    Advice to Writer: {rev.suggestions}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'citations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              The following sources were retrieved by the Researcher Agent and verified by the Reviewer:
            </p>
            {citations.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>No external citations recorded.</p>
            ) : (
              citations.map((c, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: c.type === 'slide' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                      color: c.type === 'slide' ? '#fbbf24' : '#67e8f9'
                    }}>
                      {c.type === 'slide' ? 'PPT Slide' : 'Web Resource'}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 500 }}>
                      {c.title}
                    </span>
                  </div>
                  {c.url && c.url.startsWith('http') && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}
                    >
                      Visit <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
