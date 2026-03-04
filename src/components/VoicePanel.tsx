'use client'
import { useEffect } from 'react'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useDraggable } from '@/hooks/useDraggable'

interface Props {
  boardId: string
  userId: string
  userName: string
  userAvatar: string
}

export default function VoicePanel({ boardId, userId, userName, userAvatar }: Props) {
  const { isMuted, peers, isConnected, join, toggleMute } = useWebRTC(boardId, userId, userName, userAvatar)
  const { pos, onDragStart, wasDragged } = useDraggable(
    typeof window !== 'undefined' ? 20 : 20,
    typeof window !== 'undefined' ? window.innerHeight - 160 : 400
  )

  useEffect(() => {
    join()
  }, [join])

  const activePeers = peers.filter(p => p.isSpeaking)

  return (
    <div
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      style={{
        position: 'absolute', left: pos.x, top: pos.y, zIndex: 25,
        userSelect: 'none', cursor: 'grab',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      {/* 静音切换按钮 */}
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={() => { if (!wasDragged()) toggleMute() }}
        style={{
          height: 36, padding: '0 14px', borderRadius: 18,
          background: isMuted ? 'white' : '#6366f1',
          border: '1px solid #e5e7eb',
          color: isMuted ? '#374151' : 'white',
          fontSize: '0.75rem', fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        {isMuted ? '🔇 静音中' : '🎙️ 说话中'}
      </button>

      {/* 协作者语音状态 */}
      {peers.length > 0 && (
        <div style={{
          background: 'white', border: '1px solid #e5e7eb',
          borderRadius: 12, padding: '8px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', gap: 6,
          minWidth: 160,
        }}
        onMouseDown={e => e.stopPropagation()}
        >
          {peers.map(peer => (
            <div key={peer.userId} style={{
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {/* 头像 */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: '#6366f1', overflow: 'hidden', flexShrink: 0,
                border: peer.isSpeaking ? '2px solid #22c55e' : '2px solid transparent',
                transition: 'border-color 0.15s',
              }}>
                {peer.userAvatar
                  ? <img src={peer.userAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.65rem' }}>
                      {peer.userName.charAt(0).toUpperCase()}
                    </div>
                }
              </div>
              {/* 名字 */}
              <span style={{ fontSize: '0.75rem', color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {peer.userName}
              </span>
              {/* 说话指示 */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: peer.isSpeaking ? '#22c55e' : '#e5e7eb',
                transition: 'background 0.15s',
                flexShrink: 0,
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
