'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface Board {
  id: string
  title: string
  updated_at: string
  share_token: string
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [boards, setBoards] = useState<Board[]>([])
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) loadBoards(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadBoards(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadBoards = async (userId: string) => {
    const { data } = await supabase
      .from('boards')
      .select('id, title, updated_at, share_token')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    setBoards(data ?? [])
  }

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setBoards([])
  }

  const createBoard = async () => {
    if (!user || !newTitle.trim()) return
    setCreating(true)
    const { data } = await supabase
      .from('boards')
      .insert({ user_id: user.id, title: newTitle.trim(), elements: [], app_state: {} })
      .select('id')
      .single()
    setCreating(false)
    setNewTitle('')
    if (data) router.push(`/board/${data.id}`)
  }

  const deleteBoard = async (boardId: string) => {
    if (!confirm('确定删除这个画布吗？')) return
    await supabase.from('boards').delete().eq('id', boardId)
    setBoards(prev => prev.filter(b => b.id !== boardId))
  }

  const formatDate = (str: string) => {
    const d = new Date(str)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <p className="text-white text-xl">加载中...</p>
    </div>
  )

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Excalicore</h1>
        <p className="text-gray-400 mb-8">协作白板工具</p>
        <button onClick={handleLogin}
          className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 font-medium">
          用 Google 登录
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Excalicore</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user.user_metadata.full_name}</span>
          <button onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700">
            退出
          </button>
        </div>
      </div>

      {/* 主体 */}
      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* 新建画布 */}
        <div className="flex gap-3 mb-10">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createBoard()}
            placeholder="新画布名称..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button onClick={createBoard} disabled={creating || !newTitle.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg font-medium">
            {creating ? '创建中...' : '+ 新建'}
          </button>
        </div>

        {/* 画布列表 */}
        {boards.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            <p className="text-lg">还没有画布</p>
            <p className="text-sm mt-2">输入名称创建你的第一个画布</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {boards.map(board => (
              <div key={board.id}
                className="group relative bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors cursor-pointer"
                onClick={() => router.push(`/board/${board.id}`)}>
                <div className="flex items-start justify-between">
                  <div>
                    {editingId === board.id ? (
                      <input
                        autoFocus
                        defaultValue={board.title}
                        onClick={e => e.stopPropagation()}
                        onBlur={async (e) => {
                          const newTitle = e.target.value.trim()
                          if (newTitle && newTitle !== board.title) {
                            await supabase.from('boards').update({ title: newTitle }).eq('id', board.id)
                            setBoards(prev => prev.map(b => b.id === board.id ? { ...b, title: newTitle } : b))
                          }
                          setEditingId(null)
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="font-medium bg-transparent border-b border-blue-500 text-white outline-none w-full"
                      />
                    ) : (
                      <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                        {board.title}
                      </h3>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{formatDate(board.updated_at)}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingId(board.id) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-blue-400 text-sm transition-all px-2 py-1">
                    重命名
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteBoard(board.id) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-sm transition-all px-2 py-1">
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
