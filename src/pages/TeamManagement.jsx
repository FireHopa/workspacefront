import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import { ArrowLeft, ShieldAlert, Users, Plus, CheckCircle2, AlertCircle } from 'lucide-react'

export default function TeamManagement({ setActiveTab }) {
  const [teamList, setTeamList] = useState([])
  const [teamRoles, setTeamRoles] = useState([])
  
  // Adicionamos o is_strategist no estado inicial
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '', role: 'employee', team_role: '', is_strategist: false })
  const [newRoleName, setNewRoleName] = useState('')
  
  const [msg, setMsg] = useState('')
  const [roleMsg, setRoleMsg] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/users/'), api.get('/team-roles/')
      ])
      setTeamList(usersRes.data)
      setTeamRoles(rolesRes.data)
    } catch (error) { console.error("Erro ao buscar dados", error) }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      await api.post('/users/', newMember)
      setMsg('Membro adicionado com sucesso!')
      setNewMember({ name: '', email: '', password: '', role: 'employee', team_role: '', is_strategist: false })
      fetchData()
      setTimeout(() => setMsg(''), 3000)
    } catch (err) { setMsg('Erro: ' + (err.response?.data?.detail || 'Erro ao cadastrar.')) }
  }

  const handleCreateTeamRole = async (e) => {
    e.preventDefault()
    setRoleMsg('')
    if(!newRoleName.trim()) return;
    try {
      await api.post('/team-roles/', { name: newRoleName })
      setRoleMsg('Função criada!')
      setNewRoleName('')
      fetchData()
      setTimeout(() => setRoleMsg(''), 3000)
    } catch (err) { setRoleMsg('Erro: Função já existe.') }
  }

  const handleUpdateUser = async (userId, field, value) => {
    try {
      await api.put(`/users/${userId}`, { [field]: value })
      fetchData() 
    } catch (err) { console.error("Erro ao atualizar usuário", err) }
  }

  const FeedbackMessage = ({ text }) => {
    if (!text) return null;
    const isError = text.includes('Erro');
    return (
      <div className={`mt-3 p-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 border ${isError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
        {isError ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>} {text}
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
          <ArrowLeft size={16} /> Voltar
        </button>
        <h3 className="text-3xl font-bold tracking-tight text-slate-800">Gestão de Equipe</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA: Formulários */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h4 className="text-lg font-bold mb-5 text-slate-800 flex items-center gap-2"><Users size={18} className="text-blue-600"/> Adicionar Membro</h4>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo</label>
                <input type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm bg-slate-50 focus:bg-white" required />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Corporativo</label>
                <input type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm bg-slate-50 focus:bg-white" required />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Senha Provisória</label>
                <input type="password" value={newMember.password} onChange={e => setNewMember({...newMember, password: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm bg-slate-50 focus:bg-white" required />
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Acesso</label>
                  <select value={newMember.role} onChange={e => setNewMember({...newMember, role: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 text-sm font-semibold text-slate-700">
                    <option value="employee">Parceiro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Função</label>
                  <select value={newMember.team_role || ''} onChange={e => setNewMember({...newMember, team_role: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 text-sm font-semibold text-slate-700">
                    <option value="">(Nenhum)</option>
                    {teamRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              {/* A NOVA CAIXINHA DE ESTRATEGISTA */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer p-3 border border-purple-200 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <input type="checkbox" checked={newMember.is_strategist} onChange={e => setNewMember({...newMember, is_strategist: e.target.checked})} className="w-4 h-4 text-purple-600 rounded border-purple-300 focus:ring-purple-500" />
                  <div>
                    <span className="block text-[11px] font-bold text-purple-700 uppercase tracking-wider">Acesso: Estrategista</span>
                    <span className="block text-xs text-purple-600 mt-0.5">Libera a aba de Clientes para este usuário.</span>
                  </div>
                </label>
              </div>

              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors mt-4 text-sm flex justify-center items-center gap-2">
                Cadastrar Usuário
              </button>
              <FeedbackMessage text={msg} />
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h4 className="text-lg font-bold mb-1 text-slate-800 flex items-center gap-2"><ShieldAlert size={18} className="text-purple-600"/> Criar Função</h4>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-4">Departamentos da Agência</p>
            <form onSubmit={handleCreateTeamRole} className="flex gap-2">
              <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Ex: Copywriter..." className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none text-sm bg-slate-50" required />
              <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors"><Plus size={18}/></button>
            </form>
            <FeedbackMessage text={roleMsg} />
            
            <div className="mt-5 flex flex-wrap gap-2">
              {teamRoles.map(r => (
                <span key={r.id} className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md font-bold">{r.name}</span>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Tabela */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h4 className="text-xl font-bold text-slate-800">Membros Ativos ({teamList.length})</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4 font-bold">Colaborador</th>
                  <th className="px-6 py-4 font-bold">Nível (App)</th>
                  <th className="px-6 py-4 font-bold">Função (Operação)</th>
                  <th className="px-6 py-4 font-bold text-center">Estrategista?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamList.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 text-sm">{member.name}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{member.email}</p>
                    </td>
                    
                    <td className="px-6 py-4">
                      <select 
                        value={member.role} 
                        onChange={(e) => handleUpdateUser(member.id, 'role', e.target.value)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded outline-none cursor-pointer border ${member.role === 'admin' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                      >
                        <option value="employee">Parceiro</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </td>

                    <td className="px-6 py-4">
                      <select 
                        value={member.team_role || ''} 
                        onChange={(e) => handleUpdateUser(member.id, 'team_role', e.target.value)}
                        className="text-xs font-bold px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">(Sem função)</option>
                        {teamRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </select>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={member.is_strategist} 
                        onChange={(e) => handleUpdateUser(member.id, 'is_strategist', e.target.checked)} 
                        className="w-5 h-5 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                        title="Marcar como Estrategista"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  )
}