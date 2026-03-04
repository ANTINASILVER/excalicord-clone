import { useEffect, useRef, RefObject } from 'react'

export function usePinchZoom(
  containerRef: RefObject<HTMLElement | null>,
  size: number,
  setSize: (size: number) => void,
  min: number,
  max: number
) {
  const sizeRef = useRef(size)
  useEffect(() => { sizeRef.current = size }, [size])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let initialDistance = 0
    let initialSize = 0
    let isPinching = false

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.stopPropagation()
        isPinching = true
        initialDistance = getDistance(e.touches)
        initialSize = sizeRef.current
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching) {
        e.stopPropagation()
        e.preventDefault()
        const currentDistance = getDistance(e.touches)
        if (initialDistance === 0) return
        const scale = currentDistance / initialDistance
        const newSize = Math.max(min, Math.min(max, Math.round(initialSize * scale)))
        setSize(newSize)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) isPinching = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [containerRef, setSize, min, max])
}
