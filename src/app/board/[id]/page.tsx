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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-xl">加载中...</p>
    </div>
  )

  if (!user) return null

  return <ExcalidrawWrapper boardId={boardId} />
}
