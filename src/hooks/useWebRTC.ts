import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface PeerState {
  userId: string
  userName: string
  userAvatar: string
  isSpeaking: boolean
  isMuted: boolean
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export function useWebRTC(boardId: string, userId: string, userName: string, userAvatar: string) {
  const [isMuted, setIsMuted] = useState(true)
  const [peers, setPeers] = useState<PeerState[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const speakingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const speakingCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 检测本地说话状态
  const startSpeakingDetection = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    audioContextRef.current = ctx
    analyserRef.current = analyser

    const data = new Uint8Array(analyser.frequencyBinCount)
    speakingCheckRef.current = setInterval(() => {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      const speaking = avg > 15
      channelRef.current?.send({
        type: 'broadcast',
        event: 'speaking-state',
        payload: { userId, speaking },
      })
    }, 200)
  }, [userId])

  const createPeerConnection = useCallback((remoteUserId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS)

    // 添加本地音频轨道
    localStreamRef.current?.getAudioTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!)
    })

    // 收到远端音频
    pc.ontrack = (event) => {
      const audio = new Audio()
      audio.srcObject = event.streams[0]
      audio.autoplay = true
      audio.play().catch(console.error)
    }

    // ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { userId, targetUserId: remoteUserId, candidate: event.candidate },
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        peerConnectionsRef.current.delete(remoteUserId)
        setPeers(prev => prev.filter(p => p.userId !== remoteUserId))
      }
    }

    peerConnectionsRef.current.set(remoteUserId, pc)
    return pc
  }, [userId])

  const initiateCall = useCallback(async (remoteUserId: string, remoteUserName: string, remoteUserAvatar: string) => {
    const pc = createPeerConnection(remoteUserId)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'webrtc-offer',
      payload: { userId, userName, userAvatar, targetUserId: remoteUserId, offer },
    })
    setPeers(prev => {
      if (prev.find(p => p.userId === remoteUserId)) return prev
      return [...prev, { userId: remoteUserId, userName: remoteUserName, userAvatar: remoteUserAvatar, isSpeaking: false, isMuted: false }]
    })
  }, [userId, userName, userAvatar, createPeerConnection])

  const join = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      // 默认静音
      stream.getAudioTracks().forEach(t => { t.enabled = false })
      // isMuted 初始为 true，enabled = false 表示静音，这是正确的
      localStreamRef.current = stream
      startSpeakingDetection(stream)
      setIsConnected(true)

      const channel = supabase.channel(`webrtc:${boardId}`, {
        config: { broadcast: { self: false } },
      })

      // 收到 offer
      channel.on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.targetUserId !== userId) return
        const pc = createPeerConnection(payload.userId)
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        channelRef.current?.send({
          type: 'broadcast',
          event: 'webrtc-answer',
          payload: { userId, targetUserId: payload.userId, answer },
        })
        setPeers(prev => {
          if (prev.find(p => p.userId === payload.userId)) return prev
          return [...prev, { userId: payload.userId, userName: payload.userName, userAvatar: payload.userAvatar, isSpeaking: false, isMuted: false }]
        })
      })

      // 收到 answer
      channel.on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (payload.targetUserId !== userId) return
        const pc = peerConnectionsRef.current.get(payload.userId)
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
      })

      // 收到 ICE candidate
      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.targetUserId !== userId) return
        const pc = peerConnectionsRef.current.get(payload.userId)
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
      })

      // 收到说话状态
      channel.on('broadcast', { event: 'speaking-state' }, ({ payload }) => {
        setPeers(prev => prev.map(p =>
          p.userId === payload.userId ? { ...p, isSpeaking: payload.speaking } : p
        ))
      })

      // 收到静音状态变化
      channel.on('broadcast', { event: 'mute-state' }, ({ payload }) => {
        setPeers(prev => prev.map(p =>
          p.userId === payload.userId ? { ...p, isMuted: payload.isMuted } : p
        ))
      })

      // 有新用户加入
      channel.on('broadcast', { event: 'user-joined-voice' }, ({ payload }) => {
        if (payload.userId === userId) return
        initiateCall(payload.userId, payload.userName, payload.userAvatar)
        // 更新对方的初始静音状态
        setPeers(prev => prev.map(p =>
          p.userId === payload.userId ? { ...p, isMuted: payload.isMuted ?? true } : p
        ))
      })

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 通知其他人我加入了
          channel.send({
            type: 'broadcast',
            event: 'user-joined-voice',
            payload: { userId, userName, userAvatar, isMuted: true },
          })
        }
      })

      channelRef.current = channel
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          console.error('麦克风权限被拒绝')
        } else if (err.name === 'NotFoundError') {
          console.error('没有找到麦克风设备')
        } else {
          console.error('WebRTC join error:', err)
        }
      }
    }
  }, [boardId, userId, userName, userAvatar, createPeerConnection, initiateCall, startSpeakingDetection])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const tracks = stream.getAudioTracks()
    const currentlyMuted = !tracks[0]?.enabled
    const newMuted = !currentlyMuted
    tracks.forEach(t => { t.enabled = !newMuted })
    setIsMuted(newMuted)
    // 广播静音状态给所有人
    channelRef.current?.send({
      type: 'broadcast',
      event: 'mute-state',
      payload: { userId, isMuted: newMuted },
    })
    if (newMuted) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'speaking-state',
        payload: { userId, speaking: false },
      })
    }
  }, [userId])

  // 离开时清理
  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach(pc => pc.close())
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      channelRef.current?.unsubscribe()
      if (speakingCheckRef.current) clearInterval(speakingCheckRef.current)
      audioContextRef.current?.close()
    }
  }, [])

  return { isMuted, peers, isConnected, join, toggleMute }
}
