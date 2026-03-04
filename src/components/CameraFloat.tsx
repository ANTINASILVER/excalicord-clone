'use client'
import { useEffect, useRef, useState } from 'react'
import { useDraggable } from '@/hooks/useDraggable'

interface Props {
  onStreamChange?: (stream: MediaStream | null) => void
}

export default function CameraFloat({ onStreamChange }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [size, setSize] = useState(120)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { pos, onDragStart, wasDragged } = useDraggable(window.innerWidth - 160, window.innerHeight - 200)

  useEffect(() => {
    if (enabled) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          streamRef.current = stream
          if (videoRef.current) videoRef.current.srcObject = stream
          onStreamChange?.(stream)
        })
        .catch(() => setEnabled(false))
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      onStreamChange?.(null)
    }
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [enabled])

  return (
    <div
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      style={{
        position: 'absolute', left: pos.x, top: pos.y,
        zIndex: 25, userSelect: 'none', cursor: 'grab',
      }}
    >
      {enabled ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div
            style={{
              width: size, height: size, borderRadius: '50%',
              overflow: 'hidden', border: '3px solid rgba(0,0,0,0.15)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
          </div>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setEnabled(false)}
            style={{
              position: 'absolute', top: -8, right: -8,
              width: 24, height: 24, borderRadius: '50%',
              background: 'white', border: '1px solid #e5e7eb',
              color: '#6b7280', fontSize: '0.65rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)', zIndex: 10,
            }}
          >✕</button>
          <div style={{
            position: 'absolute', bottom: -28, left: '50%',
            transform: 'translateX(-50%)', width: size * 0.9,
          }}>
            <input
              type="range" min={80} max={240} value={size}
              onChange={e => setSize(Number(e.target.value))}
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#6366f1' }}
            />
          </div>
        </div>
      ) : (
        <button
          onClick={() => { if (!wasDragged()) setEnabled(true) }}
          style={{
            height: 36, padding: '0 14px', borderRadius: 18,
            background: 'white', border: '1px solid #e5e7eb',
            color: '#374151', fontSize: '1rem',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'PingFang SC, 苹方, sans-serif',
          }}
          title="开启摄像头"
        >◉</button>
      )}
    </div>
  )
}
