import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import { Send, User, Users, Calendar, AlertTriangle, Paperclip, Link as LinkIcon, Trash2, Loader2, Info, Briefcase, ClipboardCheck } from 'lucide-react'

export default function AssignTask({ setActiveTab, user }) {
  const [employees, setEmployees] = useState([])
  const [reviewers, setReviewers] = useState([])
  const [templates, setTemplates] = useState([])
  const [teamRoles, setTeamRoles] = useState([])
  const [clients, setClients] = useState([])
  
  const [assignMode, setAssignMode] = useState('individual') 
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedReviewer, setSelectedReviewer] = useState('')
  const [priority, setPriority] = useState('Normal')
  const [deadline, setDeadline] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [msg, setMsg] = useState('')

  const [adminAttachments, setAdminAttachments] = useState([])
  const [linkInput, setLinkInput] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [usersRes, templatesRes, rolesRes, clientsRes] = await Promise.all([
        api.get('/users/'), 
        api.get('/templates/'), 
        api.get('/team-roles/'),
        api.get('/all-clients/')
      ])

      const partnerList = usersRes.data.filter(u => u.role === 'employee' && u.id !== user.id)
      const reviewerList = usersRes.data.filter(u => u.role === 'conferente')

      setEmployees(partnerList)
      setReviewers(reviewerList)
      setTemplates(templatesRes.data)
      setTeamRoles(rolesRes.data)
      setClients(clientsRes.data)

      if (reviewerList.length === 1) setSelectedReviewer(String(reviewerList[0].id))
    } catch (error) { console.error(error) }
  }

  const handleAdminUpload = async (file) => {
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post('/upload/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setAdminAttachments([...adminAttachments, res.data.url])
    } catch (err) {
      alert('Erro ao subir arquivo.')
    } finally {
      setUploading(false)
    }
  }

  const handleAddLink = () => {
    if (linkInput.trim()) {
      setAdminAttachments([...adminAttachments, linkInput.trim()])
      setLinkInput('')
    }
  }

  const handleRemoveAttachment = (indexToRemove) => {
    setAdminAttachments(adminAttachments.filter((_, index) => index !== indexToRemove))
  }

  const resetForm = () => {
    setSelectedEmployee('')
    setSelectedRole('')
    setDeadline('')
    setPriority('Normal')
    setAdminAttachments([])
    setAdminNotes('')
    setSelectedClient('')
    if (reviewers.length !== 1) setSelectedReviewer('')
  }

  const notifyAssignees = async (targets, tplName) => {
    targets.forEach(target => {
      api.post(`/users/${target.id}/notifications`, { text: `Nova tarefa recebida: ${tplName}` })
    })
  }

  const handleAssignTask = async (e) => {
    e.preventDefault()
    setMsg('')

    if (!selectedTemplate) return setMsg('Erro: escolha um template.')
    if (user.role !== 'admin' && !selectedReviewer) return setMsg('Erro: escolha um conferente para validar essa tarefa.')

    const taskData = { 
      template_id: parseInt(selectedTemplate), 
      dynamic_data: {}, 
      priority, 
      deadline,
      admin_attachments: adminAttachments,
      admin_notes: adminNotes,
      client_id: selectedClient ? parseInt(selectedClient) : null,
      created_by: user.id,
      reviewer_id: selectedReviewer ? parseInt(selectedReviewer) : null
    }
    const tplName = templates.find(t => t.id === parseInt(selectedTemplate))?.name || 'Tarefa'

    try {
      if (assignMode === 'individual') {
        if (!selectedEmployee) return setMsg('Erro: escolha o parceiro executor.')
        await api.post('/tasks/', { ...taskData, assigned_to: parseInt(selectedEmployee) })
        await notifyAssignees([{ id: parseInt(selectedEmployee) }], tplName)
        setMsg('Tarefa criada e enviada ao parceiro executor.')
      } else {
        if (!selectedRole) return setMsg('Erro: escolha a função/setor.')
        const response = await api.post('/tasks/bulk/', { ...taskData, target_team_role: selectedRole })
        const targets = employees.filter(emp => emp.team_role === selectedRole)
        await notifyAssignees(targets, tplName)
        setMsg(`${response.data.message}`)
      }
      
      resetForm()
      setTimeout(() => setMsg(''), 4000)
    } catch (err) { setMsg('Falha ao delegar a tarefa.') }
  }

  const isImage = (url) => typeof url === 'string' && url.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setActiveTab('dashboard')} className="px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">Voltar</button>
        <div>
          <h3 className="text-3xl font-bold tracking-tight text-slate-800">Criar e Delegar Tarefa</h3>
          <p className="text-slate-500 mt-1">Fluxo: solicitante cria, parceiro executa, conferente valida e solicitante dá o OK final.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <form id="assign-form" onSubmit={handleAssignTask} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Qual é a tarefa?</label>
              <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-800 bg-slate-50 text-slate-800 cursor-pointer">
                <option value="" disabled>Selecione um template...</option>
                {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2"><Briefcase size={16} className="text-pink-600"/> Cliente (Opcional)</label>
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-800 bg-slate-50 text-slate-800 cursor-pointer">
                <option value="">Nenhum cliente específico (Rotina Interna)</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2"><AlertTriangle size={16} className="text-amber-500" /> Prioridade</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-800 bg-slate-50 cursor-pointer text-sm font-semibold">
                  <option value="Urgente">Urgente</option>
                  <option value="Alta">Alta</option>
                  <option value="Normal">Normal</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2"><Calendar size={16} className="text-blue-500"/> Prazo / Deadline</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-800 bg-slate-50 text-slate-700 text-sm cursor-pointer" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2"><Info size={16} className="text-indigo-500"/> Briefing / Observações</label>
              <textarea 
                value={adminNotes} 
                onChange={e => setAdminNotes(e.target.value)} 
                placeholder="Ex: objetivo da entrega, contexto, critérios de qualidade, links importantes..."
                rows="3"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-800 bg-slate-50 text-slate-700 text-sm resize-none" 
              />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-700 mb-3">Quem vai executar?</label>
              <div className="flex bg-slate-100 p-1.5 rounded-xl mb-4 gap-1">
                <button type="button" onClick={() => setAssignMode('individual')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${assignMode === 'individual' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  <User size={16} /> Uma Pessoa
                </button>
                <button type="button" onClick={() => setAssignMode('bulk')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${assignMode === 'bulk' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Users size={16} /> Setor Inteiro
                </button>
              </div>

              {assignMode === 'individual' ? (
                <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-800 bg-slate-50 cursor-pointer text-sm">
                  <option value="" disabled>Selecione o Parceiro...</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} {emp.team_role ? `(${emp.team_role})` : ''}</option>)}
                </select>
              ) : (
                <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-800 bg-slate-50 cursor-pointer text-sm font-semibold">
                  <option value="" disabled>Selecione a função/setor...</option>
                  {teamRoles.map(role => <option key={role.id} value={role.name}>Todos os {role.name}s</option>)}
                </select>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2"><ClipboardCheck size={16} className="text-emerald-600"/> Quem vai conferir?</label>
              <select value={selectedReviewer} onChange={e => setSelectedReviewer(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 cursor-pointer text-sm font-semibold">
                <option value="">{user.role === 'admin' ? 'Sem conferente: vai para aprovação da gestão' : 'Selecione o Conferente...'}</option>
                {reviewers.map(reviewer => <option key={reviewer.id} value={reviewer.id}>{reviewer.name}</option>)}
              </select>
              {reviewers.length === 0 && <p className="mt-2 text-xs font-semibold text-red-600">Nenhum usuário com nível Conferente cadastrado ainda.</p>}
            </div>

            <button form="assign-form" type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2">
              <Send size={18} /> Enviar Tarefa
            </button>
            {msg && <div className={`p-4 rounded-xl text-sm font-bold text-center border ${msg.includes('Erro') || msg.includes('Falha') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{msg}</div>}
          </form>
        </div>

        <div className="bg-slate-50 p-8 rounded-2xl shadow-inner border border-slate-200 h-fit">
          <div className="mb-6">
            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Paperclip size={18} className="text-blue-600"/> Briefing e Referências</h4>
            <p className="text-slate-500 text-xs mt-1 font-medium">Envie links, vídeos ou imagens para guiar a execução.</p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon size={14} className="absolute left-3 top-3 text-slate-400" />
                <input type="text" placeholder="Cole um link do Drive, Trello..." value={linkInput} onChange={e => setLinkInput(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg outline-none text-sm focus:border-slate-500" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())} />
              </div>
              <button type="button" onClick={handleAddLink} className="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-4 rounded-lg text-sm transition-colors">Add</button>
            </div>

            <div className="text-center text-xs font-bold text-slate-400 uppercase">OU</div>

            <div className="bg-white border border-dashed border-slate-300 p-4 rounded-xl flex items-center justify-center">
              {uploading ? (
                <span className="flex items-center gap-2 text-sm font-bold text-blue-600"><Loader2 size={16} className="animate-spin"/> Enviando...</span>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 hover:opacity-70 transition-opacity">
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-full"><Paperclip size={18} /></div>
                  <span className="text-sm font-bold text-slate-600">Fazer upload do computador</span>
                  <input type="file" className="hidden" onChange={(e) => handleAdminUpload(e.target.files[0])} />
                </label>
              )}
            </div>

            {adminAttachments.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200 space-y-3">
                <h5 className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Materiais Anexados ({adminAttachments.length})</h5>
                {adminAttachments.map((att, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {isImage(att) ? <div className="w-8 h-8 bg-slate-100 rounded overflow-hidden flex-shrink-0"><img src={att} alt="Ref" className="w-full h-full object-cover" /></div> : <LinkIcon size={16} className="text-blue-500 flex-shrink-0" />}
                      <span className="text-xs text-slate-700 truncate max-w-[200px]">{att.startsWith('http') && !isImage(att) ? att.split('/').pop() || att : att}</span>
                    </div>
                    <button type="button" onClick={() => handleRemoveAttachment(idx)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
