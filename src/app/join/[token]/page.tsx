'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  useEffect(() => {
    const join = async () => {
      // 检查是否已登录
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // 未登录：先登录，登录后回到这个页面
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/join/${token}` },
        })
        return
      }

      // 通过 share_token 找到 board
      const { data: board } = await supabase
        .from('boards')
        .select('id')
        .eq('share_token', token)
        .single()

      if (board) {
        // 将该画布加入用户的 board_members 表
        await supabase.from('board_members').upsert({
          board_id: board.id,
          user_id: session.user.id,
        }, { onConflict: 'board_id,user_id' })
        router.push(`/board/${board.id}`)
      } else {
        router.push('/')
      }
    }
    join()
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <p className="text-white text-xl">正在加入画布...</p>
    </div>
  )
}
