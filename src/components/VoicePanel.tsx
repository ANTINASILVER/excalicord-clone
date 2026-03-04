'use client'
import { useEffect, useState } from 'react'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useDraggable } from '@/hooks/useDraggable'
import { supabase } from '@/lib/supabase'

interface Props {
  boardId: string
  userId: string
  userName: string
  userAvatar: string
}

interface RoomUser {
  userId: string
  userName: string
  userAvatar: string
}

function MicIcon({ active, muted }: { active: boolean; muted: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      style={{ flexShrink: 0, opacity: muted ? 0.3 : 1, transition: 'opacity 0.2s' }}>
      {muted ? (
        <>
          <path d="M12 1a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"
            fill={active ? '#22c55e' : '#9ca3af'} />
          <line x1="2" y1="2" x2="22" y2="22"
            stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M8 21h8M12 17v4" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <path d="M12 1a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"
            fill={active ? '#22c55e' : '#9ca3af'} />
          <path d="M19 10a7 7 0 0 1-14 0" stroke={active ? '#22c55e' : '#9ca3af'}
            strokeWidth="2" strokeLinecap="round"/>
          <path d="M8 21h8M12 17v4" stroke={active ? '#22c55e' : '#9ca3af'}
            strokeWidth="2" strokeLinecap="round"/>
        </>
      )}
    </svg>
  )
}

export default function VoicePanel({ boardId, userId, userName, userAvatar }: Props) {
  const { isMuted, peers, isConnected, join, toggleMute } = useWebRTC(boardId, userId, userName, userAvatar)
  const { pos, onDragStart, wasDragged } = useDraggable(
    typeof window !== 'undefined' ? window.innerWidth / 2 - 100 : 200,
    16
  )
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([])

  // 加载画布内的协作者（从 Supabase presence 或直接用 peers + 自己）
  useEffect(() => {
    // 自己始终在列表里
    setRoomUsers([{ userId, userName, userAvatar }])
  }, [userId, userName, userAvatar])

  // 当 peers 变化时更新房间用户列表
  useEffect(() => {
    setRoomUsers([
      { userId, userName, userAvatar },
      ...peers.map(p => ({ userId: p.userId, userName: p.userName, userAvatar: p.userAvatar }))
    ])
  }, [peers, userId, userName, userAvatar])

  const getSpeakingState = (uid: string) => {
    if (uid === userId) return { isSpeaking: false, isMuted }
    const peer = peers.find(p => p.userId === uid)
    return { isSpeaking: peer?.isSpeaking ?? false, isMuted: peer?.isMuted ?? false }
  }

  return (
    <div
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      style={{
        position: 'absolute', left: pos.x, top: pos.y, zIndex: 25,
        userSelect: 'none', cursor: 'grab',
      }}
    >
      <div style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 24,
        padding: '6px 4px',
        display: 'flex', alignItems: 'center', gap: 4,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        {roomUsers.map((user, i) => {
          const { isSpeaking, isMuted: userMuted } = getSpeakingState(user.userId)
          const isMe = user.userId === userId
          return (
            <div
              key={user.userId}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 10px',
                borderRight: i < roomUsers.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                background: isSpeaking ? 'rgba(34,197,94,0.08)' : 'transparent',
                borderRadius: 14, transition: 'background 0.2s',
              }}
            >
              {/* 头像 */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                overflow: 'hidden', flexShrink: 0,
                border: isSpeaking ? '2px solid #22c55e' : '2px solid transparent',
                transition: 'border-color 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {user.userAvatar
                  ? <img src={user.userAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>
                      {user.userName.charAt(0).toUpperCase()}
                    </span>
                }
              </div>

              {/* 名字 */}
              <span style={{
                fontSize: '0.85rem', color: '#111827', fontWeight: 500,
                maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              }}>
                {user.userName.split(' ')[0]}
              </span>

              {/* 麦克风图标 */}
              {isMe ? (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => {
                    if (!isConnected) join()
                    else toggleMute()
                  }}
                  style={{
                    background: 'none', border: 'none', padding: 2,
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    borderRadius: 6,
                  }}
                  title={!isConnected ? '加入语音' : isMuted ? '取消静音' : '静音'}
                >
                  <MicIcon active={!isMuted && isConnected} muted={!isConnected || isMuted} />
                </button>
              ) : (
                <MicIcon active={isSpeaking} muted={userMuted} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
