'use client'
import { useEffect, useRef, useState } from 'react'
import { useDraggable } from '@/hooks/useDraggable'
import { usePinchZoom } from '@/hooks/usePinchZoom'

interface Props {
  onStreamChange?: (stream: MediaStream | null) => void
  onPositionChange?: (x: number, y: number, size: number) => void
}

export default function CameraFloat({ onStreamChange, onPositionChange }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [size, setSize] = useState(120)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { pos, onDragStart, wasDragged, setPos } = useDraggable(
    typeof window !== 'undefined' ? window.innerWidth - 160 : 200,
    typeof window !== 'undefined' ? window.innerHeight - 200 : 400
  )
  const containerRef = useRef<HTMLDivElement | null>(null)
  usePinchZoom(containerRef, size, setSize, 60, 300)

  useEffect(() => {
    onPositionChange?.(pos.x, pos.y, size)
  }, [pos.x, pos.y, size])

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
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [enabled])

  // 8方向 resize handle
  const resizeHandles = [
    { cursor: 'n-resize',  top: 0,    left: 8,   right: 8,  height: 8,  dir: 'n' },
    { cursor: 's-resize',  bottom: 0, left: 8,   right: 8,  height: 8,  dir: 's' },
    { cursor: 'w-resize',  left: 0,   top: 8,    bottom: 8, width: 8,   dir: 'w' },
    { cursor: 'e-resize',  right: 0,  top: 8,    bottom: 8, width: 8,   dir: 'e' },
    { cursor: 'nw-resize', top: 0,    left: 0,   width: 16, height: 16, dir: 'nw' },
    { cursor: 'ne-resize', top: 0,    right: 0,  width: 16, height: 16, dir: 'ne' },
    { cursor: 'sw-resize', bottom: 0, left: 0,   width: 16, height: 16, dir: 'sw' },
    { cursor: 'se-resize', bottom: 0, right: 0,  width: 16, height: 16, dir: 'se' },
  ]

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
        <div
          ref={containerRef}
          data-floating="true"
          style={{ position: 'relative', width: size, height: size }}
        >
          {/* 圆形视频 */}
          <div style={{
            width: size, height: size, borderRadius: '50%',
            overflow: 'hidden', border: '3px solid rgba(0,0,0,0.15)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <video
              ref={videoRef}
              autoPlay muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
          </div>

          {/* 关闭按钮 */}
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

          {/* 8方向 resize handles */}
          {resizeHandles.map(({ cursor, dir, ...style }) => (
            <div
              key={dir}
              onMouseDown={e => {
                e.stopPropagation()
                e.preventDefault()
                const startX = e.clientX
                const startY = e.clientY
                const startSize = size
                const startPosX = pos.x
                const startPosY = pos.y
                const onMove = (ev: MouseEvent) => {
                  const dx = ev.clientX - startX
                  const dy = ev.clientY - startY
                  let delta = 0
                  if (dir === 'e' || dir === 'se' || dir === 'ne') delta = dx
                  else if (dir === 'w' || dir === 'sw' || dir === 'nw') delta = -dx
                  else if (dir === 's') delta = dy
                  else if (dir === 'n') delta = -dy
                  const newSize = Math.max(60, Math.min(300, startSize + delta))
                  setSize(newSize)
                  if (dir.includes('w')) setPos({ x: startPosX + (startSize - newSize), y: pos.y })
                  if (dir.includes('n')) setPos({ x: pos.x, y: startPosY + (startSize - newSize) })
                }
                const onUp = () => {
                  document.removeEventListener('mousemove', onMove)
                  document.removeEventListener('mouseup', onUp)
                }
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
              style={{
                position: 'absolute', cursor, zIndex: 10,
                ...style,
              }}
            />
          ))}
        </div>
      ) : (
        <button
          onClick={() => { if (!wasDragged()) setEnabled(true) }}
          onMouseDown={e => e.stopPropagation()}
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
