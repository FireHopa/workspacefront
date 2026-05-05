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
import Productivity from './pages/Productivity'
import ConferencePanel from './pages/ConferencePanel'

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
