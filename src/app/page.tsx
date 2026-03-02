'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">Excalicord Clone</h1>
        {user ? (
          <div>
            <p className="text-xl mb-4">欢迎, {user.user_metadata.full_name}!</p>
            <p className="text-sm text-gray-400 mb-6">{user.email}</p>
            <a href="/board" className="block mb-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">进入白板</a>
            <button
              onClick={handleLogout}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              退出登录
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 font-medium"
          >
            用 Google 登录
          </button>
        )}
      </div>
    </div>
  )
}