'use client'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import Recorder from './Recorder'
import CameraFloat from './CameraFloat'

function ShareButton({ boardId }: { boardId: string }) {
  const [copied, setCopied] = useState(false)
  const shareLinkRef = useRef<string | null>(null)

  // 组件挂载时提前获取 share_token，缓存起来
  useEffect(() => {
    supabase
      .from('boards')
      .select('share_token')
      .eq('id', boardId)
      .single()
      .then(({ data }) => {
        if (data?.share_token) {
          shareLinkRef.current = `${window.location.origin}/join/${data.share_token}`
        }
      })
  }, [boardId])

  const handleShare = () => {
    if (!shareLinkRef.current) return
    navigator.clipboard.writeText(shareLinkRef.current).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleShare}
      style={{
        fontSize: '0.75rem', padding: '4px 10px', borderRadius: '999px',
        background: copied ? '#22c55e22' : '#6366f122',
        color: copied ? '#22c55e' : '#818cf8',
        border: '1px solid currentColor',
        cursor: 'pointer',
      }}
    >
      {copied ? '✓ 链接已复制' : '分享'}
    </button>
  )
}

interface CollabUser {
  userId: string
  userName: string
  userAvatar: string
  cursorX: number
  cursorY: number
}

interface Props {
  boardId: string
}

export default function ExcalidrawWrapper({ boardId }: Props) {
  const [initialData, setInitialData] = useState<{
    elements: readonly ExcalidrawElement[]
    appState: Partial<AppState>
  } | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [collabUsers, setCollabUsers] = useState<CollabUser[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boardIdRef = useRef<string | null>(null)
  const userRef = useRef<{ id: string; name: string; avatar: string } | null>(null)
  const prevElementsRef = useRef<string>('[]')
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isRemoteUpdateRef = useRef(false)

  // 加载画布 + 初始化协作
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      userRef.current = {
        id: session.user.id,
        name: session.user.user_metadata.full_name ?? 'Anonymous',
        avatar: session.user.user_metadata.avatar_url ?? '',
      }
      setUserId(session.user.id)

      // 加载 board
      const { data } = await supabase
        .from('boards')
        .select('id, elements, app_state')
        .eq('id', boardId)
        .single()

      if (data) {
        boardIdRef.current = data.id
        setInitialData({
          elements: data.elements ?? [],
          appState: data.app_state ?? {},
        })
      }

      // 初始化 Realtime 频道
      boardIdRef.current = boardId
      setupRealtime(boardId, session.user.id)
    }
    init()

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [boardId])

  const setupRealtime = useCallback((boardId: string, userId: string) => {
    const channel = supabase.channel(`board:${boardId}`, {
      config: { broadcast: { self: false } },
    })

    // 收到其他人的画布变化
    channel.on('broadcast', { event: 'elements-update' }, ({ payload }) => {
      if (payload.userId === userId) return
      const api = excalidrawAPIRef.current
      if (!api) return
      const localElements = api.getSceneElements()
      const merged = mergeElements(localElements, payload.elements)
      // 只有真正有差异才更新，避免不必要的重渲染
      const mergedJSON = JSON.stringify(merged)
      const localJSON = JSON.stringify(localElements)
      if (mergedJSON === localJSON) return
      isRemoteUpdateRef.current = true
      api.updateScene({ elements: merged })
      setTimeout(() => { isRemoteUpdateRef.current = false }, 50)
    })

    // 收到其他人的光标位置
    channel.on('broadcast', { event: 'cursor-move' }, ({ payload }) => {
      if (payload.userId === userId) return
      setCollabUsers(prev => {
        const others = prev.filter(u => u.userId !== payload.userId)
        return [...others, payload as CollabUser]
      })
    })

    // Presence：追踪在线用户
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      const leftIds = leftPresences
        .map((p) => (p as { current?: { userId?: string }; userId?: string }).current?.userId ?? (p as { userId?: string }).userId)
        .filter(Boolean) as string[]
      setCollabUsers(prev => prev.filter(u => !leftIds.includes(u.userId)))
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && userRef.current) {
        await channel.track({ userId: userRef.current.id })
      }
    })

    channelRef.current = channel
  }, [])

  const mergeElements = (
    local: readonly ExcalidrawElement[],
    remote: ExcalidrawElement[]
  ): ExcalidrawElement[] => {
    const localMap = new Map(local.map(el => [el.id, el]))
    const remoteMap = new Map(remote.map(el => [el.id, el]))
    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

    const merged: ExcalidrawElement[] = []
    allIds.forEach(id => {
      const localEl = localMap.get(id)
      const remoteEl = remoteMap.get(id)
      if (localEl && remoteEl) {
        // 两边都有：保留 version 更高的
        merged.push(localEl.version >= remoteEl.version ? localEl : remoteEl)
      } else if (localEl) {
        merged.push(localEl)
      } else if (remoteEl) {
        merged.push(remoteEl)
      }
    })
    return merged
  }

  // 保存到数据库
  const save = useCallback(async (
    elements: readonly ExcalidrawElement[],
    appState: AppState
  ) => {
    if (!boardIdRef.current) return
    setSaveStatus('saving')
    const { collaborators: _c, ...appStateToSave } = appState as AppState & { collaborators?: unknown }
    const { error } = await supabase
      .from('boards')
      .update({ elements, app_state: appStateToSave })
      .eq('id', boardIdRef.current)
    setSaveStatus(error ? 'unsaved' : 'saved')
  }, [])

  // 广播元素变化 + 触发保存
  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: AppState
  ) => {
    if (isRemoteUpdateRef.current) return
    const elementsJSON = JSON.stringify(elements)
    if (elementsJSON === prevElementsRef.current) return
    prevElementsRef.current = elementsJSON

    // 广播给其他人
    channelRef.current?.send({
      type: 'broadcast',
      event: 'elements-update',
      payload: { userId: userRef.current?.id, elements },
    })

    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => save(elements, appState), 1500)
  }, [save])

  // 广播光标位置
  const handlePointerUpdate = useCallback((payload: {
    pointer: { x: number; y: number }
  }) => {
    if (!userRef.current) return
    channelRef.current?.send({
      type: 'broadcast',
      event: 'cursor-move',
      payload: {
        userId: userRef.current.id,
        userName: userRef.current.name,
        userAvatar: userRef.current.avatar,
        cursorX: payload.pointer.x,
        cursorY: payload.pointer.y,
      },
    })
  }, [])

  if (initialData === null) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '1.2rem' }}>加载画布中...</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* 保存状态 */}
      <div style={{
        position: 'absolute', top: 12, right: 16, zIndex: 10,
        fontSize: '0.75rem', padding: '4px 10px', borderRadius: '999px',
        background: saveStatus === 'saved' ? '#22c55e22' : saveStatus === 'saving' ? '#f59e0b22' : '#ef444422',
        color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'saving' ? '#f59e0b' : '#ef4444',
        border: '1px solid currentColor',
        pointerEvents: 'none',
      }}>
        {saveStatus === 'saved' ? '✓ 已保存' : saveStatus === 'saving' ? '保存中...' : '未保存'}
      </div>

      {/* 分享按钮 */}
      <div style={{
        position: 'absolute', top: 12, right: 120, zIndex: 10,
      }}>
        <ShareButton boardId={boardId} />
      </div>

      {userId && (
        <>
          <CameraFloat onStreamChange={setCameraStream} />
          <Recorder boardId={boardId} userId={userId} cameraStream={cameraStream} />
        </>
      )}

      {/* 在线用户头像列表 */}
      {collabUsers.length > 0 && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', gap: 6,
        }}>
          {collabUsers.map(u => (
            <div key={u.userId} title={u.userName} style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#6366f1', border: '2px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', color: 'white', overflow: 'hidden',
            }}>
              {u.userAvatar
                ? <img src={u.userAvatar} alt={u.userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : u.userName.charAt(0).toUpperCase()
              }
            </div>
          ))}
        </div>
      )}

      <Excalidraw
        excalidrawAPI={(api) => { excalidrawAPIRef.current = api }}
        initialData={initialData}
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
      />
    </div>
  )
}
