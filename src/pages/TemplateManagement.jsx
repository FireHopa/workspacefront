import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import { ArrowLeft, Wrench, Pencil, Plus, X, FileBox, CheckCircle2, AlertCircle, Copy, Repeat, CalendarCheck } from 'lucide-react'

export default function TemplateManagement({ setActiveTab }) {
  const [templates, setTemplates] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [isRecurrent, setIsRecurrent] = useState(false) // NOVO ESTADO
  const [fields, setFields] = useState([{ id: Date.now(), label: '', type: 'text' }])
  const [msg, setMsg] = useState('')
  const [editingId, setEditingId] = useState(null)

  useEffect(() => { fetchTemplates() }, [])

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/templates/')
      setTemplates(response.data)
    } catch (error) { console.error("Erro ao buscar templates", error) }
  }

  const addField = () => setFields([...fields, { id: Date.now(), label: '', type: 'text' }])
  const removeField = (idToRemove) => setFields(fields.filter(field => field.id !== idToRemove))
  const handleFieldChange = (id, key, value) => setFields(fields.map(field => field.id === id ? { ...field, [key]: value } : field))

  const handleEditTemplate = (template) => {
    setEditingId(template.id)
    setTemplateName(template.name)
    setIsRecurrent(template.is_recurrent || false) // CARREGA O ESTADO DO BANCO
    
    const loadedFields = Object.entries(template.schema_fields).map(([label, type], index) => ({
      id: Date.now() + index, label, type
    }))
    
    setFields(loadedFields.length > 0 ? loadedFields : [{ id: Date.now(), label: '', type: 'text' }])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDuplicateTemplate = async (template) => {
    try {
      setMsg('')
      const newName = `${template.name} (Cópia)`
      
      await api.post('/templates/', { 
        name: newName, 
        schema_fields: template.schema_fields,
        is_recurrent: template.is_recurrent // COPIA TAMBÉM A RECORRÊNCIA
      })
      
      setMsg('Template duplicado com sucesso!')
      fetchTemplates()
      setTimeout(() => setMsg(''), 3000)
    } catch (err) { 
      setMsg('Erro ao duplicar template.') 
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setTemplateName('')
    setIsRecurrent(false) // RESETA
    setFields([{ id: Date.now(), label: '', type: 'text' }])
    setMsg('')
  }

  const handleSaveTemplate = async (e) => {
    e.preventDefault()
    setMsg('')

    if (!templateName.trim()) return setMsg('Erro: O template precisa de um nome.')
    const validFields = fields.filter(f => f.label.trim() !== '')
    if (validFields.length === 0) return setMsg('Erro: Adicione pelo menos um campo com nome.')

    const schema_fields = {}
    validFields.forEach(field => { schema_fields[field.label] = field.type })

    const payload = { 
      name: templateName, 
      schema_fields,
      is_recurrent: isRecurrent // ENVIA O NOVO CAMPO
    }

    try {
      if (editingId) {
        await api.put(`/templates/${editingId}`, payload)
        setMsg('Template atualizado com sucesso!')
      } else {
        await api.post('/templates/', payload)
        setMsg('Template criado com sucesso!')
      }
      
      cancelEdit() 
      fetchTemplates() 
      setTimeout(() => setMsg(''), 3000)
    } catch (err) { setMsg('Erro ao salvar template.') }
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
          <ArrowLeft size={16} /> Voltar
        </button>
        <h3 className="text-3xl font-bold tracking-tight text-slate-800">Modelos de Tarefas</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* FORMULÁRIO (CRIAR / EDITAR) */}
        <div className={`bg-white p-8 rounded-2xl shadow-sm border transition-colors ${editingId ? 'border-amber-300 ring-4 ring-amber-50' : 'border-slate-100'}`}>
          <div className="flex justify-between items-center mb-6">
            <h4 className={`text-xl font-bold flex items-center gap-2 ${editingId ? 'text-amber-600' : 'text-slate-800'}`}>
              {editingId ? <Pencil size={20} /> : <Wrench size={20} className="text-purple-600"/>} 
              {editingId ? 'Editando Modelo' : 'Criar Novo Modelo'}
            </h4>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-[10px] uppercase tracking-wider font-bold text-slate-500 hover:text-red-600 bg-slate-100 px-3 py-1.5 rounded border border-slate-200 transition-colors">
                Cancelar Edição
              </button>
            )}
          </div>
          
          <form onSubmit={handleSaveTemplate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Nome da Rotina</label>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none bg-slate-50 text-sm font-medium" placeholder="Ex: Criação de Campanha, Relatório Semanal..." required />
              </div>
              
              {/* NOVA SEÇÃO: ESCOLHA DE TIPO DE TEMPLATE */}
              <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-3">Tipo de Template</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors shadow-sm flex-1">
                    <input type="radio" name="tipoRotina" checked={!isRecurrent} onChange={() => setIsRecurrent(false)} className="accent-slate-800 w-4 h-4" />
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><CalendarCheck size={16} className="text-blue-500"/> Projeto Único</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors shadow-sm flex-1">
                    <input type="radio" name="tipoRotina" checked={isRecurrent} onChange={() => setIsRecurrent(true)} className="accent-slate-800 w-4 h-4" />
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Repeat size={16} className="text-emerald-500"/> Recorrente</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-100">
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-2">Campos Dinâmicos (Formulário)</label>
              
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex-1 space-y-2">
                    <input type="text" value={field.label} onChange={e => handleFieldChange(field.id, 'label', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-slate-400" placeholder={`Nome da exigência ${index + 1}`} required />
                    <select value={field.type} onChange={e => handleFieldChange(field.id, 'type', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm bg-white font-medium text-slate-700">
                      <option value="text">Texto Curto</option>
                      <option value="textarea">Texto Longo (Parágrafo)</option>
                      <option value="url">Link / URL do Drive</option>
                      <option value="checkbox">Caixa de Seleção de Confirmação</option>
                      <option value="file">Anexo (Imagem ou Documento)</option> 
                    </select>
                  </div>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => removeField(field.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-1">
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}

              <button type="button" onClick={addField} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> Adicionar Nova Exigência
              </button>
            </div>

            <button type="submit" className={`w-full text-white font-bold py-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-slate-800 hover:bg-slate-900'}`}>
              {editingId ? <><Pencil size={18}/> Salvar Alterações</> : <><FileBox size={18}/> Salvar Novo Template</>}
            </button>
            
            {msg && (
              <div className={`p-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border ${msg.includes('Erro') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                {msg.includes('Erro') ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>} {msg}
              </div>
            )}
          </form>
        </div>

        {/* LISTA DE TEMPLATES */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h4 className="text-xl font-bold text-slate-800">Modelos Ativos ({templates.length})</h4>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Biblioteca da Agência</p>
          </div>
          <div className="p-6 space-y-4">
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <FileBox size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-500 font-medium text-sm">Nenhum formulário criado ainda.</p>
              </div>
            ) : (
              templates.map(template => (
                <div key={template.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors flex flex-col bg-slate-50/30">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-bold text-lg text-slate-800">{template.name}</h5>
                      {/* BADGE DE IDENTIFICAÇÃO (ÚNICO VS RECORRENTE) */}
                      {template.is_recurrent ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full mt-1">
                          <Repeat size={10} /> Recorrente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1">
                          <CalendarCheck size={10} /> Único
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDuplicateTemplate(template)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors border border-slate-200 shadow-sm">
                        <Copy size={12} /> Duplicar
                      </button>
                      <button onClick={() => handleEditTemplate(template)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors border border-slate-200 shadow-sm">
                        <Pencil size={12} /> Editar
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Object.entries(template.schema_fields).map(([label, type]) => (
                      <span key={label} className="bg-white text-slate-600 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-slate-200">
                        {label} <span className="text-slate-400 font-normal lowercase">({type})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}