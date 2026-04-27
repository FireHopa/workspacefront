import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { jwtDecode } from "jwt-decode"
import { api } from '../services/api'
import { CheckCircle, XCircle, MessageSquare, Image as ImageIcon, FileIcon, Send, Maximize2, FileText, Paperclip, Link as LinkIcon, AlertTriangle, Calendar, Filter } from 'lucide-react'

const checkIsLate = (deadline) => {
  if (!deadline) return false;
  const [y, m, d] = deadline.split('-');
  const deadlineDate = new Date(y, m - 1, d, 23, 59, 59);
  return new Date() > deadlineDate;
};

export default function Approvals({ setActiveTab }) {
  const [pendingTasks, setPendingTasks] = useState([])
  const [templates, setTemplates] = useState({})
  const [users, setUsers] = useState({})
  const [msg, setMsg] = useState('')
  const [feedbacks, setFeedbacks] = useState({}) 
  const [chatInputs, setChatInputs] = useState({}) 
  
  // NOVO: Estado do filtro de funcionários
  const [filterEmployee, setFilterEmployee] = useState('all')

  const token = localStorage.getItem('token')
  const adminName = token ? jwtDecode(token).name : 'Administração'

  useEffect(() => { 
    fetchData()
    const interval = setInterval(fetchData, 10000) 
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const [tasksRes, templatesRes, usersRes] = await Promise.all([
        api.get('/all-tasks/'), api.get('/templates/'), api.get('/users/')
      ])
      const tempMap = {}; templatesRes.data.forEach(t => tempMap[t.id] = t); setTemplates(tempMap)
      const userMap = {}; usersRes.data.forEach(u => userMap[u.id] = u); setUsers(userMap)
      setPendingTasks(tasksRes.data.filter(t => t.status === 'Aguardando Aprovação'))
    } catch (error) { console.error(error) }
  }

  // Se você aprovar a última tarefa de um funcionário filtrado, o filtro reseta automaticamente
  useEffect(() => {
    if (filterEmployee !== 'all' && !pendingTasks.some(t => t.assigned_to.toString() === filterEmployee)) {
      setFilterEmployee('all')
    }
  }, [pendingTasks, filterEmployee])

  const handleAction = async (taskId, newStatus, employeeId) => {
    setMsg('')
    const feedbackText = feedbacks[taskId] || ''
    if (newStatus === 'A Fazer' && !feedbackText.trim()) return setMsg('Erro: Digite o motivo da devolução no campo de texto.')

    try {
      const taskToUpdate = pendingTasks.find(t => t.id === taskId)
      
      let nextFolder = taskToUpdate.folder;
      if (newStatus === 'Aprovada') nextFolder = 'Concluídas';
      if (newStatus === 'A Fazer') nextFolder = 'Entrada';

      await api.put(`/tasks/${taskId}`, { 
        dynamic_data: taskToUpdate.dynamic_data, 
        status: newStatus,
        admin_feedback: newStatus === 'A Fazer' ? feedbackText : '', 
        folder: nextFolder
      })

      await api.post(`/users/${employeeId}/notifications`, { text: newStatus === 'Aprovada' ? 'Sua tarefa foi aprovada!' : 'Atenção: Tarefa devolvida para correção.' })
      setMsg(`Tarefa ${newStatus === 'Aprovada' ? 'aprovada' : 'devolvida'} com sucesso!`)
      fetchData() 
      setTimeout(() => setMsg(''), 4000)
    } catch (error) { setMsg('Erro ao atualizar tarefa.') }
  }

  const sendComment = async (taskId, employeeId) => {
    const text = chatInputs[taskId]
    if (!text || !text.trim()) return;
    try {
      await api.post(`/tasks/${taskId}/comments`, { sender: adminName, text: text.trim() })
      await api.post(`/users/${employeeId}/notifications`, { text: `Nova mensagem na tarefa da Administração` })
      setChatInputs({ ...chatInputs, [taskId]: '' })
      fetchData()
    } catch (error) { console.error("Erro no chat") }
  }

  const isImage = (url) => typeof url === 'string' && url.match(/\.(jpeg|jpg|gif|png)$/i) != null
  const cleanPriority = (p) => p ? p.replace(/[^\w\s]/gi, '').trim() : 'Normal'

  // Variáveis para a inteligência do Filtro
  const employeesWithPending = [...new Set(pendingTasks.map(t => t.assigned_to))]
  const filteredTasks = filterEmployee === 'all' 
    ? pendingTasks 
    : pendingTasks.filter(t => t.assigned_to.toString() === filterEmployee)

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setActiveTab('dashboard')} className="px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">Voltar</button>
        <h3 className="text-3xl font-bold tracking-tight text-slate-800">Centro de Aprovações</h3>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        
        {/* CABEÇALHO COM O NOVO FILTRO DE FUNCIONÁRIO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-6 border-b border-slate-100 gap-4">
          <div>
            <h4 className="text-xl font-bold text-slate-800">Aguardando Revisão</h4>
            <p className="text-slate-500 text-sm mt-1">Verifique o trabalho da equipe e converse via chat se necessário.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {msg && <span className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide border ${msg.includes('Erro') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{msg}</span>}
            
            {/* COMPONENTE DO FILTRO */}
            {pendingTasks.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-sm hover:bg-slate-100 transition-colors">
                <Filter size={14} className="text-slate-500" />
                <select 
                  value={filterEmployee} 
                  onChange={e => setFilterEmployee(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer w-48"
                >
                  <option value="all">Todas as tarefas</option>
                  {employeesWithPending.map(empId => (
                    <option key={empId} value={empId}>{users[empId]?.name.split(' ')[0]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {pendingTasks.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center">
            <CheckCircle size={56} className="text-slate-200 mb-4" />
            <h4 className="text-xl font-bold text-slate-700">Tudo aprovado!</h4>
            <p className="text-slate-400 mt-1">Nenhuma tarefa aguardando sua revisão no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredTasks.map(task => {
              const employee = users[task.assigned_to]
              const template = templates[task.template_id]
              const isLateTask = checkIsLate(task.deadline)
              
              if (!employee || !template) return null

              return (
                <div key={task.id} className={`border rounded-xl overflow-hidden shadow-sm flex flex-col ${isLateTask ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-200'}`}>
                  
                  {isLateTask && (
                    <div className="bg-red-600 text-white text-xs font-bold uppercase tracking-widest py-2 px-4 flex items-center justify-center gap-2 shadow-sm z-10">
                      <AlertTriangle size={16} /> Tarefa Entregue com Atraso
                    </div>
                  )}

                  <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-start">
                    <div>
                      <h5 className="font-bold text-lg text-slate-800">{template.name}</h5>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Enviado por <span className="text-blue-600">{employee.name}</span></p>
                      
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] bg-white border border-slate-300 px-2 py-1 rounded text-slate-600 font-bold uppercase tracking-wider">{cleanPriority(task.priority)}</span>
                        {task.deadline && (
                          <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider flex items-center gap-1 ${isLateTask ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                            <Calendar size={12} /> Prazo: {task.deadline.split('-').reverse().join('/')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-4 flex-1 border-b border-slate-100">
                    {task.admin_attachments && task.admin_attachments.length > 0 && (
                        <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg mb-4">
                          <h6 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Paperclip size={12} /> Referências da Tarefa</h6>
                          <div className="space-y-1.5">
                            {task.admin_attachments.map((att, idx) => (
                              <div key={idx}>
                                {isImage(att) ? (
                                  <a href={att} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:underline"><ImageIcon size={14} /> Imagem Referência</a>
                                ) : (
                                  <a href={att.startsWith('http') ? att : `http://${att}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 text-xs font-bold hover:underline">
                                    <LinkIcon size={14} /> <span className="truncate max-w-[250px]">{att}</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12} /> Entrega do Parceiro</h6>
                    
                    {Object.entries(task.dynamic_data || {}).map(([key, val]) => (
                      <div key={key} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{key}</span>
                        {typeof val === 'boolean' ? (
                          <span className={`text-xs font-bold px-2 py-1 rounded flex w-fit items-center gap-1 ${val ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                            {val ? <><CheckCircle size={12} /> Confirmado</> : <><XCircle size={12} /> Não Confirmado</>}
                          </span>
                        ) : (val.startsWith('http') ? (
                          isImage(val) ? (
                            <div className="mt-2 relative group">
                              <img src={val} alt="Anexo" className="w-full max-h-48 object-cover rounded-lg border border-slate-200 shadow-sm" />
                              <a href={val} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-bold text-slate-700 bg-white/90 backdrop-blur px-2 py-1.5 rounded-md hover:bg-white transition-colors shadow-sm border border-slate-200"><Maximize2 size={12}/> Abrir Original</a>
                            </div>
                          ) : (
                            <a href={val} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors text-blue-600 text-sm font-medium">
                              <FileIcon size={16} /> {val.split('/').pop()}
                            </a>
                          )
                        ) : (
                          <span className="text-slate-800 text-sm font-medium whitespace-pre-wrap block bg-slate-50 p-2.5 rounded border border-slate-100">{val || "Não preenchido"}</span>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-white border-b border-slate-100">
                    <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3"><MessageSquare size={12} /> Chat Interno</h6>
                    <div className="space-y-2 max-h-32 overflow-y-auto mb-3 pr-1">
                      {task.comments?.length === 0 ? <p className="text-xs text-slate-400">Nenhuma mensagem.</p> : null}
                      {task.comments?.map((c, i) => (
                        <div key={i} className={`p-2.5 rounded-lg text-sm w-[85%] ${c.sender === adminName ? 'bg-slate-800 text-white ml-auto rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                          <span className="font-bold text-[10px] opacity-60 block mb-0.5 uppercase">{c.sender} • {c.time}</span>
                          {c.text}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Responder no chat..." value={chatInputs[task.id] || ''} onChange={e => setChatInputs({...chatInputs, [task.id]: e.target.value})} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 bg-slate-50" onKeyDown={(e) => e.key === 'Enter' && sendComment(task.id, employee.id)} />
                      <button onClick={() => sendComment(task.id, employee.id)} className="bg-slate-200 text-slate-700 hover:bg-slate-300 px-3 py-2 rounded-lg transition-colors"><Send size={16} /></button>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50 space-y-3">
                    <textarea 
                      placeholder="Motivo da devolução (Obrigatório caso reprovado)..." 
                      value={feedbacks[task.id] || ''}
                      onChange={e => setFeedbacks({...feedbacks, [task.id]: e.target.value})}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none text-sm resize-none"
                      rows="2"
                    />
                    <div className="flex gap-3">
                      <button onClick={() => handleAction(task.id, 'Aprovada', employee.id)} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all shadow-md flex justify-center items-center gap-2"><CheckCircle size={18} /> Aprovar</button>
                      <button onClick={() => handleAction(task.id, 'A Fazer', employee.id)} className="flex-1 bg-white hover:bg-red-50 text-red-600 font-bold py-3 rounded-xl transition-all border border-red-200 flex justify-center items-center gap-2"><XCircle size={18} /> Devolver</button>
                    </div>
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