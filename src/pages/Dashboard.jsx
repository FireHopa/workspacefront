import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import { Users, FileText, Send, CheckCircle, BarChart3, Clock, Trophy, Inbox, Folder, Search, AlertTriangle, Paperclip, Image as ImageIcon, File as FileIcon, Trash2, MessageSquare, Plus, Calendar, Link as LinkIcon, Maximize2, Hourglass, AlertCircle, Briefcase, Info, ClipboardCheck, XCircle } from 'lucide-react'

const checkIsLate = (deadline, status) => {
  if (!deadline || status !== 'A Fazer') return false;
  const [y, m, d] = deadline.split('-');
  const deadlineDate = new Date(y, m - 1, d, 23, 59, 59);
  return new Date() > deadlineDate;
};

export default function Dashboard({ user, setActiveTab }) {
  const [tasks, setTasks] = useState([])
  const [createdTasks, setCreatedTasks] = useState([])
  const [templates, setTemplates] = useState({})
  const [clientsMap, setClientsMap] = useState({}) // NOVO ESTADO: Mapa de Clientes
  const [usersMap, setUsersMap] = useState({})
  const [taskAnswers, setTaskAnswers] = useState({})
  const [msg, setMsg] = useState('')

  const [folders, setFolders] = useState(['Entrada', 'Atrasado', 'Aguardando Conferência', 'Aguardando OK Final', 'Aguardando Aprovação', 'Concluídas'])
  const [activeFolder, setActiveFolder] = useState('Entrada')
  const [newFolderName, setNewFolderName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [chatInputs, setChatInputs] = useState({})
  const [finalFeedbacks, setFinalFeedbacks] = useState({})

  useEffect(() => { 
    if (user.role === 'employee') {
      fetchEmployeeData()
      const interval = setInterval(fetchEmployeeData, 10000) 
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchEmployeeData = async () => {
    try {
      const [tasksRes, templatesRes, clientsRes, createdRes, usersRes] = await Promise.all([
        api.get(`/tasks/${user.id}`), 
        api.get('/templates/'),
        api.get('/all-clients/'),
        api.get(`/tasks-created/${user.id}`),
        api.get('/users/')
      ])
      
      const tempMap = {}; templatesRes.data.forEach(t => tempMap[t.id] = t); setTemplates(tempMap)
      
      const cMap = {}; clientsRes.data.forEach(c => cMap[c.id] = c.company_name); setClientsMap(cMap) // MONTA O MAPA

      const uMap = {}; usersRes.data.forEach(u => uMap[u.id] = u); setUsersMap(uMap)
      setCreatedTasks(createdRes.data)
      
      let updatedTasks = [...tasksRes.data];
      let needsDbUpdate = [];

      updatedTasks = updatedTasks.map(task => {
        if (checkIsLate(task.deadline, task.status) && task.folder !== 'Atrasado') {
          task.folder = 'Atrasado';
          needsDbUpdate.push(task);
        }
        return task;
      });

      setTasks(updatedTasks)

      setTaskAnswers(prev => {
        const newAnswers = { ...prev }
        updatedTasks.forEach(task => {
          if (!newAnswers[task.id]) newAnswers[task.id] = task.dynamic_data || {}
        })
        return newAnswers
      })
      
      const foundFolders = new Set(['Entrada']) 
      updatedTasks.forEach(task => { if(task.folder) foundFolders.add(task.folder) })
      
      foundFolders.delete('Entrada'); foundFolders.delete('Concluídas'); foundFolders.delete('Aguardando Aprovação'); foundFolders.delete('Aguardando Conferência'); foundFolders.delete('Aguardando OK Final'); foundFolders.delete('Atrasado')
      setFolders(['Entrada', ...Array.from(foundFolders), 'Atrasado', 'Aguardando Conferência', 'Aguardando OK Final', 'Aguardando Aprovação', 'Concluídas'])

      needsDbUpdate.forEach(t => {
        api.put(`/tasks/${t.id}`, { dynamic_data: t.dynamic_data || {}, status: t.status, folder: 'Atrasado', admin_feedback: t.admin_feedback || '' });
      });

    } catch (error) { console.error(error) }
  }

  const handleFieldChange = (taskId, fieldName, value) => setTaskAnswers(prev => ({ ...prev, [taskId]: { ...prev[taskId], [fieldName]: value } }))

  const handleFileUpload = async (taskId, fieldName, file) => {
    if (!file) return;
    const formData = new FormData(); formData.append('file', file)
    try {
      handleFieldChange(taskId, fieldName, 'loading...')
      const response = await api.post('/upload/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      handleFieldChange(taskId, fieldName, response.data.url)
    } catch (err) { handleFieldChange(taskId, fieldName, ''); setMsg('Erro no upload') }
  }

  const handleRemoveFile = async (taskId, fieldName, fileUrl) => {
    try {
      const filename = fileUrl.split('/').pop()
      await api.delete(`/upload/${filename}`); handleFieldChange(taskId, fieldName, '') 
    } catch (err) { handleFieldChange(taskId, fieldName, '') }
  }

  const handleSubmitTask = async (taskId, e) => {
    e.preventDefault(); setMsg('')
    try {
      const task = tasks.find(t => t.id === taskId)
      await api.put(`/tasks/${taskId}`, { 
        dynamic_data: taskAnswers[taskId], 
        status: task?.status || 'A Fazer', 
        folder: task?.folder || 'Entrada',
        admin_feedback: '',
        actor_id: user.id,
        actor_name: user.name
      })
      await api.post(`/tasks/${taskId}/send-to-reviewer`, { actor_id: user.id, actor_name: user.name })
      
      setMsg(task?.reviewer_id ? 'Tarefa enviada para conferência!' : 'Tarefa enviada para aprovação!')
      fetchEmployeeData()
      setTimeout(() => setMsg(''), 4000)
    } catch (error) { setMsg('Erro ao enviar tarefa.') }
  }

  const handleCreateFolder = (e) => {
    e.preventDefault()
    const name = newFolderName.trim()
    const reservedNames = ['entrada', 'concluídas', 'aguardando aprovação', 'aguardando conferência', 'aguardando ok final', 'atrasado']
    
    if(name && !reservedNames.includes(name.toLowerCase()) && !folders.includes(name)) {
      setFolders(prev => {
        const custom = prev.filter(f => !['Entrada', 'Concluídas', 'Aguardando Aprovação', 'Atrasado'].includes(f))
        return ['Entrada', ...custom, name, 'Atrasado', 'Aguardando Conferência', 'Aguardando OK Final', 'Aguardando Aprovação', 'Concluídas']
      })
      setNewFolderName('')
    }
  }

  const handleMoveTask = async (taskId, newFolder) => {
    try {
      const task = tasks.find(t => t.id === taskId)
      await api.put(`/tasks/${taskId}`, { 
        dynamic_data: taskAnswers[taskId], 
        status: task.status, 
        folder: newFolder,
        admin_feedback: task.admin_feedback 
      })
      fetchEmployeeData()
    } catch (error) { console.error("Erro") }
  }

  const sendComment = async (taskId) => {
    const text = chatInputs[taskId]
    if (!text || !text.trim()) return;
    try {
      await api.post(`/tasks/${taskId}/comments`, { sender: user.name, text: text.trim() })
      setChatInputs({ ...chatInputs, [taskId]: '' })
      fetchEmployeeData()
    } catch (error) { console.error("Erro no chat") }
  }

  const handleFinalApprove = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/final-approve`, { actor_id: user.id, actor_name: user.name })
      setMsg('OK final registrado. Tarefa concluída!')
      fetchEmployeeData()
      setTimeout(() => setMsg(''), 4000)
    } catch (error) { setMsg('Erro ao aprovar tarefa.') }
  }

  const handleFinalReject = async (taskId) => {
    const feedback = finalFeedbacks[taskId]?.trim()
    if (!feedback) return setMsg('Erro: informe o motivo antes de devolver a tarefa.')
    try {
      await api.post(`/tasks/${taskId}/final-reject`, { actor_id: user.id, actor_name: user.name, feedback })
      setMsg('Tarefa devolvida ao parceiro executor.')
      setFinalFeedbacks({ ...finalFeedbacks, [taskId]: '' })
      fetchEmployeeData()
      setTimeout(() => setMsg(''), 4000)
    } catch (error) { setMsg('Erro ao devolver tarefa.') }
  }

  const isImage = (url) => typeof url === 'string' && url.match(/\.(jpeg|jpg|gif|png)$/i) != null
  const cleanPriority = (p) => p ? p.replace(/[^\w\s]/gi, '').trim() : 'Normal'
  const getPriorityColor = (p) => {
    const clean = cleanPriority(p)
    if (clean === 'Urgente') return 'bg-red-50 text-red-700 border-red-200'
    if (clean === 'Alta') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-slate-50 text-slate-600 border-slate-200'
  }

  if (user.role === 'employee') {
    const pendingCount = tasks.filter(t => t.status === 'A Fazer' && t.folder !== 'Atrasado').length
    const lateCount = tasks.filter(t => t.folder === 'Atrasado').length
    const reviewCount = tasks.filter(t => ['Aguardando Aprovação', 'Aguardando Conferência', 'Aguardando OK Final'].includes(t.status)).length
    const doneCount = tasks.filter(t => t.status === 'Aprovada').length
    
    const filteredTasks = tasks.filter(t => {
      const isInFolder = (t.folder || 'Entrada') === activeFolder
      const templateName = (templates[t.template_id]?.name || '').toLowerCase()
      // Filtro de busca aprimorado (procura pelo nome da tarefa ou nome do cliente)
      const clientName = (clientsMap[t.client_id] || '').toLowerCase()
      const search = searchTerm.toLowerCase()
      return isInFolder && (templateName.includes(search) || clientName.includes(search))
    })

    const finalApprovalTasks = createdTasks.filter(t => t.status === 'Aguardando OK Final')

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
              <h3 className="text-3xl font-bold tracking-tight text-slate-800">Meu Workspace</h3>
              <p className="text-slate-500 mt-1 text-lg">Organize suas entregas em pastas.</p>
            </div>
            <button onClick={() => setActiveTab('assign')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shadow-sm"><Send size={16} /> Criar tarefa para parceiro</button>
            <div className="relative w-full md:w-72">
              <span className="absolute left-3 top-2.5 text-slate-400"><Search size={18} /></span>
              <input type="text" placeholder="Buscar tarefa ou cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
            <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
              <div><p className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">No Prazo</p><p className="text-2xl font-extrabold text-slate-800">{pendingCount}</p></div>
              <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600"><Clock size={20} /></div>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
              <div><p className="text-red-500 font-bold text-[10px] uppercase tracking-wider">Atrasadas</p><p className="text-2xl font-extrabold text-red-600">{lateCount}</p></div>
              <div className="bg-red-50 p-2.5 rounded-xl text-red-600"><AlertCircle size={20} /></div>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
              <div><p className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Em Análise</p><p className="text-2xl font-extrabold text-slate-800">{reviewCount}</p></div>
              <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600"><Hourglass size={20} /></div>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex items-center justify-between">
              <div><p className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Concluídas</p><p className="text-2xl font-extrabold text-slate-800">{doneCount}</p></div>
              <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600"><Trophy size={20} /></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 flex-1">
              {folders.map(folder => {
                let icon = <Folder size={16} />
                let activeClass = 'bg-slate-800 text-white shadow-md'
                let inactiveClass = 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'

                if (folder === 'Entrada') icon = <Inbox size={16} />
                if (folder === 'Atrasado') {
                  icon = <AlertCircle size={16} />
                  activeClass = 'bg-red-600 text-white shadow-md'
                  inactiveClass = 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                }
                if (folder === 'Aguardando Conferência' || folder === 'Aguardando OK Final' || folder === 'Aguardando Aprovação') {
                  icon = <Hourglass size={16} />
                  activeClass = 'bg-amber-500 text-white shadow-md'
                  inactiveClass = 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                }
                if (folder === 'Concluídas') {
                  icon = <CheckCircle size={16} />
                  activeClass = 'bg-emerald-600 text-white shadow-md'
                  inactiveClass = 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }

                return (
                  <button key={folder} onClick={() => setActiveFolder(folder)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeFolder === folder ? activeClass : inactiveClass}`}>
                    {icon} {folder}
                  </button>
                )
              })}
            </div>
            <form onSubmit={handleCreateFolder} className="flex gap-2">
              <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nova pasta..." className="px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm w-36 focus:ring-2 focus:ring-slate-800 bg-slate-50" />
              <button type="submit" className="bg-slate-800 text-white p-2 rounded-lg transition-colors hover:bg-slate-700"><Plus size={18} /></button>
            </form>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center mt-6 flex flex-col items-center">
              <Inbox size={48} className="text-slate-200 mb-4" />
              <h4 className="text-xl font-bold text-slate-700">Tudo limpo por aqui</h4>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {filteredTasks.map(task => {
                const template = templates[task.template_id]
                if (!template) return null
                const isPending = task.status === 'A Fazer'
                const isDone = task.status === 'Aprovada'
                const isLateTask = checkIsLate(task.deadline, task.status)

                return (
                  <div key={task.id} className={`bg-white rounded-2xl shadow-sm border ${isLateTask ? 'border-red-300 ring-2 ring-red-50' : (isPending ? 'border-blue-200' : 'border-slate-200')} relative overflow-hidden transition-all flex flex-col`}>
                    <div className={`absolute top-0 left-0 w-full h-1 ${isDone ? 'bg-emerald-500' : (isLateTask ? 'bg-red-500' : (isPending ? 'bg-blue-500' : 'bg-amber-400'))}`}></div>

                    <div className="p-6 flex-1">
                      <div className="flex flex-wrap justify-between items-start mb-5 gap-2">
                        <div>
                          <h4 className="text-xl font-bold text-slate-800 leading-tight">{template.name}</h4>
                          
                          {/* NOVO: EXIBIÇÃO DO NOME DO CLIENTE */}
                          {task.client_id && clientsMap[task.client_id] && (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-pink-50 text-pink-700 px-2.5 py-1 rounded border border-pink-200 w-fit mt-1.5 shadow-sm">
                              <Briefcase size={10} /> Cliente: {clientsMap[task.client_id]}
                            </span>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[11px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${getPriorityColor(task.priority)}`}>{cleanPriority(task.priority)}</span>
                            {task.deadline && (
                              <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${isLateTask ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                <Calendar size={12} /> {task.deadline.split('-').reverse().join('/')}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-[11px] uppercase tracking-wider font-bold rounded-full ${isLateTask ? 'bg-red-50 text-red-700 border border-red-200' : (isPending ? 'bg-blue-50 text-blue-700 border border-blue-200' : (isDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'))}`}>
                          {isLateTask ? 'ATRASADO' : task.status}
                        </span>
                      </div>

                      {task.admin_notes && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-5 shadow-sm">
                          <p className="text-amber-800 font-bold text-xs flex items-center gap-1.5 uppercase tracking-wide">
                            <Info size={14} /> Observações da Gestão:
                          </p>
                          <p className="text-amber-700 text-sm mt-1.5 font-medium whitespace-pre-wrap">{task.admin_notes}</p>
                        </div>
                      )}

                      {task.admin_attachments && task.admin_attachments.length > 0 && (
                        <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl mb-6">
                          <h6 className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Paperclip size={12} /> Referências / Briefing</h6>
                          <div className="space-y-2">
                            {task.admin_attachments.map((att, idx) => (
                              <div key={idx}>
                                {isImage(att) ? (
                                  <div className="relative group">
                                    <img src={att} alt="Ref" className="w-full max-h-32 object-cover rounded-lg border border-indigo-200 shadow-sm" />
                                    <a href={att} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-bold text-slate-700 bg-white/90 backdrop-blur px-2 py-1.5 rounded-md hover:bg-white transition-colors shadow-sm"><Maximize2 size={12}/> Abrir</a>
                                  </div>
                                ) : (
                                  <a href={att.startsWith('http') ? att : `http://${att}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-indigo-200 hover:border-indigo-400 transition-colors text-indigo-700 text-sm font-medium shadow-sm">
                                    <LinkIcon size={14} className="text-indigo-400" /> <span className="truncate">{att}</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isPending && task.admin_feedback && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-5 shadow-sm">
                          <p className="text-red-800 font-bold text-xs flex items-center gap-1.5 uppercase tracking-wide"><AlertTriangle size={14} /> Devolvido para correção:</p>
                          <p className="text-red-700 text-sm mt-1.5 font-medium">{task.admin_feedback}</p>
                        </div>
                      )}

                      <form onSubmit={(e) => handleSubmitTask(task.id, e)} className="space-y-4 pt-2">
                        {Object.entries(template.schema_fields).map(([label, type]) => {
                          const value = taskAnswers[task.id]?.[label] || ''
                          return (
                            <div key={label} className="space-y-1.5">
                              <label className="block text-sm font-semibold text-slate-700">{label}</label>
                              {(type === 'text' || type === 'url') && <input type={type} value={value} onChange={(e) => handleFieldChange(task.id, label, e.target.value)} disabled={!isPending} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 text-sm" required />}
                              {type === 'textarea' && <textarea value={value} onChange={(e) => handleFieldChange(task.id, label, e.target.value)} disabled={!isPending} rows="2" className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 resize-none text-sm" required />}
                              {type === 'checkbox' && (
                                <label className="flex items-center gap-2 cursor-pointer w-fit">
                                  <input type="checkbox" checked={value === true} onChange={(e) => handleFieldChange(task.id, label, e.target.checked)} disabled={!isPending} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm font-medium text-slate-600">Confirmo esta etapa</span>
                                </label>
                              )}
                              {type === 'file' && (
                                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                                  {isPending && !value && (
                                    <div className="flex items-center gap-2">
                                      <Paperclip size={16} className="text-slate-400" />
                                      <input type="file" onChange={(e) => handleFileUpload(task.id, label, e.target.files[0])} className="text-sm text-slate-500 cursor-pointer" required />
                                    </div>
                                  )}
                                  {value === 'loading...' && <div className="text-sm text-amber-600 font-bold">Fazendo upload...</div>}
                                  {value && value.startsWith('http') && (
                                    <div className="space-y-3">
                                      {isImage(value) ? (
                                        <div className="relative group">
                                          <img src={value} alt="Anexo" className="w-full max-h-32 object-cover rounded-lg border border-slate-200 shadow-sm" />
                                        </div>
                                      ) : (
                                        <a href={value} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors text-blue-600 text-sm font-medium">
                                          <FileIcon size={16} /> {value.split('/').pop()}
                                        </a>
                                      )}
                                      {isPending && <button type="button" onClick={() => handleRemoveFile(task.id, label, value)} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50 px-2 py-1 rounded w-fit"><Trash2 size={12} /> Remover</button>}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {isPending && <button type="submit" className={`w-full mt-4 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${isLateTask ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900'}`}><Send size={16} /> Enviar para Conferência {isLateTask && '(Em Atraso)'}</button>}
                      </form>

                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <h6 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-1.5"><MessageSquare size={12} /> Histórico & Chat</h6>
                        <div className="space-y-2 max-h-32 overflow-y-auto mb-3 pr-1">
                          {task.comments?.length === 0 ? <p className="text-xs text-slate-400">Nenhuma mensagem.</p> : null}
                          {task.comments?.map((c, i) => (
                            <div key={i} className={`p-2.5 rounded-lg text-sm w-[85%] ${c.sender === user.name ? 'bg-blue-50 text-blue-900 ml-auto rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                              <span className="font-bold text-[10px] text-slate-400 block mb-0.5">{c.sender} • {c.time}</span>
                              {c.text}
                            </div>
                          ))}
                        </div>
                        {!isDone && (
                          <div className="flex gap-2">
                            <input type="text" placeholder="Escreva uma mensagem..." value={chatInputs[task.id] || ''} onChange={e => setChatInputs({...chatInputs, [task.id]: e.target.value})} className="flex-1 px-3 py-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg text-sm outline-none focus:border-blue-400" onKeyDown={(e) => e.key === 'Enter' && sendComment(task.id)} />
                            <button onClick={() => sendComment(task.id)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 rounded-lg transition-colors"><Send size={16} /></button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isPending && !isLateTask && (
                      <div className="bg-slate-50 border-t border-slate-100 p-3 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Folder size={12} /> Mover para</span>
                        <select value={task.folder || 'Entrada'} onChange={(e) => handleMoveTask(task.id, e.target.value)} className="text-xs font-bold bg-white border border-slate-200 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-slate-800 text-slate-600 cursor-pointer">
                          {folders.filter(f => !['Concluídas', 'Aguardando Aprovação', 'Aguardando Conferência', 'Aguardando OK Final', 'Atrasado'].includes(f)).map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    )}
                    {isPending && isLateTask && (
                      <div className="bg-red-50 border-t border-red-100 p-3 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1"><AlertCircle size={12} /> Movimentação Bloqueada</span>
                        <span className="text-xs font-bold text-red-700">Tarefa Atrasada</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}


          {finalApprovalTasks.length > 0 && (
            <div className="mt-12 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-emerald-100 text-emerald-700 p-3 rounded-xl shadow-sm">
                  <ClipboardCheck size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Aguardando seu OK final</h3>
                  <p className="text-slate-500 text-sm mt-0.5">Tarefas que você solicitou, foram executadas e já passaram pelo conferente.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {finalApprovalTasks.map(task => {
                  const template = templates[task.template_id]
                  const executor = usersMap[task.assigned_to]
                  const reviewer = usersMap[task.reviewer_id]
                  if (!template) return null

                  return (
                    <div key={task.id} className="bg-white border border-emerald-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="bg-emerald-50 p-5 border-b border-emerald-100">
                        <h4 className="text-xl font-bold text-slate-800 leading-tight">{template.name}</h4>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {executor && <span className="text-[10px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded">Executor: {executor.name}</span>}
                          {reviewer && <span className="text-[10px] font-bold uppercase tracking-wider bg-white border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded">Conferente: {reviewer.name}</span>}
                          {task.client_id && clientsMap[task.client_id] && <span className="text-[10px] font-bold uppercase tracking-wider bg-white border border-pink-200 text-pink-700 px-2.5 py-1 rounded">Cliente: {clientsMap[task.client_id]}</span>}
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        {Object.entries(task.dynamic_data || {}).map(([key, val]) => (
                          <div key={key} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{key}</span>
                            {typeof val === 'boolean' ? (
                              <span className={`text-xs font-bold px-2 py-1 rounded flex w-fit items-center gap-1 ${val ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>{val ? 'Confirmado' : 'Não Confirmado'}</span>
                            ) : (val?.startsWith?.('http') ? (
                              isImage(val) ? <img src={val} alt="Anexo" className="w-full max-h-40 object-cover rounded-lg border border-slate-200" /> : <a href={val} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-bold hover:underline">Abrir anexo</a>
                            ) : (
                              <span className="text-slate-800 text-sm font-medium whitespace-pre-wrap block">{val || 'Não preenchido'}</span>
                            ))}
                          </div>
                        ))}

                        <textarea
                          placeholder="Motivo da devolução, caso não aprove..."
                          value={finalFeedbacks[task.id] || ''}
                          onChange={e => setFinalFeedbacks({ ...finalFeedbacks, [task.id]: e.target.value })}
                          rows="2"
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none text-sm resize-none"
                        />

                        <div className="flex gap-3">
                          <button onClick={() => handleFinalApprove(task.id)} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all shadow-md flex justify-center items-center gap-2"><CheckCircle size={18} /> Dar OK Final</button>
                          <button onClick={() => handleFinalReject(task.id)} className="flex-1 bg-white hover:bg-red-50 text-red-600 font-bold py-3 rounded-xl transition-all border border-red-200 flex justify-center items-center gap-2"><XCircle size={18} /> Devolver</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {user.is_strategist && (
            <div className="mt-16 pt-8 border-t border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 text-purple-700 p-3 rounded-xl shadow-sm">
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Meus Clientes</h3>
                    <p className="text-slate-500 text-sm mt-0.5">Painel exclusivo para Estrategistas.</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('clients')} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors shadow-sm">
                  Acessar Carteira
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  // --- TELA DO ADMIN ---
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
      <div className="space-y-6">
        <div><h3 className="text-3xl font-bold tracking-tight text-slate-800">Painel de Controle</h3><p className="text-slate-500 mt-1 text-lg">Gerencie sua equipe e os fluxos de trabalho.</p></div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div onClick={() => setActiveTab('team')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center text-center"><div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Users size={24} strokeWidth={2.5} /></div><h4 className="text-base font-bold text-slate-800">Equipe</h4><p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1">Acessos</p></div>
          <div onClick={() => setActiveTab('templates')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center text-center"><div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><FileText size={24} strokeWidth={2.5} /></div><h4 className="text-base font-bold text-slate-800">Templates</h4><p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1">Formulários</p></div>
          <div onClick={() => setActiveTab('assign')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-orange-200 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center text-center"><div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Send size={24} strokeWidth={2.5} /></div><h4 className="text-base font-bold text-slate-800">Delegar</h4><p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1">Tarefas</p></div>
          <div onClick={() => setActiveTab('approvals')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center text-center"><div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><CheckCircle size={24} strokeWidth={2.5} /></div><h4 className="text-base font-bold text-slate-800">Aprovações</h4><p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1">Entregas</p></div>
          <div onClick={() => setActiveTab('monitoring')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center text-center"><div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><BarChart3 size={24} strokeWidth={2.5} /></div><h4 className="text-base font-bold text-slate-800">Monitorar</h4><p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1">Operação</p></div>
          <div onClick={() => setActiveTab('clients')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-pink-200 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center text-center"><div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Briefcase size={24} strokeWidth={2.5} /></div><h4 className="text-base font-bold text-slate-800">Clientes</h4><p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1">Contas & CRM</p></div>
        </div>
      </div>
    </motion.div>
  )
}