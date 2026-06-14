import { useEffect, useState } from 'react'
import { SplashScreen } from './components/SplashScreen'
import { RegistrationForm } from './components/RegistrationForm'
import { Dashboard } from './components/Dashboard'
import { AdminDashboard } from './components/AdminDashboard'
import { supabase } from './lib/supabase'
import { initTelegram, getTelegramUser } from './lib/telegram'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showRegistration, setShowRegistration] = useState(false)
  const [notInTelegram, setNotInTelegram] = useState(false)

  useEffect(() => {
    const init = async () => {
      initTelegram()
      await new Promise(resolve => setTimeout(resolve, 2000))

      const tgUser = getTelegramUser()
      
      if (!tgUser) {
        setNotInTelegram(true)
        setIsLoading(false)
        return
      }

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgUser.id)
        .single()

      if (data) {
        setUser(data)
      } else {
        setShowRegistration(true)
      }

      setIsLoading(false)
    }

    init()
  }, [])

  const handleRegistrationSuccess = (newUser: any) => {
    setUser(newUser)
    setShowRegistration(false)
  }

  if (isLoading) {
    return <SplashScreen />
  }

  if (notInTelegram) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#1a0b2e] to-[#2d1b4e]">
        <div className="bg-white/10 p-6 rounded-xl text-center">
          <div className="text-5xl mb-4">📱</div>
          <h2 className="text-white text-xl font-bold mb-2">Откройте через Telegram</h2>
        </div>
      </div>
    )
  }

  if (showRegistration) {
    return <RegistrationForm onSuccess={handleRegistrationSuccess} />
  }

  if (user) {
    const normalizedRole = user.role ? user.role.trim().toLowerCase() : ''
    
    if (normalizedRole === 'admin') {
      return <AdminDashboard currentUser={user} />
    } else {
      return <Dashboard user={user} />
    }
  }

  return null
}

export default App