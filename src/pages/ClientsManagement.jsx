import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../services/api'
import { ArrowLeft, Briefcase, Plus, Trash2, Building, User, Calendar, MapPin, DollarSign, Star, Target, CheckCircle2, AlertCircle, Tag, Clock, Activity, AlertTriangle, X, MessageSquare, Zap } from 'lucide-react'

// CORREÇÃO: Função de Matemática de Tempo (Sem erro de Fuso Horário)
const addDays = (dateStr, days) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  const newD = String(date.getDate()).padStart(2, '0');
  
  return `${newY}-${newM}-${newD}`;
};

const getSlaStatus = (deadline) => {
  if (!deadline) return { text: 'Sem prazo', color: 'bg-slate-100 text-slate-500 border-slate-200', isLate: false };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = deadline.split('-');
  const deadDate = new Date(y, m - 1, d);
  
  const diffTime = deadDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `Atrasado há ${Math.abs(diffDays)} dias`, color: 'bg-red-50 text-red-700 border-red-200 font-extrabold', isLate: true };
  if (diffDays === 0) return { text: 'Vence HOJE', color: 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold', isLate: false };
  if (diffDays <= 3) return { text: `Vence em ${diffDays} dias`, color: 'bg-amber-50 text-amber-700 border-amber-200', isLate: false };
  return { text: `Faltam ${diffDays} dias`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', isLate: false };
};

export default function ClientsManagement({ setActiveTab, user }) {
  const [clients, setClients] = useState([])
  const [plans, setPlans] = useState([])
  const [users, setUsers] = useState([])
  
  const [regMode, setRegMode] = useState('basic') 

  const [newPlanName, setNewPlanName] = useState('')
  const [newClient, setNewClient] = useState({
    company_name: '', client_name: '', plan_id: '', campaign_id: '',
    tech_leader_id: '', investment_3m: '', project_tier: '1',
    start_date: '', category: '', location: '', strategist_id: ''
  })
  
  const [slaModalOpen, setSlaModalOpen] = useState(false)
  const [activeClient, setActiveClient] = useState(null)
  const [slaData, setSlaData] = useState({
    last_meeting: '', deadline_meeting: '',
    last_optimization: '', deadline_optimization: '',
    last_relationship: '', deadline_relationship: ''
  })

  const [msg, setMsg] = useState('')
  const [planMsg, setPlanMsg] = useState('')

  useEffect(() => { 
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [user.id])

  const fetchData = async () => {
    try {
      const [clientsRes, plansRes, usersRes] = await Promise.all([
        api.get(`/clients/${user.id}`), 
        api.get('/plans/'), 
        api.get('/users/')
      ])
      setClients(clientsRes.data)
      setPlans(plansRes.data)
      setUsers(usersRes.data)
    } catch (error) { console.error("Erro ao buscar dados do CRM", error) }
  }

  const handleCreatePlan = async (e) => {
    e.preventDefault()
    setPlanMsg('')
    if(!newPlanName.trim()) return;
    try {
      await api.post('/plans/', { name: newPlanName })
      setPlanMsg('Plano criado!')
      setNewPlanName('')
      fetchData()
      setTimeout(() => setPlanMsg(''), 3000)
    } catch (err) { setPlanMsg('Erro: Plano já existe.') }
  }

  const handleDeletePlan = async (id) => {
    if(!window.confirm("Apagar este plano? Certifique-se que nenhum cliente o utiliza.")) return;
    try {
      await api.delete(`/plans/${id}`)
      fetchData()
    } catch (err) { alert("Erro ao apagar.") }
  }

  const handleCreateClient = async (e) => {
    e.preventDefault()
    setMsg('')
    
    try {
      let payload = { 
        company_name: newClient.company_name, 
        client_name: newClient.client_name, 
        created_by: user.id 
      }

      if (regMode === 'full') {
        payload = {
          ...payload,
          plan_id: newClient.plan_id ? parseInt(newClient.plan_id) : null,
          campaign_id: newClient.campaign_id || null,
          tech_leader_id: newClient.tech_leader_id ? parseInt(newClient.tech_leader_id) : null,
          investment_3m: newClient.investment_3m || null,
          project_tier: newClient.project_tier ? parseInt(newClient.project_tier) : 1,
          start_date: newClient.start_date || null,
          category: newClient.category || null,
          location: newClient.location || null,
          strategist_id: newClient.strategist_id ? parseInt(newClient.strategist_id) : null
        }
      }

      await api.post('/clients/', payload)
      setMsg('Cliente adicionado à carteira com sucesso!')
      setNewClient({ company_name: '', client_name: '', plan_id: '', campaign_id: '', tech_leader_id: '', investment_3m: '', project_tier: '1', start_date: '', category: '', location: '', strategist_id: '' })
      fetchData()
      setTimeout(() => setMsg(''), 4000)
    } catch (err) { setMsg('Erro ao cadastrar cliente.') }
  }

  const handleDeleteClient = async (id) => {
    if(!window.confirm("Deseja realmente remover este cliente da base?")) return;
    try {
      await api.delete(`/clients/${id}`)
      fetchData()
    } catch (err) { alert("Erro ao deletar.") }
  }

  const openSlaModal = (client) => {
    setActiveClient(client)
    setSlaData({
      last_meeting: client.last_meeting || '', deadline_meeting: client.deadline_meeting || '',
      last_optimization: client.last_optimization || '', deadline_optimization: client.deadline_optimization || '',
      last_relationship: client.last_relationship || '', deadline_relationship: client.deadline_relationship || ''
    })
    setSlaModalOpen(true)
  }

  const handleSlaChange = (field, value) => {
    const newData = { ...slaData, [field]: value }
    if (field === 'last_meeting' && value) newData.deadline_meeting = addDays(value, 30)
    if (field === 'last_optimization' && value) newData.deadline_optimization = addDays(value, 15)
    if (field === 'last_relationship' && value) newData.deadline_relationship = addDays(value, 7)
    
    setSlaData(newData)
  }

  // CORREÇÃO: Enviando o pacote completo para evitar o Erro 422
  const handleSaveSla = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/clients/${activeClient.id}`, {
        ...activeClient,
        ...slaData
      })
      setSlaModalOpen(false)
      fetchData()
    } catch (error) { alert("Erro ao atualizar prazos.") }
  }

  const techLeaders = users.filter(u => u.role === 'admin')
  const strategists = users.filter(u => u.is_strategist === true)

  const Feedback = ({ text }) => {
    if (!text) return null;
    const isError = text.includes('Erro');
    return (
      <div className={`mt-3 p-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border ${isError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
        {isError ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>} {text}
      </div>
    )
  }

  const SlaBadge = ({ label, deadline, lastDone }) => {
    const status = getSlaStatus(deadline)
    return (
      <div className={`p-3 rounded-xl border ${status.isLate ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'} flex flex-col justify-between`}>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</span>
        <div className={`text-xs px-2 py-1 rounded border text-center ${status.color}`}>
          {status.text}
        </div>
        <span className="text-[9px] text-slate-400 mt-2 text-center">Última: {lastDone ? lastDone.split('-').reverse().join('/') : 'Nunca'}</span>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
          <ArrowLeft size={16} /> Voltar
        </button>
        <h3 className="text-3xl font-bold tracking-tight text-slate-800">Gestão de Clientes & SLA</h3>
      </div>

      {user.role === 'admin' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            
            <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
              <h4 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Briefcase size={20} className="text-pink-600"/> Cadastrar Conta</h4>
              
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button type="button" onClick={() => setRegMode('basic')} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${regMode === 'basic' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Zap size={14} /> Rápido
                </button>
                <button type="button" onClick={() => setRegMode('full')} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${regMode === 'full' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Briefcase size={14} /> Completo (CRM)
                </button>
              </div>
            </div>
            
            <form onSubmit={handleCreateClient} className="space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Building size={12}/> Nome da Empresa</label>
                  <input type="text" value={newClient.company_name} onChange={e => setNewClient({...newClient, company_name: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-600 outline-none text-sm bg-slate-50" required />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><User size={12}/> Nome do Cliente (Contato)</label>
                  <input type="text" value={newClient.client_name} onChange={e => setNewClient({...newClient, client_name: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-600 outline-none text-sm bg-slate-50" required />
                </div>
              </div>

              <AnimatePresence>
                {regMode === 'full' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-5 overflow-hidden">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Tag size={12}/> Categoria / Nicho</label>
                        <input type="text" placeholder="Ex: Clínica Médica" value={newClient.category} onChange={e => setNewClient({...newClient, category: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-600 outline-none text-sm bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><MapPin size={12}/> Localização</label>
                        <input type="text" placeholder="Ex: Santos, SP" value={newClient.location} onChange={e => setNewClient({...newClient, location: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-600 outline-none text-sm bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Calendar size={12}/> Início do Projeto</label>
                        <input type="date" value={newClient.start_date} onChange={e => setNewClient({...newClient, start_date: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-600 outline-none text-sm bg-slate-50 text-slate-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-slate-100 pt-5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Briefcase size={12}/> Plano Vendido</label>
                        <select value={newClient.plan_id} onChange={e => setNewClient({...newClient, plan_id: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-600 outline-none text-sm bg-white font-medium text-slate-700">
                          <option value="">Selecione o plano...</option>
                          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><DollarSign size={12}/> Invest. Tráfego (3 Meses)</label>
                        <input type="text" placeholder="Ex: R$ 5.000,00" value={newClient.investment_3m} onChange={e => setNewClient({...newClient, investment_3m: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-600 outline-none text-sm bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Star size={12}/> Classificação (Tier)</label>
                        <select value={newClient.project_tier} onChange={e => setNewClient({...newClient, project_tier: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-600 outline-none text-sm bg-white font-medium text-slate-700">
                          <option value="1">Tier 1 (Prioridade Máxima)</option>
                          <option value="2">Tier 2 (Padrão)</option>
                          <option value="3">Tier 3 (Manutenção)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Target size={12}/> ID da Campanha (Ads)</label>
                        <input type="text" placeholder="Ex: 123-456-7890" value={newClient.campaign_id} onChange={e => setNewClient({...newClient, campaign_id: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-600 outline-none text-sm bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1.5">Tech Leader Responsável</label>
                        <select value={newClient.tech_leader_id} onChange={e => setNewClient({...newClient, tech_leader_id: e.target.value})} className="w-full px-3 py-2.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm bg-blue-50 font-bold text-blue-800">
                          <option value="">Escolher Admin...</option>
                          {techLeaders.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Estrategista Responsável</label>
                        <select value={newClient.strategist_id} onChange={e => setNewClient({...newClient, strategist_id: e.target.value})} className="w-full px-3 py-2.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none text-sm bg-purple-50 font-bold text-purple-800">
                          <option value="">Designar Estrategista...</option>
                          {strategists.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl transition-colors mt-2 text-sm flex justify-center items-center gap-2 shadow-md">
                <Plus size={18}/> Salvar Novo Cliente
              </button>
              <Feedback text={msg} />
            </form>
          </div>

          <div className="xl:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
            <h4 className="text-lg font-bold mb-4 text-slate-800 flex items-center gap-2"><DollarSign size={18} className="text-emerald-600"/> Planos da Agência</h4>
            <form onSubmit={handleCreatePlan} className="flex gap-2 mb-6">
              <input type="text" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="Ex: Fee Mensal Prata..." className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none text-sm bg-slate-50" required />
              <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors"><Plus size={18}/></button>
            </form>
            <Feedback text={planMsg} />
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {plans.length === 0 ? <p className="text-xs text-slate-400 italic">Nenhum plano criado.</p> : null}
              {plans.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-lg group">
                  <span className="text-xs font-bold text-slate-700">{p.name}</span>
                  <button onClick={() => handleDeletePlan(p.id)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {user.role === 'admin' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-8">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h4 className="text-xl font-bold text-slate-800">Controlo de SLA ({clients.length})</h4>
          </div>
          
          <div className="overflow-x-auto">
            {clients.length === 0 ? (
              <div className="p-12 text-center"><p className="text-slate-500 font-medium">Nenhum cliente cadastrado.</p></div>
            ) : (
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4 font-bold">Empresa / Contato</th>
                    <th className="px-6 py-4 font-bold">Plano & Ads</th>
                    <th className="px-6 py-4 font-bold">Estrategista</th>
                    <th className="px-6 py-4 font-bold text-center">Gestão de Prazos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => {
                    const planName = client.plan_id ? (plans.find(p => p.id === client.plan_id)?.name || 'Desconhecido') : 'Sem Plano';
                    const strategist = client.strategist_id ? (users.find(u => u.id === client.strategist_id)?.name || 'N/A') : 'Não Designado';
                    
                    const isLate = getSlaStatus(client.deadline_meeting).isLate || getSlaStatus(client.deadline_optimization).isLate || getSlaStatus(client.deadline_relationship).isLate;

                    return (
                      <tr key={client.id} className={`hover:bg-slate-50 transition-colors ${isLate ? 'bg-red-50/30' : ''}`}>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800 text-sm">{client.company_name}</p>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 flex items-center gap-1"><User size={10}/> {client.client_name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded w-fit mb-1">{planName}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg w-fit border border-purple-200">{strategist.split(' ')[0]}</p>
                        </td>
                        <td className="px-6 py-4 flex items-center justify-center gap-2">
                          <button onClick={() => openSlaModal(client)} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm flex items-center gap-2 ${isLate ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}>
                            <Clock size={14} /> Atualizar SLA
                          </button>
                          <button onClick={() => handleDeleteClient(client.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {user.role !== 'admin' && user.is_strategist && (
        <div className="space-y-6 mt-4">
          <div className="bg-purple-600 text-white p-8 rounded-2xl shadow-lg flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-extrabold flex items-center gap-3"><Activity size={28}/> Quadro de Missões (SLA)</h2>
              <p className="text-purple-200 text-sm mt-1">Acompanhe os prazos de Reunião, Otimização e Relacionamento da sua carteira.</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black">{clients.length}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-purple-200">Clientes Ativos</p>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center">
              <Briefcase size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhum cliente designado para si de momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {clients.map(client => {
                const planName = client.plan_id ? (plans.find(p => p.id === client.plan_id)?.name || 'Desconhecido') : 'Sem Plano';
                const statusReuniao = getSlaStatus(client.deadline_meeting)
                const statusOtimiza = getSlaStatus(client.deadline_optimization)
                const statusRelacio = getSlaStatus(client.deadline_relationship)
                
                const isCritico = statusReuniao.isLate || statusOtimiza.isLate || statusRelacio.isLate

                return (
                  <div key={client.id} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all relative ${isCritico ? 'border-red-500 shadow-red-100' : 'border-slate-200 hover:border-purple-300'}`}>
                    
                    {isCritico && (
                      <div className="bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest py-1.5 flex items-center justify-center gap-1.5">
                        <AlertTriangle size={14} /> Atenção: SLA Quebrado
                      </div>
                    )}

                    <div className="p-5 border-b border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-lg font-bold text-slate-800 leading-tight">{client.company_name}</h4>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">{planName}</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1"><User size={12}/> Contato: {client.client_name}</p>
                    </div>

                    <div className="p-5 grid grid-cols-3 gap-2 bg-slate-50/50">
                      <SlaBadge label="Reunião (30d)" deadline={client.deadline_meeting} lastDone={client.last_meeting} />
                      <SlaBadge label="Otimizar (15d)" deadline={client.deadline_optimization} lastDone={client.last_optimization} />
                      <SlaBadge label="Contato (7d)" deadline={client.deadline_relationship} lastDone={client.last_relationship} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {slaModalOpen && activeClient && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden">
              
              <div className="bg-slate-800 px-6 py-4 flex justify-between items-center text-white">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2"><Clock size={18} /> Cronómetro de Entregas (SLA)</h3>
                  <p className="text-xs text-slate-300 mt-0.5">Cliente: {activeClient.company_name}</p>
                </div>
                <button onClick={() => setSlaModalOpen(false)} className="text-slate-300 hover:text-white p-1 rounded-md transition-colors"><X size={24} /></button>
              </div>

              <form onSubmit={handleSaveSla} className="p-8">
                <div className="space-y-8">
                  
                  <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-xl">
                    <h5 className="font-bold text-blue-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2"><Calendar size={16}/> 1. Reunião de Alinhamento (Ciclo 30 dias)</h5>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Quando a reunião aconteceu?</label>
                        <input type="date" value={slaData.last_meeting} onChange={e => handleSlaChange('last_meeting', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Prazo para a próxima (Editável)</label>
                        <input type="date" value={slaData.deadline_meeting} onChange={e => handleSlaChange('deadline_meeting', e.target.value)} className="w-full px-3 py-2 border border-blue-300 rounded-lg outline-none focus:border-blue-500 text-sm bg-white font-bold text-blue-700" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-xl">
                    <h5 className="font-bold text-amber-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2"><Target size={16}/> 2. Otimização da Conta (Ciclo 15 dias)</h5>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Quando foi otimizado?</label>
                        <input type="date" value={slaData.last_optimization} onChange={e => handleSlaChange('last_optimization', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-amber-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Prazo limite (Editável)</label>
                        <input type="date" value={slaData.deadline_optimization} onChange={e => handleSlaChange('deadline_optimization', e.target.value)} className="w-full px-3 py-2 border border-amber-300 rounded-lg outline-none focus:border-amber-500 text-sm bg-white font-bold text-amber-700" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-xl">
                    <h5 className="font-bold text-emerald-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2"><MessageSquare size={16}/> 3. Relacionamento / Contato (Ciclo 7 dias)</h5>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Quando foi o último contato?</label>
                        <input type="date" value={slaData.last_relationship} onChange={e => handleSlaChange('last_relationship', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Prazo limite (Editável)</label>
                        <input type="date" value={slaData.deadline_relationship} onChange={e => handleSlaChange('deadline_relationship', e.target.value)} className="w-full px-3 py-2 border border-emerald-300 rounded-lg outline-none focus:border-emerald-500 text-sm bg-white font-bold text-emerald-700" />
                      </div>
                    </div>
                  </div>

                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={() => setSlaModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-8 py-2.5 rounded-xl transition-colors shadow-md flex items-center gap-2">
                    <CheckCircle2 size={18} /> Salvar Cronómetros
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}