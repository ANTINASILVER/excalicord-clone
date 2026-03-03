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
        <div
          style={{
            width: size, height: size, borderRadius: '50%',
            overflow: 'hidden', border: '3px solid rgba(255,255,255,0.7)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            cursor: 'grab', position: 'relative',
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
          {/* 关闭按钮 */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setEnabled(false)}
            style={{
              position: 'absolute', top: 4, right: 4,
              width: 20, height: 20, borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)', border: 'none',
              color: 'white', fontSize: '0.6rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
          {/* 调整大小 */}
          <input
            type="range" min={80} max={240} value={size}
            onMouseDown={e => e.stopPropagation()}
            onChange={e => setSize(Number(e.target.value))}
            style={{
              position: 'absolute', bottom: -18, left: '50%',
              transform: 'translateX(-50%)', width: size * 0.8,
              opacity: 0.7,
            }}
          />
        </div>
      ) : (
        <button
          onClick={() => setEnabled(true)}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#1f2937', border: '1px solid #374151',
            color: '#9ca3af', fontSize: '1.2rem', cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="开启摄像头"
        >
          📷
        </button>
      )}
    </div>
  )
}
