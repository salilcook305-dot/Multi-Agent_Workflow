import React, { useState, useRef } from 'react';
import { UploadCloud, Layers, Eye, Trash2, Presentation } from 'lucide-react';

export default function FileUploader({
  files,
  selectedFileIds,
  onToggleSelectFile,
  onUploadSuccess,
  onDeleteFile
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files[0]);
    }
  };

  const handleFiles = async (file) => {
    const validExtensions = ['.pptx', '.ppt', '.txt', '.md'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExt) {
      setUploadError('Please select a PowerPoint file (.pptx, .ppt) or document (.txt, .md).');
      return;
    }

    setUploadError('');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed');
      }

      onUploadSuccess(data.file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err.message || 'Error processing presentation file.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: isDragging ? '2px dashed #2563eb' : '2px dashed rgba(255, 255, 255, 0.15)',
          background: isDragging ? 'rgba(37, 99, 235, 0.12)' : 'rgba(15, 23, 42, 0.5)',
          borderRadius: '12px',
          padding: '1.5rem 1.25rem',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".pptx,.ppt,.txt,.md"
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          background: 'rgba(37, 99, 235, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#60a5fa'
        }}>
          {isUploading ? (
            <Layers className="pulsing-ring" size={22} />
          ) : (
            <UploadCloud size={22} />
          )}
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f1f5f9' }}>
            {isUploading ? 'Extracting Presentation Slides...' : 'Upload PowerPoint Presentation'}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            Drop .pptx or .ppt files to extract slides for agent retrieval
          </div>
        </div>

        {uploadError && (
          <div style={{
            fontSize: '0.78rem',
            color: '#f87171',
            background: 'rgba(239, 68, 68, 0.15)',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            marginTop: '0.2rem'
          }}>
            {uploadError}
          </div>
        )}
      </div>

      {/* Uploaded Files List */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.55rem'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Document Grounding ({files.length})
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Select to ground agents
          </div>
        </div>

        {files.length === 0 ? (
          <div style={{
            padding: '1.25rem',
            textAlign: 'center',
            fontSize: '0.82rem',
            color: '#64748b',
            background: 'rgba(15, 23, 42, 0.3)',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            No presentations uploaded yet. Upload a .pptx file above to begin.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '230px', overflowY: 'auto' }}>
            {files.map((file) => {
              const isSelected = selectedFileIds.includes(file.file_id);
              return (
                <div
                  key={file.file_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                    border: isSelected ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    onClick={() => onToggleSelectFile(file.file_id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flex: 1, minWidth: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <div style={{
                      color: file.filename.endsWith('.pptx') ? '#f59e0b' : '#38bdf8',
                      flexShrink: 0
                    }}>
                      <Presentation size={19} />
                    </div>
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{
                        fontWeight: 500,
                        fontSize: '0.84rem',
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {file.original_name || file.filename}
                      </div>
                      <div style={{ display: 'flex', gap: '0.65rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                        <span>{file.slide_count} slides</span>
                        <span>•</span>
                        <span>{file.total_words} words</span>
                        <span>•</span>
                        <span>{formatSize(file.file_size_bytes)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      title="Inspect Extracted Slides"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFile(file.file_id)}
                      title="Remove file"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide Inspection Modal */}
      {previewFile && (
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
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '740px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Presentation size={22} color="#f59e0b" />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                    {previewFile.original_name}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {previewFile.slide_count} extracted slides • Available for RAG retrieval
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#e2e8f0',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.82rem'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(previewFile.slides || []).map((slide) => (
                <div
                  key={slide.slide_number}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '10px',
                    padding: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
                    <span style={{
                      background: 'rgba(37, 99, 235, 0.2)',
                      color: '#93c5fd',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      Slide {slide.slide_number}
                    </span>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f1f5f9' }}>
                      {slide.title}
                    </h4>
                  </div>

                  {slide.bullet_points && slide.bullet_points.length > 0 && (
                    <ul style={{ margin: '0.45rem 0 0.45rem 1.25rem', fontSize: '0.83rem', color: '#cbd5e1' }}>
                      {slide.bullet_points.map((b, idx) => (
                        <li key={idx} style={{ marginBottom: '0.2rem' }}>{b}</li>
                      ))}
                    </ul>
                  )}

                  {slide.content && (!slide.bullet_points || slide.bullet_points.length === 0) && (
                    <p style={{ fontSize: '0.83rem', color: '#94a3b8', whiteSpace: 'pre-line' }}>
                      {slide.content}
                    </p>
                  )}

                  {slide.notes && (
                    <div style={{
                      marginTop: '0.45rem',
                      fontSize: '0.74rem',
                      color: '#fbbf24',
                      background: 'rgba(245, 158, 11, 0.1)',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px'
                    }}>
                      <strong>Speaker Notes:</strong> {slide.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
