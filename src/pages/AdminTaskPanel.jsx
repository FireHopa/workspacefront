import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import { ArrowLeft, Users, Trash2, Calendar, Inbox, Folder, AlertTriangle } from 'lucide-react'

// Mesma função para você (Admin) rastrear quem estourou o prazo
const checkIsLate = (deadline, status) => {
  if (!deadline || status !== 'A Fazer') return false;
  const [y, m, d] = deadline.split('-');
  const deadlineDate = new Date(y, m - 1, d, 23, 59, 59);
  return new Date() > deadlineDate;
};

export default function AdminTaskPanel({ setActiveTab }) {
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [templates, setTemplates] = useState({})
  const [msg, setMsg] = useState('')

  useEffect(() => { 
    fetchMonitoringData() 
    const interval = setInterval(fetchMonitoringData, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchMonitoringData = async () => {
    try {
      const [usersRes, tasksRes, templatesRes] = await Promise.all([
        api.get('/users/'), api.get('/all-tasks/'), api.get('/templates/')
      ])

      setEmployees(usersRes.data.filter(u => u.role === 'employee'))
      setTasks(tasksRes.data)

      const tempMap = {}
      templatesRes.data.forEach(t => tempMap[t.id] = t)
      setTemplates(tempMap)
    } catch (error) { console.error("Erro ao buscar dados", error) }
  }

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Tem certeza que deseja excluir esta tarefa permanentemente? O Parceiro perderá o acesso a ela.")) return;
    try {
      await api.delete(`/tasks/${taskId}`)
      setMsg('Tarefa excluída com sucesso!')
      fetchMonitoringData()
      setTimeout(() => setMsg(''), 3000)
    } catch (error) {
      setMsg('Erro ao excluir tarefa.')
    }
  }

  const cleanPriority = (p) => p ? p.replace(/[^\w\s]/gi, '').trim() : 'Normal'

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
            <ArrowLeft size={16} /> Voltar
          </button>
          <h3 className="text-3xl font-bold tracking-tight text-slate-800">Monitoramento da Equipe</h3>
        </div>
        {msg && <span className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide border ${msg.includes('Erro') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{msg}</span>}
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="mb-6 pb-6 border-b border-slate-100">
          <h4 className="text-xl font-bold text-slate-800">Visão Geral de Tarefas</h4>
          <p className="text-slate-500 text-sm mt-1">Acompanhe o volume de trabalho, prazos e exclua demandas se necessário.</p>
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center">
            <Users size={56} className="text-slate-200 mb-4" />
            <h4 className="text-xl font-bold text-slate-700">Equipe Vazia</h4>
            <p className="text-slate-400 mt-1">Nenhum Parceiro cadastrado na base ainda.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {employees.map(employee => {
              const employeeTasks = tasks.filter(t => t.assigned_to === employee.id)
              
              // NOVO: Coletando métrica de atrasos por funcionário
              const lateCount = employeeTasks.filter(t => checkIsLate(t.deadline, t.status)).length
              const pending = employeeTasks.filter(t => t.status === 'A Fazer' && !checkIsLate(t.deadline, t.status)).length
              const review = employeeTasks.filter(t => t.status === 'Aguardando Aprovação').length
              const done = employeeTasks.filter(t => t.status === 'Aprovada').length

              return (
                <div key={employee.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 p-5 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
                    <div>
                      <h5 className="font-bold text-lg text-slate-800 flex items-center gap-3">
                        <span className="bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">{employee.name.charAt(0)}</span>
                        {employee.name}
                      </h5>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1 ml-11">{employee.email}</p>
                    </div>
                    
                    <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
                      {lateCount > 0 && <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-md border border-red-200 flex items-center gap-1.5"><AlertTriangle size={12}/> Atrasadas: {lateCount}</span>}
                      <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md border border-blue-100">No Prazo: {pending}</span>
                      <span className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-md border border-orange-100">Em Análise: {review}</span>
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-md border border-emerald-100">Concluídas: {done}</span>
                    </div>
                  </div>

                  <div className="p-0 overflow-x-auto">
                    {employeeTasks.length === 0 ? (
                      <p className="text-slate-400 text-sm p-6 italic text-center">Nenhuma tarefa delegada para este Parceiro.</p>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100">
                            <th className="px-6 py-4 font-bold">Tarefa (Template)</th>
                            <th className="px-6 py-4 font-bold">Prioridade & Prazo</th>
                            <th className="px-6 py-4 font-bold">Status Atual</th>
                            <th className="px-6 py-4 font-bold">Workspace</th>
                            <th className="px-6 py-4 font-bold text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {employeeTasks.map(task => {
                            const templateName = templates[task.template_id]?.name || 'Template Removido'
                            const isLateTask = checkIsLate(task.deadline, task.status)
                            
                            let statusColor = 'bg-slate-100 text-slate-700'
                            if (task.status === 'A Fazer') statusColor = isLateTask ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                            if (task.status === 'Aguardando Aprovação') statusColor = 'bg-amber-50 text-amber-700 border border-amber-200'
                            if (task.status === 'Aprovada') statusColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200'

                            return (
                              <tr key={task.id} className={`transition-colors ${isLateTask ? 'bg-red-50/30 hover:bg-red-50' : 'hover:bg-slate-50'}`}>
                                <td className="px-6 py-4 font-bold text-slate-800 text-sm">{templateName}</td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1.5 items-start">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 uppercase tracking-wider">{cleanPriority(task.priority)}</span>
                                    {task.deadline && (
                                      <span className={`text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider ${isLateTask ? 'text-red-600' : 'text-slate-400'}`}>
                                        <Calendar size={12} /> {task.deadline.split('-').reverse().join('/')} {isLateTask && ' (ATRASADA)'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full ${statusColor}`}>
                                    {isLateTask ? 'ATRASADO' : task.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mt-2">
                                  {task.folder === 'Entrada' ? <Inbox size={14} className="text-slate-400"/> : <Folder size={14} className="text-slate-400"/>} 
                                  {task.folder || 'Entrada'}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center w-full" title="Excluir Tarefa">
                                    <Trash2 size={18} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}