'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const ExcalidrawWrapper = dynamic(
  () => import('@/components/ExcalidrawWrapper'),
  { ssr: false }
)

export default function BoardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const params = useParams()
  const router = useRouter()
  const boardId = params?.id as string

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (!session) router.push('/')
    })
  }, [router])

  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        const target = e.target as HTMLElement
        // 如果触摸目标在我们的浮动组件内，不阻止（让组件自己处理）
        if (target.closest('[data-floating]')) return
        e.preventDefault()
      }
    }
    document.addEventListener('touchmove', preventZoom, { passive: false })
    return () => document.removeEventListener('touchmove', preventZoom)
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-xl">加载中...</p>
    </div>
  )

  if (!user) return null

  return <ExcalidrawWrapper boardId={boardId} />
}
