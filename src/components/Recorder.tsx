'use client'
import { useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useDraggable } from '@/hooks/useDraggable'

interface Props {
  boardId: string
  userId: string
  cameraStreamRef: React.RefObject<MediaStream | null>
  cameraPositionRef: React.RefObject<{ x: number; y: number; size: number }>
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'uploading'

export default function Recorder({ boardId, userId, cameraStreamRef, cameraPositionRef }: Props) {
  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const { pos, onDragStart } = useDraggable(window.innerWidth - 220, window.innerHeight - 80)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const getExcalidrawCanvas = (): HTMLCanvasElement | null =>
    document.querySelector('.excalidraw__canvas') as HTMLCanvasElement | null

  const startCompositing = (excalidrawCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const composite = document.createElement('canvas')
    composite.width = excalidrawCanvas.width
    composite.height = excalidrawCanvas.height
    compositeCanvasRef.current = composite

    const draw = () => {
      const ctx = composite.getContext('2d')
      if (!ctx) return
      // 先填充白色背景
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, composite.width, composite.height)
      // 读取 Excalidraw 所有 canvas 层并叠加
      const allCanvases = document.querySelectorAll('.excalidraw canvas')
      allCanvases.forEach((canvas) => {
        const c = canvas as HTMLCanvasElement
        if (c.width > 0 && c.height > 0) {
          try {
            ctx.drawImage(c, 0, 0, composite.width, composite.height)
          } catch {
            // 跨域或空 canvas 忽略
          }
        }
      })
      const camStream = cameraStreamRef.current
      if (camStream && camStream.active) {
        // 实时获取或创建 video 元素
        if (!cameraVideoRef.current || cameraVideoRef.current.srcObject !== camStream) {
          const video = document.createElement('video')
          video.srcObject = camStream
          video.autoplay = true
          video.muted = true
          video.playsInline = true
          video.play()
          cameraVideoRef.current = video
        }
        const cameraVideo = cameraVideoRef.current
        if (cameraVideo && cameraVideo.readyState >= 2) {
          // 读取气泡当前位置和大小
          const { x: bubbleX, y: bubbleY, size: bubbleSize } = cameraPositionRef.current
          const diameter = bubbleSize
          const radius = diameter / 2
          // 将屏幕坐标转换为画布坐标（画布可能缩放）
          const scaleX = composite.width / window.innerWidth
          const scaleY = composite.height / window.innerHeight
          const cx = (bubbleX + radius) * scaleX
          const cy = (bubbleY + radius) * scaleY
          const r = radius * Math.min(scaleX, scaleY)

          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.clip()

          const videoAspect = cameraVideo.videoWidth / (cameraVideo.videoHeight || 1)
          let sx = 0, sy = 0, sw = cameraVideo.videoWidth, sh = cameraVideo.videoHeight
          if (videoAspect > 1) {
            sw = cameraVideo.videoHeight
            sx = (cameraVideo.videoWidth - sw) / 2
          } else {
            sh = cameraVideo.videoWidth
            sy = (cameraVideo.videoHeight - sh) / 2
          }
          ctx.drawImage(cameraVideo, sx, sy, sw, sh, cx - r, cy - r, r * 2, r * 2)
          ctx.restore()

          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'
          ctx.lineWidth = 3
          ctx.stroke()
        }
      }
      animFrameRef.current = requestAnimationFrame(draw)
    }
    draw()
    return composite
  }

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const excalidrawCanvas = getExcalidrawCanvas()
      if (!excalidrawCanvas) { setError('找不到画布'); return }

      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      console.log('mic permission:', permissionStatus.state)

      if (permissionStatus.state === 'denied') {
        setError('麦克风权限被拒绝，请在浏览器地址栏左侧点击锁图标开启')
        return
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const composite = startCompositing(excalidrawCanvas)
      const canvasStream = composite.captureStream(30)
      micStream.getAudioTracks().forEach(t => canvasStream.addTrack(t))

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm'
      const recorder = new MediaRecorder(canvasStream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setState('recording')
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch (err) {
      setError('启动失败，请检查麦克风权限')
      console.error(err)
    }
  }, [])

  const pauseRecording = useCallback(() => {
    mediaRecorderRef.current?.pause()
    setState('paused')
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const resumeRecording = useCallback(() => {
    mediaRecorderRef.current?.resume()
    setState('recording')
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
  }, [])

  const stopAndUpload = useCallback(async () => {
    if (!mediaRecorderRef.current) return
    setState('uploading')
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    mediaRecorderRef.current.stop()
    await new Promise<void>(resolve => {
      if (mediaRecorderRef.current) mediaRecorderRef.current.onstop = () => resolve()
      else resolve()
    })
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const filename = `${userId}/${boardId}-${Date.now()}.webm`
    try {
      const { error: uploadError } = await supabase.storage
        .from('recordings').upload(filename, blob, { contentType: 'video/webm' })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(filename)
      await supabase.from('recordings').insert({
        user_id: userId, board_id: boardId,
        storage_path: filename, public_url: urlData.publicUrl,
        duration_seconds: duration,
        title: `录制 ${new Date().toLocaleString('zh-CN')}`,
      })
      setState('idle')
      setDuration(0)
      alert('录制已保存！')
    } catch (err) {
      setError('上传失败，请重试')
      setState('idle')
      console.error(err)
    }
  }, [userId, boardId, duration])

  return (
    <div
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      style={{
        position: 'absolute', left: pos.x, top: pos.y, zIndex: 20,
        background: 'white', border: '1px solid #e5e7eb',
        borderRadius: 12, padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
        minWidth: 190, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        cursor: 'grab', userSelect: 'none',
      }}
    >
      {error && <p style={{ fontSize: '0.7rem', color: '#ef4444', margin: 0 }}>{error}</p>}

      {state !== 'idle' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: state === 'recording' ? '#ef4444' : '#f59e0b',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: '0.85rem', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
            {formatDuration(duration)}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
            {state === 'uploading' ? '上传中...' : state === 'paused' ? '已暂停' : '录制中'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }} onMouseDown={e => e.stopPropagation()}>
        {state === 'idle' && (
          <button onClick={startRecording} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#ef4444', color: 'white', fontSize: '0.8rem',
            cursor: 'pointer', fontWeight: 500,
          }}>● 开始录制</button>
        )}
        {state === 'recording' && (<>
          <button onClick={pauseRecording} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#f3f4f6', color: '#374151', fontSize: '0.8rem', cursor: 'pointer',
          }}>⏸ 暂停</button>
          <button onClick={stopAndUpload} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#e5e7eb', color: '#374151', fontSize: '0.8rem', cursor: 'pointer',
          }}>■ 结束</button>
        </>)}
        {state === 'paused' && (<>
          <button onClick={resumeRecording} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#ef4444', color: 'white', fontSize: '0.8rem', cursor: 'pointer',
          }}>● 继续</button>
          <button onClick={stopAndUpload} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#e5e7eb', color: '#374151', fontSize: '0.8rem', cursor: 'pointer',
          }}>■ 结束</button>
        </>)}
        {state === 'uploading' && (
          <button disabled style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#f3f4f6', color: '#9ca3af', fontSize: '0.8rem', cursor: 'not-allowed',
          }}>上传中...</button>
        )}
      </div>
    </div>
  )
}
