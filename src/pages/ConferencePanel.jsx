import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import { ArrowLeft, ClipboardCheck, CheckCircle, XCircle, Send, FileText, Paperclip, Link as LinkIcon, Image as ImageIcon, File as FileIcon, Maximize2, MessageSquare, AlertTriangle, Calendar, Briefcase, UserCheck } from 'lucide-react'

const isImage = (url) => typeof url === 'string' && url.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null
const cleanPriority = (p) => p ? p.replace(/[^\w\s]/gi, '').trim() : 'Normal'
const checkIsLate = (deadline, status) => {
  if (!deadline || status === 'Aprovada') return false
  const [y, m, d] = deadline.split('-')
  const deadlineDate = new Date(y, m - 1, d, 23, 59, 59)
  return new Date() > deadlineDate
}

export default function ConferencePanel({ user, setActiveTab }) {
  const [tasks, setTasks] = useState([])
  const [templates, setTemplates] = useState({})
  const [users, setUsers] = useState({})
  const [clients, setClients] = useState({})
  const [feedbacks, setFeedbacks] = useState({})
  const [chatInputs, setChatInputs] = useState({})
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [user.id])

  const fetchData = async () => {
    try {
      const [tasksRes, templatesRes, usersRes, clientsRes] = await Promise.all([
        api.get(`/reviewer-tasks/${user.id}`),
        api.get('/templates/'),
        api.get('/users/'),
        api.get('/all-clients/')
      ])

      setTasks(tasksRes.data)

      const tempMap = {}
      templatesRes.data.forEach(t => tempMap[t.id] = t)
      setTemplates(tempMap)

      const userMap = {}
      usersRes.data.forEach(u => userMap[u.id] = u)
      setUsers(userMap)

      const clientMap = {}
      clientsRes.data.forEach(c => clientMap[c.id] = c.company_name)
      setClients(clientMap)
    } catch (err) {
      console.error('Erro ao buscar conferências', err)
    }
  }

  const handleApprove = async (task) => {
    try {
      await api.post(`/tasks/${task.id}/reviewer-approve`, {
        actor_id: user.id,
        actor_name: user.name,
        feedback: feedbacks[task.id] || ''
      })
      setMsg('Tarefa conferida e enviada para OK final do solicitante.')
      setFeedbacks({ ...feedbacks, [task.id]: '' })
      fetchData()
      setTimeout(() => setMsg(''), 3500)
    } catch (err) {
      setMsg('Erro ao aprovar conferência.')
    }
  }

  const handleReject = async (task) => {
    const feedback = feedbacks[task.id]?.trim()
    if (!feedback) return setMsg('Erro: informe o motivo da devolução antes de recusar.')

    try {
      await api.post(`/tasks/${task.id}/reviewer-reject`, {
        actor_id: user.id,
        actor_name: user.name,
        feedback
      })
      setMsg('Tarefa devolvida ao parceiro executor.')
      setFeedbacks({ ...feedbacks, [task.id]: '' })
      fetchData()
      setTimeout(() => setMsg(''), 3500)
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Erro ao devolver tarefa.')
    }
  }

  const sendComment = async (task) => {
    const text = chatInputs[task.id]
    if (!text || !text.trim()) return
    try {
      await api.post(`/tasks/${task.id}/comments`, { sender: user.name, text: text.trim() })
      await api.post(`/users/${task.assigned_to}/notifications`, { text: 'Nova mensagem do conferente em uma tarefa.' })
      setChatInputs({ ...chatInputs, [task.id]: '' })
      fetchData()
    } catch (err) { console.error('Erro no chat', err) }
  }

  const pendingTasks = tasks.filter(t => t.status === 'Aguardando Conferência')
  const alreadyHandled = tasks.filter(t => t.status !== 'Aguardando Conferência')

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div>
            <h3 className="text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><ClipboardCheck size={28} /> Conferência de Tarefas</h3>
            <p className="text-slate-500 mt-1">Revise entregas dos parceiros antes do OK final do solicitante.</p>
          </div>
        </div>
        {msg && <span className={`px-4 py-2 rounded-lg font-bold text-xs border ${msg.includes('Erro') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{msg}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
          <div><p className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Aguardando conferência</p><p className="text-2xl font-extrabold text-slate-800">{pendingTasks.length}</p></div>
          <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600"><ClipboardCheck size={20} /></div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
          <div><p className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Já movimentadas</p><p className="text-2xl font-extrabold text-slate-800">{alreadyHandled.length}</p></div>
          <div className="bg-slate-100 p-2.5 rounded-xl text-slate-600"><UserCheck size={20} /></div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
          <div><p className="text-red-500 font-bold text-[10px] uppercase tracking-wider">Atrasadas</p><p className="text-2xl font-extrabold text-red-600">{pendingTasks.filter(t => checkIsLate(t.deadline, t.status)).length}</p></div>
          <div className="bg-red-50 p-2.5 rounded-xl text-red-600"><AlertTriangle size={20} /></div>
        </div>
      </div>

      {pendingTasks.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center flex flex-col items-center">
          <CheckCircle size={56} className="text-slate-200 mb-4" />
          <h4 className="text-xl font-bold text-slate-700">Nenhuma tarefa aguardando conferência.</h4>
          <p className="text-slate-400 mt-1">Quando um parceiro enviar uma entrega para você conferir, ela aparecerá aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pendingTasks.map(task => {
            const template = templates[task.template_id]
            const executor = users[task.assigned_to]
            const creator = users[task.created_by]
            const isLateTask = checkIsLate(task.deadline, task.status)
            if (!template || !executor) return null

            return (
              <div key={task.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col ${isLateTask ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-200'}`}>
                {isLateTask && (
                  <div className="bg-red-600 text-white text-xs font-bold uppercase tracking-widest py-2 px-4 flex items-center justify-center gap-2">
                    <AlertTriangle size={16} /> Entrega em atraso
                  </div>
                )}

                <div className="bg-slate-50 p-5 border-b border-slate-200">
                  <div className="flex justify-between gap-4">
                    <div>
                      <h5 className="font-bold text-lg text-slate-800">{template.name}</h5>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Executor: <span className="text-blue-600">{executor.name}</span></p>
                      {creator && <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Solicitante: <span className="text-purple-600">{creator.name}</span></p>}
                    </div>
                    <span className="h-fit text-[10px] bg-emerald-50 border border-emerald-200 px-2 py-1 rounded text-emerald-700 font-bold uppercase tracking-wider">Conferir</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] bg-white border border-slate-300 px-2 py-1 rounded text-slate-600 font-bold uppercase tracking-wider">{cleanPriority(task.priority)}</span>
                    {task.deadline && <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider flex items-center gap-1 ${isLateTask ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-500 border-slate-200'}`}><Calendar size={12} /> Prazo: {task.deadline.split('-').reverse().join('/')}</span>}
                    {task.client_id && clients[task.client_id] && <span className="text-[10px] bg-pink-50 border border-pink-200 px-2 py-1 rounded text-pink-700 font-bold uppercase tracking-wider flex items-center gap-1"><Briefcase size={12} /> {clients[task.client_id]}</span>}
                  </div>
                </div>

                <div className="p-5 space-y-4 flex-1 border-b border-slate-100">
                  {task.admin_notes && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                      <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Observações</p>
                      <p className="text-amber-700 text-sm whitespace-pre-wrap">{task.admin_notes}</p>
                    </div>
                  )}

                  {task.admin_attachments && task.admin_attachments.length > 0 && (
                    <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg">
                      <h6 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Paperclip size={12} /> Referências da Tarefa</h6>
                      <div className="space-y-1.5">
                        {task.admin_attachments.map((att, idx) => (
                          <div key={idx}>
                            {isImage(att) ? (
                              <a href={att} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:underline"><ImageIcon size={14} /> Imagem Referência</a>
                            ) : (
                              <a href={att.startsWith('http') ? att : `http://${att}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 text-xs font-bold hover:underline"><LinkIcon size={14} /> <span className="truncate max-w-[250px]">{att}</span></a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12} /> Entrega recebida</h6>
                  {Object.entries(task.dynamic_data || {}).map(([key, val]) => (
                    <div key={key} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{key}</span>
                      {typeof val === 'boolean' ? (
                        <span className={`text-xs font-bold px-2 py-1 rounded flex w-fit items-center gap-1 ${val ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>{val ? 'Confirmado' : 'Não Confirmado'}</span>
                      ) : (val?.startsWith?.('http') ? (
                        isImage(val) ? (
                          <div className="mt-2 relative group">
                            <img src={val} alt="Anexo" className="w-full max-h-48 object-cover rounded-lg border border-slate-200 shadow-sm" />
                            <a href={val} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-bold text-slate-700 bg-white/90 backdrop-blur px-2 py-1.5 rounded-md hover:bg-white transition-colors shadow-sm border border-slate-200"><Maximize2 size={12}/> Abrir Original</a>
                          </div>
                        ) : (
                          <a href={val} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors text-blue-600 text-sm font-medium"><FileIcon size={16} /> {val.split('/').pop()}</a>
                        )
                      ) : (
                        <span className="text-slate-800 text-sm font-medium whitespace-pre-wrap block bg-slate-50 p-2.5 rounded border border-slate-100">{val || 'Não preenchido'}</span>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-white border-b border-slate-100">
                  <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3"><MessageSquare size={12} /> Chat Interno</h6>
                  <div className="space-y-2 max-h-32 overflow-y-auto mb-3 pr-1">
                    {task.comments?.length === 0 ? <p className="text-xs text-slate-400">Nenhuma mensagem.</p> : null}
                    {task.comments?.map((c, i) => (
                      <div key={i} className={`p-2.5 rounded-lg text-sm w-[85%] ${c.sender === user.name ? 'bg-slate-800 text-white ml-auto rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                        <span className="font-bold text-[10px] opacity-60 block mb-0.5 uppercase">{c.sender} • {c.time}</span>
                        {c.text}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Responder no chat..." value={chatInputs[task.id] || ''} onChange={e => setChatInputs({...chatInputs, [task.id]: e.target.value})} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 bg-slate-50" onKeyDown={(e) => e.key === 'Enter' && sendComment(task)} />
                    <button onClick={() => sendComment(task)} className="bg-slate-200 text-slate-700 hover:bg-slate-300 px-3 py-2 rounded-lg transition-colors"><Send size={16} /></button>
                  </div>
                </div>

                <div className="p-5 bg-slate-50 space-y-3">
                  <textarea 
                    placeholder="Observação da conferência ou motivo da devolução..." 
                    value={feedbacks[task.id] || ''}
                    onChange={e => setFeedbacks({...feedbacks, [task.id]: e.target.value})}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-sm resize-none"
                    rows="2"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(task)} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all shadow-md flex justify-center items-center gap-2"><CheckCircle size={18} /> Enviar para OK</button>
                    <button onClick={() => handleReject(task)} className="flex-1 bg-white hover:bg-red-50 text-red-600 font-bold py-3 rounded-xl transition-all border border-red-200 flex justify-center items-center gap-2"><XCircle size={18} /> Devolver</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
