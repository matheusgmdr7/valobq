import React from 'react';
import { PerformanceStats } from '../../engine/webgl/PerformanceMonitor';

interface PerformanceOverlayProps {
  stats: PerformanceStats;
  visible: boolean;
}

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({ stats, visible }) => {
  if (!visible) return null;

  const formatNumber = (value: number, decimals = 1): string => {
    return value.toFixed(decimals);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFpsColor = (fps: number): string => {
    if (fps >= 55) return '#10B981'; // green
    if (fps >= 30) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  const getFrameTimeColor = (ms: number): string => {
    if (ms <= 16.67) return '#10B981'; // green (< 60fps)
    if (ms <= 33.33) return '#F59E0B'; // yellow (< 30fps)
    return '#EF4444'; // red
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        width: '280px',
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderRadius: '10px',
        border: '1px solid rgba(71,85,105,0.35)',
        padding: '14px 16px',
        color: '#E2E8F0',
        fontSize: '11px',
        lineHeight: 1.5,
        boxShadow: '0 16px 32px rgba(15,23,42,0.45)',
        backdropFilter: 'blur(8px)',
        fontFamily: 'monospace',
        zIndex: 1000
      }}
    >
      <div
        style={{
          fontSize: '10px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#94A3B8',
          marginBottom: '10px',
          fontWeight: 600
        }}
      >
        Performance Metrics
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#CBD5F5' }}>FPS:</span>
          <span style={{ color: getFpsColor(stats.current.fps), fontWeight: 600 }}>
            {formatNumber(stats.current.fps)} / {formatNumber(stats.average.fps)} avg
          </span>
        </div>
        <div style={{ fontSize: '9px', color: '#64748B', marginLeft: '8px' }}>
          min: {formatNumber(stats.min.fps)} | max: {formatNumber(stats.max.fps)}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#CBD5F5' }}>Frame Time:</span>
          <span style={{ color: getFrameTimeColor(stats.current.frameTime), fontWeight: 600 }}>
            {formatNumber(stats.current.frameTime)} ms
          </span>
        </div>
        <div style={{ fontSize: '9px', color: '#64748B', marginLeft: '8px' }}>
          avg: {formatNumber(stats.average.frameTime)} | max: {formatNumber(stats.max.frameTime)}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#CBD5F5' }}>Draw Calls:</span>
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>
            {stats.current.drawCalls}
          </span>
        </div>
        <div style={{ fontSize: '9px', color: '#64748B', marginLeft: '8px' }}>
          avg: {formatNumber(stats.average.drawCalls)} | max: {stats.max.drawCalls}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#CBD5F5' }}>Vertices:</span>
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>
            {stats.current.vertices.toLocaleString()}
          </span>
        </div>
        <div style={{ fontSize: '9px', color: '#64748B', marginLeft: '8px' }}>
          avg: {formatNumber(stats.average.vertices)} | max: {stats.max.vertices.toLocaleString()}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#CBD5F5' }}>Triangles:</span>
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>
            {stats.current.triangles.toLocaleString()}
          </span>
        </div>
        <div style={{ fontSize: '9px', color: '#64748B', marginLeft: '8px' }}>
          avg: {formatNumber(stats.average.triangles)} | max: {stats.max.triangles.toLocaleString()}
        </div>
      </div>

      {stats.current.bufferSize > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#CBD5F5' }}>Buffer Size:</span>
            <span style={{ color: '#E2E8F0', fontWeight: 600 }}>
              {formatBytes(stats.current.bufferSize)}
            </span>
          </div>
          <div style={{ fontSize: '9px', color: '#64748B', marginLeft: '8px' }}>
            avg: {formatBytes(stats.average.bufferSize)} | max: {formatBytes(stats.max.bufferSize)}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(71,85,105,0.35)',
          fontSize: '9px',
          color: '#64748B',
          textAlign: 'center'
        }}
      >
        Samples: {stats.samples} frames
      </div>
    </div>
  );
};

