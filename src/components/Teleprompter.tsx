'use client'
import { useRef, useState, useEffect } from 'react'
import { useDraggable } from '@/hooks/useDraggable'

export default function Teleprompter() {
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')
  const [opacity, setOpacity] = useState(0.95)
  const [speed, setSpeed] = useState(1)
  const [scrolling, setScrolling] = useState(false)
  const [width, setWidth] = useState(400)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const animRef = useRef<number | null>(null)
  const { pos, onDragStart } = useDraggable(
    typeof window !== 'undefined' ? window.innerWidth / 2 - 200 : 200,
    typeof window !== 'undefined' ? window.innerHeight - 320 : 400
  )

  useEffect(() => {
    if (scrolling && scrollRef.current) {
      const step = () => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += speed * 0.5
          if (scrollRef.current.scrollTop + scrollRef.current.clientHeight >= scrollRef.current.scrollHeight) {
            setScrolling(false)
            return
          }
        }
        animRef.current = requestAnimationFrame(step)
      }
      animRef.current = requestAnimationFrame(step)
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [scrolling, speed])

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        style={{
          position: 'absolute', bottom: 20, left: 20, zIndex: 25,
          height: 36, padding: '0 14px', borderRadius: 18,
          background: 'white', border: '1px solid #e5e7eb',
          color: '#374151', fontSize: '0.75rem', fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          whiteSpace: 'nowrap',
        }}
        title="提词器"
      >提词器</button>
    )
  }

  return (
    <div
      style={{
        position: 'absolute', left: pos.x, top: pos.y, zIndex: 25,
        width, background: `rgba(255,255,255,${opacity})`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        border: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* 标题栏（拖拽区） */}
      <div
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        style={{
          padding: '8px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
          cursor: 'grab', flexShrink: 0,
        }}
      >
        <span style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 500 }}>提词器</span>
        <div style={{ display: 'flex', gap: 6 }} onMouseDown={e => e.stopPropagation()}>
          <button
            onClick={() => setVisible(false)}
            style={{
              width: 20, height: 20, borderRadius: '50%', border: '1px solid #e5e7eb',
              background: 'white', color: '#9ca3af',
              fontSize: '0.65rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      </div>

      {/* 文字区 */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', minHeight: 160 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="在此输入提词内容..."
          onMouseDown={e => e.stopPropagation()}
          style={{
            width: '100%', minHeight: 140, background: 'transparent',
            border: 'none', outline: 'none', resize: 'none',
            color: '#111827', fontSize: '1rem', lineHeight: 1.7,
            fontFamily: 'inherit', boxSizing: 'border-box',
            cursor: 'text',
          }}
        />
      </div>

      {/* 控制栏 */}
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          padding: '8px 12px', background: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#9ca3af', fontSize: '0.68rem', width: 36 }}>透明度</span>
          <input type="range" min={0.3} max={1} step={0.05} value={opacity}
            onChange={e => setOpacity(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#6366f1' }} />
          <span style={{ color: '#9ca3af', fontSize: '0.68rem', width: 28, textAlign: 'right' }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#9ca3af', fontSize: '0.68rem', width: 36 }}>速度</span>
          <input type="range" min={0.2} max={5} step={0.2} value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#6366f1' }} />
          <span style={{ color: '#9ca3af', fontSize: '0.68rem', width: 28, textAlign: 'right' }}>
            {speed.toFixed(1)}x
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#9ca3af', fontSize: '0.68rem', width: 36 }}>宽度</span>
          <input type="range" min={260} max={700} step={10} value={width}
            onChange={e => setWidth(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#6366f1' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <button
            onClick={() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 7,
              border: '1px solid #e5e7eb', background: 'white',
              color: '#374151', fontSize: '0.75rem', cursor: 'pointer',
            }}
          >↑ 回顶</button>
          <button
            onClick={() => setScrolling(s => !s)}
            style={{
              flex: 2, padding: '5px 0', borderRadius: 7, border: 'none',
              background: scrolling ? '#ef4444' : '#6366f1',
              color: 'white', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500,
            }}
          >{scrolling ? '⏸ 暂停滚动' : '▶ 开始滚动'}</button>
        </div>
      </div>
    </div>
  )
}
