'use client'
import { useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useDraggable } from '@/hooks/useDraggable'

interface Props {
  boardId: string
  userId: string
  cameraStream: MediaStream | null
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'uploading'

export default function Recorder({ boardId, userId, cameraStream }: Props) {
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

    let cameraVideo: HTMLVideoElement | null = null
    if (cameraStream) {
      cameraVideo = document.createElement('video')
      cameraVideo.srcObject = cameraStream
      cameraVideo.play()
      cameraVideoRef.current = cameraVideo
    }

    const draw = () => {
      const ctx = composite.getContext('2d')
      if (!ctx) return
      ctx.drawImage(excalidrawCanvas, 0, 0, composite.width, composite.height)
      if (cameraVideo && cameraVideo.readyState >= 2) {
        const camW = Math.floor(composite.width * 0.22)
        const camH = Math.floor(camW * (9 / 16))
        const x = composite.width - camW - 20
        const y = composite.height - camH - 20
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x, y, camW, camH, 12)
        ctx.clip()
        ctx.drawImage(cameraVideo, x, y, camW, camH)
        ctx.restore()
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(x, y, camW, camH, 12)
        ctx.stroke()
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

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
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
  }, [cameraStream])

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
        background: '#1f2937', border: '1px solid #374151',
        borderRadius: 12, padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
        minWidth: 190, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        cursor: 'grab', userSelect: 'none',
      }}
    >
      {error && <p style={{ fontSize: '0.7rem', color: '#f87171', margin: 0 }}>{error}</p>}

      {state !== 'idle' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: state === 'recording' ? '#ef4444' : '#f59e0b',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: '0.85rem', color: '#e5e7eb', fontVariantNumeric: 'tabular-nums' }}>
            {formatDuration(duration)}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
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
            background: '#374151', color: 'white', fontSize: '0.8rem', cursor: 'pointer',
          }}>⏸ 暂停</button>
          <button onClick={stopAndUpload} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#6b7280', color: 'white', fontSize: '0.8rem', cursor: 'pointer',
          }}>■ 结束</button>
        </>)}
        {state === 'paused' && (<>
          <button onClick={resumeRecording} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#ef4444', color: 'white', fontSize: '0.8rem', cursor: 'pointer',
          }}>● 继续</button>
          <button onClick={stopAndUpload} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#6b7280', color: 'white', fontSize: '0.8rem', cursor: 'pointer',
          }}>■ 结束</button>
        </>)}
        {state === 'uploading' && (
          <button disabled style={{
            flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
            background: '#374151', color: '#6b7280', fontSize: '0.8rem', cursor: 'not-allowed',
          }}>上传中...</button>
        )}
      </div>
    </div>
  )
}
