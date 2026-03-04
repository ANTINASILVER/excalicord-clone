import { useEffect, RefObject } from 'react'

export function usePinchZoom(
  containerRef: RefObject<HTMLElement | null>,
  size: number,
  setSize: (size: number) => void,
  min: number,
  max: number
) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let initialDistance = 0
    let initialSize = size

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches)
        initialSize = size
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.stopPropagation()
        e.preventDefault()
        const currentDistance = getDistance(e.touches)
        const scale = currentDistance / initialDistance
        const newSize = Math.max(min, Math.min(max, Math.round(initialSize * scale)))
        setSize(newSize)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [size, setSize, min, max])
}
