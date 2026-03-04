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
  const { pos, onDragStart } = useDraggable(window.innerWidth - 160, window.innerHeight - 200)

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
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: 25, userSelect: 'none' }}>
      {enabled ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* 可拖拽气泡 */}
          <div
            style={{
              width: size, height: size, borderRadius: '50%',
              overflow: 'hidden', border: '3px solid rgba(0,0,0,0.15)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              cursor: 'grab',
            }}
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
          </div>

          {/* 关闭按钮，在气泡外右上角 */}
          <button
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

          {/* 大小调节滑块，在气泡正下方 */}
          <div style={{
            position: 'absolute', bottom: -28, left: '50%',
            transform: 'translateX(-50%)', width: size * 0.9,
            display: 'flex', alignItems: 'center',
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
          onClick={() => setEnabled(true)}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'white', border: '1px solid #e5e7eb',
            color: '#374151', fontSize: '1.1rem', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="开启摄像头"
        >
          摄像头
        </button>
      )}
    </div>
  )
}
