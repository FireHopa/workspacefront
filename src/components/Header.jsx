import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion' 
import { api } from '../services/api'
import { Bell, LogOut, Settings, X, Lock, CheckCircle2, AlertCircle, Target, Send, ClipboardCheck } from 'lucide-react'

const getRoleLabel = (role) => {
  if (role === 'admin') return 'Administrador'
  if (role === 'conferente') return 'Conferente'
  return 'Parceiro'
}

export default function Header({ user, handleLogout, setActiveTab }) {
  const [notifications, setNotifications] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [user.id])

  const fetchNotifications = async () => {
    try {
      const res = await api.get(`/users/${user.id}/notifications`)
      setNotifications(res.data)
    } catch (err) { console.error(err) }
  }

  const handleOpenNotifications = async () => {
    setShowDropdown(!showDropdown)
    const unread = notifications.filter(n => !n.read).length
    if (unread > 0 && !showDropdown) {
      try {
        await api.put(`/users/${user.id}/notifications/read`)
        setTimeout(fetchNotifications, 1000) 
      } catch (err) {}
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setMsg('')

    if (passwords.new !== passwords.confirm) {
      return setMsg('Erro: A nova senha e a confirmação não batem.')
    }
    if (passwords.new.length < 6) {
      return setMsg('Erro: A nova senha deve ter no mínimo 6 caracteres.')
    }

    try {
      await api.put(`/users/${user.id}/password`, {
        current_password: passwords.current,
        new_password: passwords.new
      })
      setMsg('Senha alterada com sucesso!')
      setPasswords({ current: '', new: '', confirm: '' })
      setTimeout(() => {
        setShowSettings(false)
        setMsg('')
      }, 2000)
    } catch (err) {
      setMsg(`Erro: ${err.response?.data?.detail || 'Não foi possível alterar a senha.'}`)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const canCreateTask = user.role === 'admin' || user.role === 'employee'
  const canReview = user.role === 'conferente'

  return (
    <>
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('dashboard')}>
              <img src="/casadoads.png" alt="Logo Casa do Ads" className="h-12 w-auto object-contain" />
              <h2 className="text-xl font-extrabold tracking-tight text-slate-800">Casa do Ads</h2>
            </div>
            
            {canCreateTask && (
              <button 
                onClick={() => setActiveTab('assign')} 
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 rounded-lg transition-colors border border-slate-200 hover:border-orange-200"
              >
                <Send size={16} /> Criar Tarefa
              </button>
            )}

            {canReview && (
              <button 
                onClick={() => setActiveTab('conference')} 
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors border border-slate-200 hover:border-emerald-200"
              >
                <ClipboardCheck size={16} /> Conferências
              </button>
            )}

            <button 
              onClick={() => setActiveTab('productivity')} 
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-slate-200 hover:border-blue-200"
            >
              <Target size={16} /> Meu Espaço
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={handleOpenNotifications} className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors bg-slate-50 hover:bg-blue-50 rounded-full">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">{unreadCount}</span>
                )}
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                  <div className="bg-slate-50 p-3 border-b border-slate-100 font-bold text-sm text-slate-700 flex items-center gap-2">
                    <Bell size={14} /> Notificações
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-center text-sm text-slate-400">Caixa de entrada limpa.</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`p-3 border-b border-slate-50 text-sm ${n.read ? 'bg-white text-slate-500' : 'bg-blue-50/50 text-slate-800 font-medium'}`}>
                          {n.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-slate-700 transition-colors bg-slate-50 hover:bg-slate-100 rounded-full" title="Configurações da Conta">
              <Settings size={20} />
            </button>

            <div className="text-right border-l border-slate-200 pl-4 ml-2">
              <p className="text-sm font-bold text-slate-800">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{getRoleLabel(user.role)}</p>
            </div>
            
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2">
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Settings size={18} className="text-blue-600"/> Minha Conta
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Lock size={16} className="text-slate-400"/> Segurança: Alterar Senha
              </h4>
              
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Senha Atual</label>
                  <input type="password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm bg-slate-50 focus:bg-white" required />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nova Senha</label>
                    <input type="password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm bg-slate-50 focus:bg-white" required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Confirmar Nova</label>
                    <input type="password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm bg-slate-50 focus:bg-white" required />
                  </div>
                </div>

                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors mt-2 text-sm">
                  Salvar Nova Senha
                </button>

                {msg && (
                  <div className={`mt-3 p-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 border ${msg.includes('Erro') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {msg.includes('Erro') ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>} {msg}
                  </div>
                )}
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}
