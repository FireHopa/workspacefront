import React, { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { api } from './services/api'

import Login from './pages/Login'
import FinanceDashboard from './pages/FinanceDashboard'
import Dashboard from './pages/Dashboard'
import TeamManagement from './pages/TeamManagement'
import TemplateManagement from './pages/TemplateManagement'
import AssignTask from './pages/AssignTask'
import Approvals from './pages/Approvals'
import AdminTaskPanel from './pages/AdminTaskPanel'
import Header from './components/Header'
import ClientsManagement from './pages/ClientsManagement'
import Productivity from './pages/Productivity'
import ConferencePanel from './pages/ConferencePanel'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [authError, setAuthError] = useState('')
  const [authAttempt, setAuthAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setUser(null)
    setAuthError('')
    if (!token) {
      delete api.defaults.headers.common['Authorization']
      localStorage.removeItem('token')
      return
    }
    localStorage.setItem('token', token)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    api.get('/me').then(({ data }) => {
      if (!cancelled) setUser(data)
    }).catch(error => {
      if (cancelled) return
      if ([401, 403].includes(error.response?.status)) setToken(null)
      else setAuthError('Não foi possível conectar ao servidor.')
    })
    return () => { cancelled = true }
  }, [token, authAttempt])

  useEffect(() => {
    const interceptor = api.interceptors.response.use(response => response, error => {
      if (error.response?.status === 401 && error.config?.url !== '/token') setToken(null)
      return Promise.reject(error)
    })
    return () => api.interceptors.response.eject(interceptor)
  }, [])

  const handleLogout = () => {
    setToken(null)
    setActiveTab('dashboard')
  }

  if (!token) {
    return <Login setToken={setToken} />
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center p-6"><div role="status" className="text-center space-y-4"><p>{authError || 'Carregando sua conta…'}</p>{authError && <><button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={() => setAuthAttempt(n => n + 1)}>Tentar novamente</button><button className="px-4 py-2" onClick={handleLogout}>Voltar ao login</button></>}</div></div>

  if (user.role === 'finance') return <FinanceDashboard user={user} onLogout={handleLogout} />

  const canManage = user.role === 'admin'
  const canCreateTask = user.role === 'admin' || user.role === 'employee'
  const canReview = user.role === 'conferente'

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <Header user={user} handleLogout={handleLogout} setActiveTab={setActiveTab} />
      
      <main className="p-8 max-w-7xl mx-auto w-full flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            canReview
              ? <ConferencePanel key="conference-dashboard" user={user} setActiveTab={setActiveTab} />
              : <Dashboard key="dashboard" user={user} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'team' && canManage && <TeamManagement key="team" setActiveTab={setActiveTab} />}
          {activeTab === 'templates' && canManage && <TemplateManagement key="templates" setActiveTab={setActiveTab} />}
          {activeTab === 'assign' && canCreateTask && <AssignTask key="assign" setActiveTab={setActiveTab} user={user} />}
          {activeTab === 'approvals' && canManage && <Approvals key="approvals" setActiveTab={setActiveTab} />}
          {activeTab === 'monitoring' && canManage && <AdminTaskPanel key="monitoring" setActiveTab={setActiveTab} />}
          {activeTab === 'conference' && canReview && <ConferencePanel key="conference" user={user} setActiveTab={setActiveTab} />}
          {activeTab === 'clients' && <ClientsManagement key="clients" setActiveTab={setActiveTab} user={user} />}
          {activeTab === 'productivity' && <Productivity key="productivity" user={user} />}
        </AnimatePresence>
      </main>
    </div>
  )
}
