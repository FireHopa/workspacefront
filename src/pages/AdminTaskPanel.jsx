import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import { ArrowLeft, Users, Calendar, AlertTriangle, Trash2, Inbox, Folder, BarChart3, ClipboardCheck, Hourglass, UserRound, ShieldCheck, Filter, RotateCcw } from 'lucide-react'

const checkIsLate = (deadline, status) => {
  if (!deadline || status === 'Aprovada') return false
  const [y, m, d] = deadline.split('-')
  const deadlineDate = new Date(y, m - 1, d, 23, 59, 59)
  return new Date() > deadlineDate
}

const cleanPriority = (p) => p ? p.replace(/[^\w\s]/gi, '').trim() : 'Normal'

const normalizeDate = (value) => value ? String(value).slice(0, 10) : ''

const formatDateBR = (value) => {
  const normalized = normalizeDate(value)
  if (!normalized || !normalized.includes('-')) return ''
  const [y, m, d] = normalized.split('-')
  if (!y || !m || !d) return normalized
  return `${d}/${m}/${y}`
}

const formatDateTimeBR = (value) => {
  if (!value) return ''
  const raw = String(value)
  const formattedDate = formatDateBR(raw)
  const timeMatch = raw.match(/(?:T|\s)(\d{2}:\d{2})/)
  return `${formattedDate || raw}${timeMatch ? ` ${timeMatch[1]}` : ''}`
}

const maskDateBR = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

const parseDateBRToISO = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 8) return ''
  const d = digits.slice(0, 2)
  const m = digits.slice(2, 4)
  const y = digits.slice(4, 8)
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return ''
  return `${y}-${m}-${d}`
}

const getStatusColor = (status, isLate) => {
  if (isLate && status === 'A Fazer') return 'bg-red-50 text-red-700 border border-red-200'
  if (status === 'A Fazer') return 'bg-blue-50 text-blue-700 border border-blue-200'
  if (status === 'Aguardando Conferência') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (status === 'Aguardando OK Final') return 'bg-purple-50 text-purple-700 border border-purple-200'
  if (status === 'Aguardando Aprovação') return 'bg-amber-50 text-amber-700 border border-amber-200'
  if (status === 'Aprovada') return 'bg-slate-800 text-white border border-slate-800'
  return 'bg-slate-100 text-slate-700 border border-slate-200'
}

export default function AdminTaskPanel({ setActiveTab }) {
  const [users, setUsers] = useState({})
  const [tasks, setTasks] = useState([])
  const [templates, setTemplates] = useState({})
  const [activities, setActivities] = useState({})
  const [statusFilter, setStatusFilter] = useState('all')
  const [executorFilter, setExecutorFilter] = useState('all')
  const [dateStartFilter, setDateStartFilter] = useState('')
  const [dateEndFilter, setDateEndFilter] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { 
    fetchMonitoringData() 
    const interval = setInterval(fetchMonitoringData, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchMonitoringData = async () => {
    try {
      const [usersRes, tasksRes, templatesRes, activitiesRes] = await Promise.all([
        api.get('/users/'), api.get('/all-tasks/'), api.get('/templates/'), api.get('/task-activities/')
      ])

      const userMap = {}
      usersRes.data.forEach(u => userMap[u.id] = u)
      setUsers(userMap)
      setTasks(tasksRes.data)

      const tempMap = {}
      templatesRes.data.forEach(t => tempMap[t.id] = t)
      setTemplates(tempMap)

      const activityMap = {}
      activitiesRes.data.forEach(activity => {
        if (!activityMap[activity.task_id]) activityMap[activity.task_id] = []
        activityMap[activity.task_id].push(activity)
      })
      setActivities(activityMap)
    } catch (error) { console.error('Erro ao buscar dados', error) }
  }

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa permanentemente? O fluxo e o histórico dela serão removidos.')) return
    try {
      await api.delete(`/tasks/${taskId}`)
      setMsg('Tarefa excluída com sucesso!')
      fetchMonitoringData()
      setTimeout(() => setMsg(''), 3000)
    } catch (error) {
      setMsg('Erro ao excluir tarefa.')
    }
  }

  const dateStartISO = parseDateBRToISO(dateStartFilter)
  const dateEndISO = parseDateBRToISO(dateEndFilter)
  const getTaskReferenceDate = (task) => normalizeDate(task.created_at || task.updated_at || task.completed_at || task.deadline)
  const isInsideDateRange = (task) => {
    const refDate = getTaskReferenceDate(task)
    if (!refDate && (dateStartISO || dateEndISO)) return false
    if (dateStartISO && refDate < dateStartISO) return false
    if (dateEndISO && refDate > dateEndISO) return false
    return true
  }

  const filteredTasks = tasks.filter(task => {
    const statusMatches = statusFilter === 'all' || task.status === statusFilter
    const executorMatches = executorFilter === 'all' || String(task.assigned_to) === executorFilter
    return statusMatches && executorMatches && isInsideDateRange(task)
  })
  const executorOptions = Array.from(new Set(tasks.map(t => t.assigned_to).filter(Boolean)))
    .map(id => users[id])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))

  const clearFilters = () => {
    setStatusFilter('all')
    setExecutorFilter('all')
    setDateStartFilter('')
    setDateEndFilter('')
  }

  const totalLate = tasks.filter(t => checkIsLate(t.deadline, t.status)).length
  const waitingConference = tasks.filter(t => t.status === 'Aguardando Conferência').length
  const waitingFinal = tasks.filter(t => t.status === 'Aguardando OK Final').length
  const done = tasks.filter(t => t.status === 'Aprovada').length

  const statuses = ['A Fazer', 'Aguardando Conferência', 'Aguardando OK Final', 'Aguardando Aprovação', 'Aprovada']

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div>
            <h3 className="text-3xl font-bold tracking-tight text-slate-800">Monitoramento da Operação</h3>
            <p className="text-slate-500 text-sm mt-1">Acompanhe o fluxo ponta a ponta: solicitante, executor, conferente e OK final.</p>
          </div>
        </div>
        {msg && <span className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide border ${msg.includes('Erro') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{msg}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
          <div><p className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Total de tarefas</p><p className="text-2xl font-extrabold text-slate-800">{tasks.length}</p></div>
          <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600"><BarChart3 size={20} /></div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
          <div><p className="text-emerald-600 font-bold text-[10px] uppercase tracking-wider">Na conferência</p><p className="text-2xl font-extrabold text-emerald-700">{waitingConference}</p></div>
          <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600"><ClipboardCheck size={20} /></div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
          <div><p className="text-purple-600 font-bold text-[10px] uppercase tracking-wider">OK final</p><p className="text-2xl font-extrabold text-purple-700">{waitingFinal}</p></div>
          <div className="bg-purple-50 p-2.5 rounded-xl text-purple-600"><Hourglass size={20} /></div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
          <div><p className="text-red-500 font-bold text-[10px] uppercase tracking-wider">Atrasadas</p><p className="text-2xl font-extrabold text-red-600">{totalLate}</p></div>
          <div className="bg-red-50 p-2.5 rounded-xl text-red-600"><AlertTriangle size={20} /></div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="mb-6 pb-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h4 className="text-xl font-bold text-slate-800">Linha de produção das tarefas</h4>
              <p className="text-slate-500 text-sm mt-1">Cada linha mostra quem pediu, quem executa, quem confere e as últimas movimentações.</p>
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <Filter size={14} /> {filteredTasks.length} de {tasks.length} tarefas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">Executor</label>
              <select value={executorFilter} onChange={e => setExecutorFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm font-bold text-slate-700 outline-none cursor-pointer">
                <option value="all">Todos</option>
                {executorOptions.map(executor => <option key={executor.id} value={String(executor.id)}>{executor.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm font-bold text-slate-700 outline-none cursor-pointer">
                <option value="all">Todos os status</option>
                {statuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">Data inicial</label>
              <input type="text" inputMode="numeric" placeholder="dd/mm/aaaa" value={dateStartFilter} onChange={e => setDateStartFilter(maskDateBR(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm font-bold text-slate-700 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">Data final</label>
              <input type="text" inputMode="numeric" placeholder="dd/mm/aaaa" value={dateEndFilter} onChange={e => setDateEndFilter(maskDateBR(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm font-bold text-slate-700 outline-none" />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={clearFilters} className="w-full px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-sm font-bold text-slate-600 transition-colors flex items-center justify-center gap-2">
                <RotateCcw size={14} /> Limpar filtros
              </button>
            </div>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center">
            <Users size={56} className="text-slate-200 mb-4" />
            <h4 className="text-xl font-bold text-slate-700">Nenhuma tarefa encontrada</h4>
            <p className="text-slate-400 mt-1">Ajuste o filtro ou aguarde novas demandas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-4 font-bold">Tarefa</th>
                  <th className="px-5 py-4 font-bold">Fluxo</th>
                  <th className="px-5 py-4 font-bold">Prioridade & Prazo</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 font-bold">Últimas movimentações</th>
                  <th className="px-5 py-4 font-bold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map(task => {
                  const templateName = templates[task.template_id]?.name || 'Template removido'
                  const isLateTask = checkIsLate(task.deadline, task.status)
                  const taskActivities = activities[task.id] || []
                  const requester = users[task.created_by]
                  const executor = users[task.assigned_to]
                  const reviewer = users[task.reviewer_id]

                  return (
                    <tr key={task.id} className={`transition-colors ${isLateTask ? 'bg-red-50/30 hover:bg-red-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-5 py-4 align-top">
                        <p className="font-bold text-slate-800 text-sm">{templateName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">ID #{task.id}</p>
                        {getTaskReferenceDate(task) && <p className="text-[10px] text-slate-400 font-semibold mt-1">Data: {formatDateBR(getTaskReferenceDate(task))}</p>}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div className="space-y-2 text-xs font-bold text-slate-600">
                          <div className="flex items-center gap-2"><UserRound size={13} className="text-purple-500" /> Solicitante: {requester?.name || 'Gestão / não informado'}</div>
                          <div className="flex items-center gap-2"><Users size={13} className="text-blue-500" /> Executor: {executor?.name || 'Não informado'}</div>
                          <div className="flex items-center gap-2"><ShieldCheck size={13} className="text-emerald-600" /> Conferente: {reviewer?.name || 'Sem conferente'}</div>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 uppercase tracking-wider">{cleanPriority(task.priority)}</span>
                          {task.deadline && (
                            <span className={`text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider ${isLateTask ? 'text-red-600' : 'text-slate-400'}`}>
                              <Calendar size={12} /> {formatDateBR(task.deadline)} {isLateTask && ' (ATRASADA)'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full ${getStatusColor(task.status, isLateTask)}`}>
                          {isLateTask && task.status === 'A Fazer' ? 'ATRASADO' : task.status}
                        </span>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mt-2">
                          {task.folder === 'Entrada' ? <Inbox size={13} className="text-slate-400"/> : <Folder size={13} className="text-slate-400"/>} 
                          {task.folder || 'Entrada'}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-top">
                        {taskActivities.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Sem histórico registrado.</p>
                        ) : (
                          <div className="space-y-2 max-w-md">
                            {taskActivities.slice(0, 3).map(activity => (
                              <div key={activity.id} className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                                <p className="text-xs font-bold text-slate-700">{activity.action}</p>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{activity.actor_name || 'Sistema'} • {formatDateTimeBR(activity.created_at)}</p>
                                {activity.note && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{activity.note}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center align-top">
                        <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir Tarefa">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}
