import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, ChevronRight, CircleDot,
  Download, Eye, FileSearch, Globe2, Loader2, LockKeyhole, LogOut, Plus, RefreshCw,
  Search, ShieldCheck, Sparkles, Target, Trash2, X, Zap
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { api } from '../../services/api'
import './styles.css'

const STAGE_LABELS = {
  identity: 'Confirmando identidade',
  presence: 'Desmontar a presença digital',
  trust: 'Questionar a confiança da marca',
  social_proof: 'Colocar a prova social sob suspeita',
  external_reputation: 'Ouvir o que falam fora dos canais controlados',
  activity: 'Expor inconsistências e abandono digital',
  authority: 'Confrontar autoridade declarada com a realidade',
  ai_recommendability: 'Questionar a capacidade de ser recomendada por IA',
  contradictions: 'Buscar contradições entre promessa e realidade',
  competitive_fragility: 'Procurar fragilidades competitivas',
  audit: 'Auditando evidências',
  closer: 'Montando dossiê comercial',
  completed: 'Investigação concluída',
}

const STAGES = ['identity','presence','trust','social_proof','external_reputation','activity','authority','ai_recommendability','contradictions','competitive_fragility','audit','closer']

function errMessage(error) {
  const message = error?.response?.data?.error || error?.response?.data?.detail
  return typeof message === 'string' ? message : 'Não foi possível concluir. Confira a conexão e tente novamente.'
}

async function pdfErrorMessage(error) {
  const data = error?.response?.data
  if (data && typeof data.text === 'function') {
    try {
      const parsed = JSON.parse(await data.text())
      const message = parsed?.error || parsed?.detail
      if (typeof message === 'string' && message) return message
    } catch { /* A failed response does not always contain JSON. */ }
  }
  return errMessage(error)
}

async function request(path, body) {
  try {
    const response = body === undefined ? await api.get(`/skybob${path}`) : await api.post(`/skybob${path}`, body)
    return response.data
  } catch (error) {
    throw new Error(errMessage(error))
  }
}

function dateLabel(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
}

function statusLabel(status) {
  return ({queued:'Na fila',running:'Investigando',failed:'Falhou',needs_review:'Confirmar identidade',completed:'Concluída',cancelled:'Cancelada'})[status] || status
}

function severityLabel(value) {
  return ({high:'Alta',medium:'Média',low:'Baixa'})[value] || value
}

function verdictLabel(value) {
  return ({confirmed:'Confirmado',indicator:'Indício',conflicting:'Conflitante',unverified:'Não verificado',discarded:'Descartado'})[value] || value
}

function auditLabel(value) {
  return ({approved:'Aprovada',rejected:'Rejeitada',needs_context:'Exige contexto',pending:'Aguardando auditoria'})[value] || value
}

export default function SkybobApp({user, onLogout, onBack}) {
  const [state, setState] = useState({configured:false, investigations:[], version:'1.0.0'})
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    try {
      const next = await request('/state')
      setState(next)
      if (selectedId) {
        const exists = next.investigations.some(item => item.id === selectedId)
        if (!exists) { setSelectedId(''); setDetail(null) }
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  const refreshDetail = useCallback(async (id = selectedId) => {
    if (!id) return
    setDetailLoading(true)
    try {
      setDetail(await request(`/investigations/${id}`))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setDetailLoading(false)
    }
  }, [selectedId])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); if (selectedId) void refreshDetail(selectedId) }, 3500)
    return () => window.clearInterval(timer)
  }, [refresh, refreshDetail, selectedId])
  useEffect(() => { if (selectedId) void refreshDetail(selectedId) }, [selectedId, refreshDetail])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return state.investigations
    return state.investigations.filter(item => `${item.companyName} ${item.city}`.toLowerCase().includes(q))
  }, [state.investigations, search])

  async function createInvestigation(form) {
    try {
      const created = await request('/investigations', form)
      toast.success('Investigação Skybob criada.')
      setNewOpen(false)
      await refresh()
      setSelectedId(created.id)
    } catch (error) {
      toast.error(error.message)
    }
  }

  async function action(id, actionName) {
    try {
      const result = await request(`/investigations/${id}/action`, {action: actionName})
      if (actionName === 'delete') {
        setSelectedId(''); setDetail(null); toast.success('Investigação removida.')
      } else {
        setDetail(result)
        toast.success(actionName === 'retry' ? 'Investigação retomada.' : 'Investigação atualizada.')
      }
      await refresh()
    } catch (error) { toast.error(error.message) }
  }

  async function downloadPdf(id, companyName) {
    try {
      const response = await api.get(`/skybob/investigations/${id}/pdf`, {responseType:'blob'})
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `dossie-skybob-${companyName.replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase() || 'empresa'}.pdf`
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { toast.error(await pdfErrorMessage(error)) }
  }

  return <div className="skybob-app">
    <header className="skybob-topbar">
      <div className="skybob-topbar-inner">
        <button className="skybob-brand" onClick={() => {setSelectedId(''); setDetail(null)}}>
          <span className="skybob-brand-mark"><Zap/></span>
          <span><strong>SKYBOB</strong><small>INVESTIGAÇÃO DIGITAL</small></span>
        </button>
        <div className="skybob-top-actions">
          <span className="skybob-user"><i/>{user.name}</span>
          {onBack && <button className="skybob-ghost" onClick={onBack}><ArrowLeft/>Mapa IA</button>}
          <button className="skybob-ghost" onClick={onLogout}><LogOut/>Sair</button>
        </div>
      </div>
    </header>

    <main className="skybob-main">
      {!selectedId ? <SkybobHome state={state} loading={loading} visible={visible} search={search} setSearch={setSearch} onNew={() => setNewOpen(true)} onSelect={setSelectedId}/> : <InvestigationView detail={detail} loading={detailLoading} onBack={() => {setSelectedId(''); setDetail(null)}} onRefresh={() => refreshDetail(selectedId)} onAction={action} onDownload={downloadPdf}/>} 
    </main>

    {newOpen && <NewInvestigation configured={state.configured} onClose={() => setNewOpen(false)} onCreate={createInvestigation}/>} 
    <Toaster position="bottom-right" richColors closeButton theme="light"/>
  </div>
}

function SkybobHome({state, loading, visible, search, setSearch, onNew, onSelect}) {
  const completed = state.investigations.filter(item => item.status === 'completed').length
  const active = state.investigations.filter(item => ['queued','running'].includes(item.status)).length
  return <>
    <section className="skybob-hero">
      <div className="skybob-hero-copy">
        <span className="skybob-eyebrow"><CircleDot/>AUDITORIA ADVERSARIAL</span>
        <h1>A aparência da empresa não recebe benefício da dúvida.</h1>
        <p>O Skybob investiga uma empresa por vez, cruza fontes públicas, tenta desmontar alegações frágeis e só deixa passar para o dossiê o que sobreviver à auditoria.</p>
        <div className="skybob-hero-actions"><button className="skybob-primary" onClick={onNew}><Plus/>Nova investigação</button><span className={state.configured ? 'skybob-config ok' : 'skybob-config warn'}><i/>{state.configured ? 'OpenAI conectada' : 'OpenAI não configurada'}</span></div>
      </div>
      <div className="skybob-hero-side">
        <div><strong>{state.investigations.length}</strong><span>investigações</span></div>
        <div><strong>{completed}</strong><span>dossiês concluídos</span></div>
        <div><strong>{active}</strong><span>em investigação</span></div>
      </div>
    </section>

    <section className="skybob-library">
      <div className="skybob-section-title"><div><h2>Investigações</h2><p>Cada empresa possui histórico, evidências e PDF independentes.</p></div><div className="skybob-search"><Search/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa ou cidade"/></div></div>
      {loading ? <div className="skybob-loading"><Loader2 className="spin"/>Carregando investigações...</div> : visible.length ? <div className="skybob-investigation-grid">{visible.map(item => <button key={item.id} className="skybob-investigation-card" onClick={() => onSelect(item.id)}>
        <div className="skybob-card-top"><span className={`skybob-status status-${item.status}`}><i/>{statusLabel(item.status)}</span><small>{dateLabel(item.createdAt)}</small></div>
        <h3>{item.companyName}</h3><p><Globe2/>{item.city}</p>
        <div className="skybob-progress"><i style={{width:`${item.progress}%`}}/></div>
        <div className="skybob-card-metrics"><span><b>{item.counts.sources}</b>fontes</span><span><b>{item.counts.evidence}</b>evidências</span><span><b>{item.counts.approved}</b>aprovadas</span></div>
        <div className="skybob-card-stage"><span>{item.currentStageLabel}</span><ChevronRight/></div>
      </button>)}</div> : <div className="skybob-empty"><FileSearch/><h3>Nenhuma investigação ainda</h3><p>Informe apenas nome, cidade, Perfil da Empresa no Google e site oficial.</p><button className="skybob-primary" onClick={onNew}><Plus/>Investigar primeira empresa</button></div>}
    </section>
  </>
}

function InvestigationView({detail, loading, onBack, onRefresh, onAction, onDownload}) {
  const [tab, setTab] = useState('evidence')
  if (!detail) return <div className="skybob-loading"><Loader2 className="spin"/>Abrindo investigação...</div>
  const approved = detail.evidence.filter(item => item.auditStatus === 'approved')
  const rejected = detail.evidence.filter(item => item.auditStatus === 'rejected' || item.verdict === 'discarded' || item.subjectMatch === 'wrong_entity')
  const report = detail.report || {}
  return <>
    <div className="skybob-detail-head">
      <button className="skybob-icon-btn" onClick={onBack}><ArrowLeft/></button>
      <div className="skybob-detail-title"><span className={`skybob-status status-${detail.status}`}><i/>{statusLabel(detail.status)}</span><h1>{detail.companyName}</h1><p>{detail.city} · criada em {dateLabel(detail.createdAt)}</p></div>
      <div className="skybob-detail-actions">
        {['failed','needs_review'].includes(detail.status) && <button className="skybob-secondary" onClick={() => onAction(detail.id,'retry')}><RefreshCw/>Repetir</button>}
        {detail.status === 'completed' && <button className="skybob-primary" onClick={() => onDownload(detail.id,detail.companyName)}><Download/>Baixar dossiê PDF</button>}
        <button className="skybob-icon-btn danger" title="Excluir investigação" onClick={() => { if (window.confirm('Excluir esta investigação e todas as evidências?')) onAction(detail.id,'delete') }}><Trash2/></button>
      </div>
    </div>

    {detail.status !== 'completed' && <ProgressPanel detail={detail} loading={loading}/>} 

    <section className="skybob-detail-kpis">
      <div><span><Globe2/></span><strong>{detail.counts.sources}</strong><small>fontes públicas</small></div>
      <div><span><FileSearch/></span><strong>{detail.counts.evidence}</strong><small>evidências encontradas</small></div>
      <div><span><ShieldCheck/></span><strong>{detail.counts.approved}</strong><small>aprovadas pelo auditor</small></div>
      <div><span><X/></span><strong>{detail.counts.discarded}</strong><small>descartadas / rejeitadas</small></div>
    </section>

    <nav className="skybob-tabs">
      <button className={tab==='evidence'?'active':''} onClick={() => setTab('evidence')}>Sala de evidências</button>
      <button className={tab==='audit'?'active':''} onClick={() => setTab('audit')}>Auditoria</button>
      <button className={tab==='dossier'?'active':''} onClick={() => setTab('dossier')} disabled={detail.status !== 'completed'}>Dossiê comercial</button>
    </nav>

    {tab === 'evidence' && <EvidenceRoom detail={detail}/>} 
    {tab === 'audit' && <AuditRoom detail={detail} approved={approved} rejected={rejected}/>} 
    {tab === 'dossier' && <DossierPreview detail={detail} report={report} onDownload={onDownload}/>} 
  </>
}

function ProgressPanel({detail}) {
  const currentIndex = STAGES.indexOf(detail.currentStage)
  return <section className="skybob-running">
    <div className="skybob-running-top"><div><span className="skybob-running-icon"><Loader2 className="spin"/></span><div><strong>SKYBOB está investigando</strong><p>{detail.currentStageLabel}</p></div></div><b>{detail.progress}%</b></div>
    <div className="skybob-running-progress"><i style={{width:`${detail.progress}%`}}/></div>
    <div className="skybob-stage-track">{STAGES.map((stage,index) => <div key={stage} className={index < currentIndex || detail.status === 'completed' ? 'done' : index === currentIndex ? 'current' : ''}><span>{index < currentIndex || detail.status === 'completed' ? <Check/> : index === currentIndex ? <CircleDot/> : index + 1}</span><small>{STAGE_LABELS[stage]}</small></div>)}</div>
    {detail.error && <div className="skybob-error"><AlertTriangle/><span>{detail.error}</span></div>}
  </section>
}

function EvidenceRoom({detail}) {
  const grouped = useMemo(() => {
    const result = {}
    for (const item of detail.evidence) (result[item.stage] ||= []).push(item)
    return result
  }, [detail.evidence])
  return <div className="skybob-evidence-room">
    <aside className="skybob-source-panel"><div className="skybob-panel-title"><Globe2/><div><strong>Fontes examinadas</strong><span>{detail.sources.length} referências preservadas</span></div></div><div className="skybob-source-list">{detail.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><span>{source.domain || 'fonte'}</span><strong>{source.title || source.url}</strong><small>{STAGE_LABELS[source.stage] || source.stage}</small></a>)}</div></aside>
    <div className="skybob-evidence-main">{Object.entries(grouped).map(([stage,items]) => <section key={stage} className="skybob-evidence-stage"><div className="skybob-stage-heading"><span>{STAGE_LABELS[stage] || stage}</span><b>{items.length}</b></div>{items.map(item => <EvidenceCard key={item.id} item={item}/>)}</section>)}{!detail.evidence.length && <div className="skybob-empty small"><FileSearch/><h3>Ainda coletando evidências</h3><p>Os achados aparecem aqui conforme as frentes de investigação terminam.</p></div>}</div>
  </div>
}

function EvidenceCard({item}) {
  const discarded = item.verdict === 'discarded' || item.subjectMatch === 'wrong_entity' || item.auditStatus === 'rejected'
  return <article className={`skybob-evidence-card ${discarded?'discarded':''}`}>
    <div className="skybob-evidence-top"><div><span className={`evidence-verdict v-${item.verdict}`}>{verdictLabel(item.verdict)}</span><span className={`evidence-severity s-${item.severity}`}>{severityLabel(item.severity)}</span>{item.independent && <span className="evidence-independent">Fonte independente</span>}</div><span className={`audit-mini a-${item.auditStatus}`}>{auditLabel(item.auditStatus)}</span></div>
    <h3>{item.title}</h3><p>{item.finding}</p>
    {item.quote && <blockquote>“{item.quote}”</blockquote>}
    <div className="skybob-evidence-foot"><span>{item.evidenceType.replaceAll('_',' ')}</span><span>{item.subjectMatch === 'wrong_entity' ? 'Homônimo descartado' : item.subjectMatch === 'confirmed' ? 'Empresa confirmada' : item.subjectMatch === 'probable' ? 'Correspondência provável' : 'Identidade incerta'}</span></div>
    {item.sourceUrls.length > 0 && <div className="skybob-evidence-sources">{item.sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer">{new URL(url).hostname.replace(/^www\./,'')}</a>)}</div>}
    {item.auditNote && <div className="skybob-audit-note"><ShieldCheck/>{item.auditNote}</div>}
  </article>
}

function AuditRoom({detail, approved, rejected}) {
  return <div className="skybob-audit-grid">
    <section className="skybob-audit-summary"><div className="skybob-panel-title"><ShieldCheck/><div><strong>Auditor adversarial</strong><span>O Closer só recebe material aprovado aqui.</span></div></div><p>{detail.auditSummary || 'A auditoria final será executada depois das nove frentes de pesquisa.'}</p><div className="skybob-audit-numbers"><div><strong>{approved.length}</strong><span>aprovadas</span></div><div><strong>{rejected.length}</strong><span>rejeitadas</span></div><div><strong>{detail.evidence.length-approved.length-rejected.length}</strong><span>com contexto / pendentes</span></div></div></section>
    <section className="skybob-audit-log"><h3>Trilha da investigação</h3>{detail.searches.map(row => <div key={row.stage}><span className={`audit-dot ${row.status}`}/><div><strong>{row.label}</strong><small>{row.model || 'modelo pendente'} · {row.sourceCount} fontes · {row.status}</small>{row.error && <em>{row.error}</em>}</div></div>)}</section>
  </div>
}

function DossierPreview({detail, report, onDownload}) {
  const locked = report.lockedPlan || detail.lockedPlan || {priorities:0,actions:0,fronts:0}
  return <div className="skybob-dossier-preview">
    <section className="skybob-dossier-cover"><span>SKYBOB</span><small>DOSSIÊ DE AUTORIDADE DIGITAL</small><h2>{detail.companyName}</h2><p>{report.cover_line || 'O que a internet realmente consegue provar sobre sua empresa.'}</p><button className="skybob-primary" onClick={() => onDownload(detail.id,detail.companyName)}><Download/>Gerar PDF comercial</button></section>
    <section className="skybob-dossier-findings"><div className="skybob-panel-title"><Target/><div><strong>Achados que entrarão no PDF</strong><span>Sem plano de ação e sem conteúdo não auditado.</span></div></div>{(report.findings||[]).map((finding,index) => <article key={`${finding.title}-${index}`}><small>{finding.category}</small><h3>{finding.title}</h3><p>{finding.body}</p></article>)}</section>
    <section className="skybob-locked-plan"><div className="skybob-lock-head"><LockKeyhole/><div><strong>Próximos passos identificados</strong><span>{locked.priorities || 0} prioridades · {locked.fronts || 0} frentes</span></div></div><div className="skybob-blur-lines">{Array.from({length:Math.max(4,Math.min(7,locked.priorities||4))}).map((_,i) => <div key={i}><i/><i/></div>)}</div><b>CONTEÚDO BLOQUEADO</b><p>A investigação mostra onde a credibilidade quebra. A correção é outra etapa.</p></section>
  </div>
}

function NewInvestigation({configured, onClose, onCreate}) {
  const [form,setForm] = useState({companyName:'',city:'',googleUrl:'',siteUrl:''})
  const [busy,setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); if (busy) return
    setBusy(true); try { await onCreate(form) } finally { setBusy(false) }
  }
  return <div className="skybob-modal-backdrop" onMouseDown={event => { if (event.target===event.currentTarget) onClose() }}><form className="skybob-modal" onSubmit={submit}>
    <button type="button" className="skybob-modal-close" onClick={onClose}><X/></button>
    <span className="skybob-eyebrow"><Zap/>NOVA INVESTIGAÇÃO</span><h2>Quem o Skybob vai colocar à prova?</h2><p>Somente quatro dados. O restante será descoberto autonomamente em fontes públicas.</p>
    {!configured && <div className="skybob-error"><AlertTriangle/><span>Não há chave OpenAI disponível para o Skybob. Configure SKYBOB_OPENAI_API_KEY/OPENAI_API_KEY ou a chave da mesma conta no Mapa IA.</span></div>}
    <label><span>Nome da empresa</span><input required value={form.companyName} onChange={e => setForm({...form,companyName:e.target.value})} placeholder="Ex.: Tapeçaria Sob Medida"/></label>
    <label><span>Cidade onde atua</span><input required value={form.city} onChange={e => setForm({...form,city:e.target.value})} placeholder="Ex.: Londrina, PR"/></label>
    <label><span>Perfil da Empresa no Google</span><input required type="url" value={form.googleUrl} onChange={e => setForm({...form,googleUrl:e.target.value})} placeholder="https://maps.google.com/..."/></label>
    <label><span>Site oficial</span><input required type="url" value={form.siteUrl} onChange={e => setForm({...form,siteUrl:e.target.value})} placeholder="https://empresa.com.br"/></label>
    <div className="skybob-modal-actions"><button type="button" className="skybob-secondary" onClick={onClose}>Cancelar</button><button className="skybob-primary" disabled={!configured || busy}>{busy?<Loader2 className="spin"/>:<FileSearch/>}Iniciar investigação</button></div>
  </form></div>
}
