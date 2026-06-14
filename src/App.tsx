import { useEffect, useState } from 'react'
import { SplashScreen } from './components/SplashScreen'
import { RegistrationForm } from './components/RegistrationForm'
import { Dashboard } from './components/Dashboard'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showRegistration, setShowRegistration] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setShowRegistration(true)
      setIsLoading(false)
    }, 2000)
  }, [])

  const handleRegistrationSuccess = (newUser: any) => {
    setUser(newUser)
    setShowRegistration(false)
  }

  if (isLoading) {
    return <SplashScreen />
  }

  if (showRegistration) {
    return <RegistrationForm onSuccess={handleRegistrationSuccess} />
  }

  if (user) {
    return <Dashboard user={user} />
  }

  return null
}

export default App