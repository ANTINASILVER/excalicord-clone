import { useRef, useEffect, useState } from 'react'

export function useDraggable(initialX: number, initialY: number) {
  const [pos, setPos] = useState({ x: initialX, y: initialY })
  const dragging = useRef(false)
  const didDrag = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return
      e.stopPropagation()
      e.preventDefault()
      didDrag.current = true
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 100, clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, clientY - offset.current.y)),
      })
    }
    const onUp = () => { dragging.current = false }
    document.addEventListener('mousemove', onMove, { capture: true })
    document.addEventListener('mouseup', onUp, { capture: true })
    document.addEventListener('touchmove', onMove, { capture: true, passive: false })
    document.addEventListener('touchend', onUp, { capture: true })
    return () => {
      document.removeEventListener('mousemove', onMove, { capture: true })
      document.removeEventListener('mouseup', onUp, { capture: true })
      document.removeEventListener('touchmove', onMove, { capture: true })
      document.removeEventListener('touchend', onUp, { capture: true })
    }
  }, [])

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    dragging.current = true
    didDrag.current = false
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    offset.current = { x: clientX - pos.x, y: clientY - pos.y }
  }

  const wasDragged = () => {
    const result = didDrag.current
    didDrag.current = false
    return result
  }

  return { pos, ref, onDragStart, wasDragged }
}
