import React, { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { jwtDecode } from "jwt-decode"
import { api } from './services/api'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TeamManagement from './pages/TeamManagement'
import TemplateManagement from './pages/TemplateManagement'
import AssignTask from './pages/AssignTask'
import Approvals from './pages/Approvals'
import AdminTaskPanel from './pages/AdminTaskPanel'
import Header from './components/Header'
import ClientsManagement from './pages/ClientsManagement'

// NOVA IMPORTAÇÃO
import Productivity from './pages/Productivity'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token)
        setUser(decoded)
        localStorage.setItem('token', token)
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      } catch (err) { handleLogout() }
    } else {
      delete api.defaults.headers.common['Authorization']
      localStorage.removeItem('token')
      setUser(null)
    }
  }, [token])

  const handleLogout = () => {
    setToken(null)
    setActiveTab('dashboard')
  }

  if (!token || !user) {
    return <Login setToken={setToken} />
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <Header user={user} handleLogout={handleLogout} setActiveTab={setActiveTab} />
      
      <main className="p-8 max-w-7xl mx-auto w-full flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dashboard" user={user} setActiveTab={setActiveTab} />}
          {activeTab === 'team' && user.role === 'admin' && <TeamManagement key="team" setActiveTab={setActiveTab} />}
          {activeTab === 'templates' && user.role === 'admin' && <TemplateManagement key="templates" setActiveTab={setActiveTab} />}
          {activeTab === 'assign' && user.role === 'admin' && <AssignTask key="assign" setActiveTab={setActiveTab} />}
          {activeTab === 'approvals' && user.role === 'admin' && <Approvals key="approvals" setActiveTab={setActiveTab} />}
          {activeTab === 'monitoring' && user.role === 'admin' && <AdminTaskPanel key="monitoring" setActiveTab={setActiveTab} />}
          {activeTab === 'clients' && <ClientsManagement key="clients" setActiveTab={setActiveTab} user={user} />}
          
          {/* NOVA ROTA */}
          {activeTab === 'productivity' && <Productivity key="productivity" user={user} />}
        </AnimatePresence>
      </main>
    </div>
  )
}