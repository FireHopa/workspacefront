import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  return ({queued:'Na fila',running:'Investigando',failed:'Falhou',needs_review:'Confirmar identidade',completed:'Concluída',cancelled:'Pausada'})[status] || status
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
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfPreview, setPdfPreview] = useState(null)
  const [connectionError, setConnectionError] = useState('')
  const selectedRef = useRef(selectedId)
  const mountedRef = useRef(false)
  const refreshingRef = useRef(false)
  const pollingRef = useRef(false)
  const mutatingRef = useRef(false)
  const detailRequestRef = useRef(0)

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    const selectedAtStart = selectedRef.current
    try {
      const next = await request('/state')
      if (!mountedRef.current) return
      setState(next)
      setConnectionError('')
      if (selectedAtStart && selectedRef.current === selectedAtStart) {
        const exists = next.investigations.some(item => item.id === selectedAtStart)
        if (!exists) { selectedRef.current = ''; setSelectedId(''); setDetail(null) }
      }
    } catch (error) {
      if (mountedRef.current) setConnectionError(error.message)
    } finally {
      refreshingRef.current = false
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  const refreshDetail = useCallback(async (id = selectedRef.current, silent = false) => {
    if (!id) return
    const sequence = ++detailRequestRef.current
    if (!silent) setDetailLoading(true)
    try {
      const next = await request(`/investigations/${id}`)
      if (mountedRef.current && selectedRef.current === id && sequence === detailRequestRef.current) setDetail(next)
    } catch (error) {
      if (!silent && mountedRef.current && selectedRef.current === id) toast.error(error.message)
    } finally {
      if (mountedRef.current && sequence === detailRequestRef.current) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void refresh()
    return () => { mountedRef.current = false }
  }, [refresh])
  const hasActive = state.investigations.some(item => ['queued','running'].includes(item.status))
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.hidden || pollingRef.current || mutatingRef.current) return
      pollingRef.current = true
      try {
        await refresh()
        if (selectedRef.current && !mutatingRef.current) await refreshDetail(selectedRef.current, true)
      } finally { pollingRef.current = false }
    }, hasActive ? 4000 : 20000)
    return () => window.clearInterval(timer)
  }, [refresh, refreshDetail, hasActive])
  useEffect(() => {
    if (selectedId) void refreshDetail(selectedId)
  }, [refresh, refreshDetail, selectedId])
  useEffect(() => {
    const url = pdfPreview?.url
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [pdfPreview])

  function selectInvestigation(id) {
    selectedRef.current = id
    setSelectedId(id)
    setDetail(null)
  }

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
      selectedRef.current = created.id
      setSelectedId(created.id)
      setDetail(created)
    } catch (error) {
      toast.error(error.message)
    }
  }

  async function action(id, actionName, company) {
    if (mutatingRef.current) return
    mutatingRef.current = true
    setActionBusy(true)
    ++detailRequestRef.current
    try {
      const result = await request(`/investigations/${id}/action`, {action: actionName, ...(company ? {company} : {}), ...(actionName === 'confirm_identity' ? {confirmed:true} : {})})
      if (actionName === 'delete') {
        selectedRef.current = ''; setSelectedId(''); setDetail(null); toast.success('Investigação removida.')
      } else {
        selectedRef.current = result.id
        setSelectedId(result.id)
        setDetail(result)
        setEditing(null)
        setConfirming(null)
        toast.success(actionName === 'confirm_identity' ? 'Empresa confirmada. A investigação continuará na pesquisa.' : actionName === 'retry' ? 'Investigação retomada do ponto salvo.' : actionName === 'reinvestigate' ? 'Nova investigação criada. O dossiê anterior foi preservado.' : 'Investigação atualizada.')
      }
      await refresh()
    } catch (error) { toast.error(error.message) } finally { mutatingRef.current = false; setActionBusy(false) }
  }

  async function downloadPdf(id, companyName, preview = false) {
    if (pdfBusy) return
    setPdfBusy(true)
    try {
      const response = await api.get(`/skybob/investigations/${id}/pdf`, {responseType:'blob', timeout:90000})
      const url = URL.createObjectURL(response.data)
      if (preview) { setPdfPreview({url, companyName}); return }
      const link = document.createElement('a')
      link.href = url
      link.download = `dossie-skybob-${companyName.replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase() || 'empresa'}.pdf`
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10000)
      toast.success('Dossiê PDF preparado para download.')
    } catch (error) { toast.error(await pdfErrorMessage(error)) } finally { setPdfBusy(false) }
  }

  return <div className="skybob-app">
    <header className="skybob-topbar">
      <div className="skybob-topbar-inner">
        <button className="skybob-brand" onClick={() => selectInvestigation('')}>
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
      {connectionError && <div className="skybob-error" role="status"><AlertTriangle/><span>{connectionError} Os dados já carregados permanecem na tela.</span><button className="skybob-secondary" onClick={refresh}>Atualizar</button></div>}
      {!selectedId ? <SkybobHome state={state} loading={loading} visible={visible} search={search} setSearch={setSearch} onNew={() => setNewOpen(true)} onSelect={selectInvestigation}/> : <InvestigationView key={selectedId} detail={detail} loading={detailLoading} actionBusy={actionBusy} pdfBusy={pdfBusy} onBack={() => selectInvestigation('')} onRefresh={() => refreshDetail(selectedId)} onAction={action} onEdit={() => setEditing(detail)} onConfirm={() => setConfirming(detail)} onDownload={downloadPdf}/>} 
    </main>

    {newOpen && <NewInvestigation configured={state.configured} onClose={() => setNewOpen(false)} onCreate={createInvestigation}/>} 
    {editing && <NewInvestigation configured={state.configured} initial={editing} onClose={() => setEditing(null)} onCreate={form => action(editing.id, 'retry', form)}/>}
    {confirming && <IdentityConfirmation detail={confirming} busy={actionBusy} onClose={() => setConfirming(null)} onConfirm={company => action(confirming.id, 'confirm_identity', company)}/>}
    {pdfPreview && <div className="skybob-modal-backdrop"><section className="skybob-pdf-modal" role="dialog" aria-modal="true" aria-label={`Dossiê de ${pdfPreview.companyName}`}><div className="skybob-pdf-toolbar"><strong>{pdfPreview.companyName}</strong><a className="skybob-secondary" href={pdfPreview.url} download="dossie-skybob.pdf"><Download/>Baixar PDF</a><button className="skybob-icon-btn" onClick={() => setPdfPreview(null)} aria-label="Fechar PDF"><X/></button></div><iframe title={`Dossiê PDF de ${pdfPreview.companyName}`} src={pdfPreview.url}/></section></div>}
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
      </button>)}</div> : <div className="skybob-empty"><FileSearch/><h3>{search ? 'Nenhuma empresa encontrada' : 'Nenhuma investigação ainda'}</h3><p>{search ? 'Tente outro nome ou cidade.' : 'Informe apenas nome, cidade, Perfil da Empresa no Google e site oficial.'}</p>{!search && <button className="skybob-primary" onClick={onNew}><Plus/>Investigar primeira empresa</button>}</div>}
    </section>
  </>
}

function InvestigationView({detail, loading, actionBusy, pdfBusy, onBack, onRefresh, onAction, onEdit, onConfirm, onDownload}) {
  const [tab, setTab] = useState('evidence')
  if (!detail) return <div className="skybob-loading">{loading ? <><Loader2 className="spin"/>Abrindo investigação...</> : <><button className="skybob-secondary" onClick={onBack}><ArrowLeft/>Voltar</button><button className="skybob-secondary" onClick={onRefresh}><RefreshCw/>Tentar carregar novamente</button></>}</div>
  const approved = detail.evidence.filter(item => item.auditStatus === 'approved')
  const rejected = detail.evidence.filter(item => item.auditStatus === 'rejected' || item.verdict === 'discarded' || item.subjectMatch === 'wrong_entity')
  const report = detail.report || {}
  return <>
    <div className="skybob-detail-head">
      <button className="skybob-icon-btn" onClick={onBack} aria-label="Voltar às investigações"><ArrowLeft/></button>
      <div className="skybob-detail-title"><span className={`skybob-status status-${detail.status}`}><i/>{statusLabel(detail.status)}</span><h1>{detail.companyName}</h1><p>{detail.city} · criada em {dateLabel(detail.createdAt)}</p></div>
      <div className="skybob-detail-actions">
        {['failed','needs_review','cancelled'].includes(detail.status) && <button className="skybob-secondary" disabled={actionBusy} onClick={() => onAction(detail.id,'retry')}><RefreshCw/>Retomar</button>}
        {['failed','needs_review','cancelled'].includes(detail.status) && detail.currentStage === 'identity' && <button className="skybob-secondary" disabled={actionBusy} onClick={onEdit}><Building2/>Corrigir dados</button>}
        {['queued','running'].includes(detail.status) && <button className="skybob-secondary" disabled={actionBusy} onClick={() => onAction(detail.id,'cancel')}>Pausar</button>}
        {detail.status === 'completed' && <><button className="skybob-secondary" disabled={actionBusy} onClick={() => onAction(detail.id,'reinvestigate')}><RefreshCw/>Nova análise</button><button className="skybob-secondary" disabled={pdfBusy} onClick={() => onDownload(detail.id,detail.companyName,true)}><Eye/>Visualizar PDF</button><button className="skybob-primary" disabled={pdfBusy} onClick={() => onDownload(detail.id,detail.companyName)}>{pdfBusy ? <Loader2 className="spin"/> : <Download/>}{pdfBusy ? 'Preparando PDF...' : 'Baixar dossiê PDF'}</button></>}
        <button className="skybob-icon-btn" disabled={loading} title="Atualizar investigação" onClick={onRefresh}><RefreshCw className={loading ? 'spin' : ''}/></button>
        <button className="skybob-icon-btn danger" disabled={actionBusy} title="Excluir investigação" onClick={() => { if (window.confirm('Excluir esta investigação e todas as evidências?')) onAction(detail.id,'delete') }}><Trash2/></button>
      </div>
    </div>

    {detail.status !== 'completed' && <ProgressPanel detail={detail} actionBusy={actionBusy} onConfirm={onConfirm}/>} 
    {detail.status === 'completed' && <div className="skybob-completed" role="status"><Check/><span>Investigação concluída em {dateLabel(detail.completedAt)}. O dossiê está pronto para visualizar ou baixar.</span></div>}
    {detail.identity?.confirmationMethod === 'manual' && <div className="skybob-completed" role="status"><ShieldCheck/><span>Identidade confirmada manualmente em {dateLabel(detail.identity.confirmedAt)}. As evidências continuam sendo verificadas individualmente.</span></div>}
    <SiteCollection collection={detail.siteCollection}/>

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
    {tab === 'dossier' && <DossierPreview detail={detail} report={report} onDownload={onDownload} pdfBusy={pdfBusy}/>} 
  </>
}

function ProgressPanel({detail, actionBusy, onConfirm}) {
  const currentIndex = STAGES.indexOf(detail.currentStage)
  const active = ['queued','running'].includes(detail.status)
  const title = detail.status === 'failed' ? 'A investigação precisa de uma nova tentativa' : detail.status === 'needs_review' ? 'Confira a identidade da empresa' : detail.status === 'cancelled' ? 'Investigação pausada' : 'SKYBOB está investigando'
  const completed = detail.searches.filter(item => item.status === 'completed').length
  return <section className="skybob-running">
    <div className="skybob-running-top"><div><span className="skybob-running-icon">{active ? <Loader2 className="spin"/> : <AlertTriangle/>}</span><div><strong>{title}</strong><p>{detail.currentStageLabel} · {completed} consultas concluídas</p></div></div><b>{detail.progress}%</b></div>
    <div className="skybob-running-progress"><i style={{width:`${detail.progress}%`}}/></div>
    <div className="skybob-stage-track">{STAGES.map((stage,index) => <div key={stage} className={index < currentIndex || detail.status === 'completed' ? 'done' : index === currentIndex ? 'current' : ''}><span>{index < currentIndex || detail.status === 'completed' ? <Check/> : index === currentIndex ? <CircleDot/> : index + 1}</span><small>{STAGE_LABELS[stage]}</small></div>)}</div>
    {detail.error && <div className="skybob-error"><AlertTriangle/><span>{detail.error}</span></div>}
    {detail.status === 'needs_review' && detail.identity?.reason && <p className="skybob-identity-reason">{detail.identity.reason}</p>}
    {detail.status === 'needs_review' && detail.currentStage === 'identity' && <div className="skybob-identity-action"><p>Se os dados e links são da empresa certa, confirme para continuar a investigação.</p><button className="skybob-primary" disabled={actionBusy} onClick={onConfirm}><ShieldCheck/>Confirmar empresa e continuar</button></div>}
  </section>
}

function SiteCollection({collection}) {
  if (!collection) return null
  const readable = collection.status === 'readable'
  return <section className={`skybob-site-collection ${readable ? 'readable' : ''}`}>
    <Globe2/><div><strong>{readable ? 'Site consultado diretamente' : collection.status === 'pending' ? 'A consulta direta ao site será feita no início da investigação' : collection.status === 'not_collected' ? 'Dossiê anterior à coleta direta' : 'Consulta direta ao site limitada'}</strong><p>{collection.message || 'O conteúdo será usado junto às demais fontes públicas.'}</p>{collection.pages?.length > 0 && <div>{collection.pages.map(page => <a key={page.url} href={page.url} target="_blank" rel="noreferrer">{page.title || page.url}</a>)}</div>}</div>
  </section>
}

function EvidenceRoom({detail}) {
  const grouped = useMemo(() => {
    const result = {}
    for (const item of detail.evidence) (result[item.stage] ||= []).push(item)
    return result
  }, [detail.evidence])
  return <div className="skybob-evidence-room">
    <aside className="skybob-source-panel"><div className="skybob-panel-title"><Globe2/><div><strong>Fontes examinadas</strong><span>{detail.sources.length} referências únicas</span></div></div><div className="skybob-source-list">{detail.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><span>{source.domain || 'fonte'}</span><strong>{source.title || source.url}</strong><small>{source.stage === 'website' ? 'Site consultado diretamente' : STAGE_LABELS[source.stage] || source.stage}{source.stages?.length > 1 ? ` · ${source.stages.length} frentes` : ''}</small></a>)}</div></aside>
    <div className="skybob-evidence-main">{Object.entries(grouped).map(([stage,items]) => <section key={stage} className="skybob-evidence-stage"><div className="skybob-stage-heading"><span>{STAGE_LABELS[stage] || stage}</span><b>{items.length}</b></div>{items.map(item => <EvidenceCard key={item.id} item={item}/>)}</section>)}{!detail.evidence.length && <div className="skybob-empty small"><FileSearch/><h3>{detail.status === 'completed' ? 'Nenhuma evidência confirmada' : 'Nenhuma evidência disponível nesta etapa'}</h3><p>Os achados aparecem conforme as frentes de investigação terminam.</p></div>}</div>
  </div>
}

function EvidenceCard({item}) {
  const discarded = item.verdict === 'discarded' || item.subjectMatch === 'wrong_entity' || item.auditStatus === 'rejected'
  return <article className={`skybob-evidence-card ${discarded?'discarded':''}`}>
    <div className="skybob-evidence-top"><div><span className={`evidence-verdict v-${item.verdict}`}>{verdictLabel(item.verdict)}</span><span className={`evidence-severity s-${item.severity}`}>{severityLabel(item.severity)}</span>{item.independent && <span className="evidence-independent">Fonte independente</span>}</div><span className={`audit-mini a-${item.auditStatus}`}>{auditLabel(item.auditStatus)}</span></div>
    <h3>{item.title}</h3><p>{item.finding}</p>
    {item.quote && <blockquote>“{item.quote}”</blockquote>}
    <div className="skybob-evidence-foot"><span>{({fact:'Fato',customer_report:'Relato de cliente',company_claim:'Declaração da empresa',pattern:'Padrão',absence:'Ausência verificada',contradiction:'Contradição',context:'Contexto',access_limitation:'Limitação da coleta'})[item.evidenceType] || item.evidenceType}</span><span>{item.subjectMatch === 'wrong_entity' ? 'Homônimo descartado' : item.subjectMatch === 'confirmed' ? 'Empresa confirmada' : item.subjectMatch === 'probable' ? 'Correspondência provável' : 'Identidade incerta'}</span></div>
    {item.sourceUrls.length > 0 && <div className="skybob-evidence-sources">{item.sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer">{new URL(url).hostname.replace(/^www\./,'')}</a>)}</div>}
    {item.auditNote && <div className="skybob-audit-note"><ShieldCheck/>{item.auditNote}</div>}
  </article>
}

function AuditRoom({detail, approved, rejected}) {
  return <div className="skybob-audit-grid">
    <section className="skybob-audit-summary"><div className="skybob-panel-title"><ShieldCheck/><div><strong>Auditor adversarial</strong><span>O Closer só recebe material aprovado aqui.</span></div></div><p>{detail.auditSummary || 'A auditoria final será executada depois das nove frentes de pesquisa.'}</p><div className="skybob-audit-numbers"><div><strong>{approved.length}</strong><span>aprovadas</span></div><div><strong>{rejected.length}</strong><span>rejeitadas</span></div><div><strong>{detail.evidence.length-approved.length-rejected.length}</strong><span>com contexto / pendentes</span></div></div></section>
    <section className="skybob-audit-log"><h3>Trilha da investigação</h3>{detail.searches.map(row => <div key={row.stage}><span className={`audit-dot ${row.status}`}/><div><strong>{row.label}</strong><small>{row.sourceCount} fontes · {({completed:'Concluída',running:'Em andamento',submitting:'Iniciando',failed:'Falhou',queued:'Na fila'})[row.status] || row.status} · {dateLabel(row.updatedAt)}</small>{row.error && <em>{row.error}</em>}</div></div>)}</section>
  </div>
}

function DossierPreview({detail, report, onDownload, pdfBusy}) {
  const locked = report.lockedPlan || detail.lockedPlan || {priorities:0,actions:0,fronts:0}
  return <div className="skybob-dossier-preview">
    <section className="skybob-dossier-cover"><span>SKYBOB</span><small>DOSSIÊ DE AUTORIDADE DIGITAL</small><h2>{detail.companyName}</h2><p>{report.cover_line || 'O que a internet realmente consegue provar sobre sua empresa.'}</p><button className="skybob-primary" disabled={pdfBusy} onClick={() => onDownload(detail.id,detail.companyName,true)}>{pdfBusy ? <Loader2 className="spin"/> : <Eye/>}Visualizar PDF completo</button></section>
    <section className="skybob-dossier-findings"><div className="skybob-panel-title"><Target/><div><strong>Resumo dos achados do dossiê</strong><span>Abra o PDF para conferir todas as seções.</span></div></div>{(report.findings||[]).map((finding,index) => <article key={`${finding.title}-${index}`}><small>{finding.category}</small><h3>{finding.title}</h3><p>{finding.body}</p></article>)}{!report.findings?.length && <article><p>A auditoria não confirmou fragilidades suficientes para sustentar críticas fortes.</p></article>}</section>
    {locked.priorities > 0 && <section className="skybob-locked-plan"><div className="skybob-lock-head"><LockKeyhole/><div><strong>Próximos passos identificados</strong><span>{locked.priorities} prioridades · {locked.fronts} frentes</span></div></div><div className="skybob-blur-lines">{Array.from({length:Math.min(4,locked.priorities)}).map((_,i) => <div key={i}><i/><i/></div>)}</div><b>CONTEÚDO BLOQUEADO</b><p>A investigação está documentada. A estratégia de correção é outra etapa.</p></section>}
  </div>
}

function IdentityConfirmation({detail, busy, onClose, onConfirm}) {
  const [checked, setChecked] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (!checked || busy) return
    await onConfirm({companyName:detail.companyName, city:detail.city, googleUrl:detail.googleUrl, siteUrl:detail.siteUrl})
  }
  return <div className="skybob-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}><form className="skybob-modal skybob-identity-confirmation" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="skybob-confirm-title">
    <button type="button" className="skybob-modal-close" disabled={busy} onClick={onClose} aria-label="Fechar confirmação"><X/></button>
    <span className="skybob-eyebrow"><ShieldCheck/>CONFIRMAR EMPRESA</span><h2 id="skybob-confirm-title">Esta é a empresa que você quer investigar?</h2><p>Confira os quatro dados. Sua confirmação libera a pesquisa; cada evidência seguirá para verificação.</p>
    <dl><div><dt>Nome da empresa</dt><dd>{detail.companyName}</dd></div><div><dt>Cidade onde atua</dt><dd>{detail.city}</dd></div><div><dt>Perfil da Empresa no Google</dt><dd><a href={detail.googleUrl} target="_blank" rel="noreferrer">{detail.googleUrl}</a></dd></div><div><dt>Site oficial</dt><dd><a href={detail.siteUrl} target="_blank" rel="noreferrer">{detail.siteUrl}</a></dd></div></dl>
    <label className="skybob-confirm-check"><input type="checkbox" required checked={checked} disabled={busy} onChange={event => setChecked(event.target.checked)}/><span>Confirmo que estes dados e links pertencem à empresa que quero investigar.</span></label>
    <div className="skybob-modal-actions"><button type="button" className="skybob-secondary" disabled={busy} onClick={onClose}>Voltar</button><button className="skybob-primary" disabled={!checked || busy}>{busy ? <Loader2 className="spin"/> : <Check/>}{busy ? 'Confirmando...' : 'Confirmar e continuar'}</button></div>
  </form></div>
}

function NewInvestigation({configured, initial, onClose, onCreate}) {
  const [form,setForm] = useState({companyName:initial?.companyName || '',city:initial?.city || '',googleUrl:initial?.googleUrl || '',siteUrl:initial?.siteUrl || ''})
  const [busy,setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); if (busy) return
    setBusy(true); try { await onCreate(form) } finally { setBusy(false) }
  }
  return <div className="skybob-modal-backdrop" onMouseDown={event => { if (event.target===event.currentTarget && !busy) onClose() }}><form className="skybob-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="skybob-form-title">
    <button type="button" className="skybob-modal-close" disabled={busy} onClick={onClose} aria-label="Fechar formulário"><X/></button>
    <span className="skybob-eyebrow"><Zap/>{initial ? 'CORRIGIR IDENTIDADE' : 'NOVA INVESTIGAÇÃO'}</span><h2 id="skybob-form-title">{initial ? 'Confira os dados da empresa' : 'Quem o Skybob vai colocar à prova?'}</h2><p>{initial ? 'Salve os quatro dados para consultar o site e confirmar novamente a identidade.' : 'Somente quatro dados. O restante será descoberto autonomamente em fontes públicas.'}</p>
    {!configured && <div className="skybob-error"><AlertTriangle/><span>Configure a chave da OpenAI desta conta no Mapa IA antes de iniciar.</span></div>}
    <label><span>Nome da empresa</span><input required value={form.companyName} onChange={e => setForm({...form,companyName:e.target.value})} placeholder="Ex.: Tapeçaria Sob Medida"/></label>
    <label><span>Cidade onde atua</span><input required value={form.city} onChange={e => setForm({...form,city:e.target.value})} placeholder="Ex.: Londrina, PR"/></label>
    <label><span>Perfil da Empresa no Google</span><input required inputMode="url" value={form.googleUrl} onChange={e => setForm({...form,googleUrl:e.target.value})} placeholder="https://maps.google.com/..."/></label>
    <label><span>Site oficial</span><input required inputMode="url" value={form.siteUrl} onChange={e => setForm({...form,siteUrl:e.target.value})} placeholder="empresa.com.br"/></label>
    <div className="skybob-modal-actions"><button type="button" className="skybob-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="skybob-primary" disabled={!configured || busy}>{busy?<Loader2 className="spin"/>:<FileSearch/>}{initial ? 'Salvar e retomar' : 'Iniciar investigação'}</button></div>
  </form></div>
}
