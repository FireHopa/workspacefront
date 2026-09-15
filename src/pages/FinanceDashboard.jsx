import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Wallet, LayoutDashboard, FileText, CalendarClock, BadgeEuro, Layers, Plus, Search, LogOut, RefreshCw, X, ArrowUpRight, Settings, Check } from 'lucide-react'
import { api } from '../services/api'
import './FinanceDashboard.css'

const money = (cents = 0, currency = 'EUR') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100)
const dateLabel = value => value ? value.split('-').reverse().join('/') : '—'
const dateToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const labels = { pago: 'Pago', agendado: 'Agendado', a_receber: 'A receber', atrasado: 'Atrasado', ativo: 'Ativo', encerrado: 'Encerrado' }
const nav = [['overview', 'Visão geral', LayoutDashboard], ['contracts', 'Contratos', FileText], ['receivables', 'Recebimentos', CalendarClock], ['commissions', 'Comissões', BadgeEuro], ['plans', 'Planos', Layers]]
const errorText = error => {
  const detail = error.response?.data?.detail
  return typeof detail === 'string' ? detail : Array.isArray(detail) ? 'Confira os campos: ' + detail.map(item => item.loc?.slice(1).join('.') || 'valor inválido').join(', ') : 'Não foi possível concluir. Confira sua conexão e tente novamente.'
}
const statusBadge = status => <span className={`fin-badge ${status}`}>{labels[status]}</span>

function Modal({ title, children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog className="fin-dialog" ref={ref} onCancel={event => { event.preventDefault(); onClose() }} aria-label={title}>
    <div className="fin-dialog-head"><h2>{title}</h2><button type="button" className="fin-icon" aria-label="Fechar" onClick={onClose}><X size={22} /></button></div>
    <div className="fin-dialog-body">{children}</div>
  </dialog>
}

function Field({ label, children, wide = false }) {
  return <label className={wide ? 'fin-field fin-wide' : 'fin-field'}><span>{label}</span>{children}</label>
}

function ContractForm({ plans, quote, today, busy, error, onSubmit }) {
  const [form, setForm] = useState({ request_key: crypto.randomUUID(), name: '', company: '', contact: '', plan_id: '', payment_type: 'a_vista', payment_method: 'Wise', contract_date: today, currency: 'EUR', total: '', total_eur: '', installments: 1 })
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const activePlans = plans.filter(plan => plan.active)
  const euroCents = Math.round(Number(form.currency === 'EUR' ? form.total : form.total_eur) * 100)
  const firstCents = euroCents > 0 ? Math.ceil(euroCents / Number(form.installments)) : 0
  const commission = Math.floor((firstCents * 5 + 50) / 100)
  return <form onSubmit={event => { event.preventDefault(); onSubmit({ ...form, plan_id: Number(form.plan_id), installments: Number(form.installments), total_eur: form.currency === 'EUR' ? null : form.total_eur }) }}>
    <div className="fin-form-grid">
      <Field label="Nome"><input required maxLength={160} value={form.name} onChange={event => change('name', event.target.value)} autoFocus /></Field>
      <Field label="Empresa"><input required maxLength={160} value={form.company} onChange={event => change('company', event.target.value)} /></Field>
      <Field label="Contato" wide><input required maxLength={180} placeholder="Telefone, WhatsApp ou e-mail" value={form.contact} onChange={event => change('contact', event.target.value)} /></Field>
      <Field label="Plano" wide><select required value={form.plan_id} onChange={event => {
        const plan = activePlans.find(item => item.id === Number(event.target.value))
        setForm(current => ({ ...current, plan_id: event.target.value, total: plan ? (plan.amount_cents / 100).toFixed(2) : '', currency: plan?.currency || 'EUR', total_eur: '' }))
      }}><option value="">Selecione um plano</option>{activePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.amount_cents, plan.currency)}</option>)}</select></Field>
      <Field label="Moeda do contrato"><select value={form.currency} onChange={event => setForm(current => ({ ...current, currency: event.target.value, total: '', total_eur: '' }))}><option value="EUR">Euro (EUR)</option><option value="BRL">Real (BRL)</option></select></Field>
      <Field label="Valor total"><input type="number" min="0.01" max="100000000" step="0.01" required value={form.total} onChange={event => change('total', event.target.value)} /></Field>
      {form.currency === 'BRL' && <div className="fin-wide fin-conversion"><Field label="Valor-base total em euro (comissões)"><input type="number" min="0.01" max="100000000" step="0.01" required value={form.total_eur} onChange={event => change('total_eur', event.target.value)} /></Field><button type="button" className="fin-btn secondary" disabled={!quote || quote.stale || quote.unavailable || !Number(form.total)} onClick={() => change('total_eur', (Number(form.total) / Number(quote.eur_brl)).toFixed(2))}>Usar cotação diária</button><p>{quote?.reference_date && <>Cotação diária de {dateLabel(quote.reference_date)}. </>}Confirme o valor em euro acordado. Essa base fica fixa para todas as parcelas, mesmo que o real varie.</p></div>}
      <Field label="Forma de pagamento"><select value={form.payment_type} onChange={event => setForm(current => ({ ...current, payment_type: event.target.value, installments: event.target.value === 'a_vista' ? 1 : 2 }))}><option value="a_vista">À vista</option><option value="parcelado">Parcelado</option></select></Field>
      <Field label="Meio de pagamento"><select value={form.payment_method} onChange={event => change('payment_method', event.target.value)}>{['Wise', 'Cartão', 'Pix'].map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Data do contrato / 1º pagamento"><input type="date" required max={today} value={form.contract_date} onChange={event => change('contract_date', event.target.value)} /></Field>
      {form.payment_type === 'parcelado' && <Field label="Quantidade de parcelas"><input required type="number" min="2" max="120" step="1" value={form.installments} onChange={event => change('installments', event.target.value)} /></Field>}
    </div>
    <div className="fin-notice"><strong>Primeira parcela paga: {money(firstCents)}</strong><p>Comissão a ser paga: {money(commission)} (5%). {form.payment_type === 'parcelado' ? 'As próximas parcelas vencem a cada 30 dias, contados da data do primeiro pagamento.' : 'O contrato ficará encerrado após o cadastro.'}</p><p>O cadastro registra um pagamento já recebido. Não realiza cobranças nem transferências.</p></div>
    {error && <p className="fin-error" role="alert">{error}</p>}
    <button className="fin-btn fin-submit" disabled={busy || !activePlans.length}>{busy ? 'Salvando…' : 'Cadastrar contrato e 1º recebimento'}</button>
  </form>
}

function PlanForm({ plan, busy, error, onSubmit }) {
  const [form, setForm] = useState({ name: plan?.name || '', amount: plan ? (plan.amount_cents / 100).toFixed(2) : '', currency: plan?.currency || 'EUR', active: plan?.active ?? true })
  return <form onSubmit={event => { event.preventDefault(); onSubmit(form) }}><div className="fin-form-grid">
    <Field label="Nome do plano" wide><input required maxLength={120} autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
    <Field label="Valor sugerido"><input type="number" min="0.01" max="100000000" step="0.01" required value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></Field>
    <Field label="Moeda"><select value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value })}><option value="EUR">Euro</option><option value="BRL">Real</option></select></Field>
    <label className="fin-check fin-wide"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} /> Disponível para novos contratos</label>
  </div><p className="fin-muted">Alterações no plano não modificam contratos já cadastrados.</p>{error && <p role="alert" className="fin-error">{error}</p>}<button className="fin-btn fin-submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar plano'}</button></form>
}

function PaymentForm({ item, commission, today, busy, error, onSubmit }) {
  const [paidOn, setPaidOn] = useState(today)
  const [method, setMethod] = useState(item.contract.payment_method)
  const commissionCents = commission ? item.commission_eur_cents : Math.floor((item.eur_cents * 5 + 50) / 100)
  return <form onSubmit={event => { event.preventDefault(); onSubmit(commission ? { paid_on: paidOn } : { paid_on: paidOn, payment_method: method }) }}>
    <div className="fin-notice"><strong>{item.contract.company} · Parcela {item.number}/{item.contract.installment_count}</strong><p>{commission ? 'Comissão a pagar' : 'Valor a receber'}: {commission ? money(commissionCents) : money(item.amount_cents, item.contract.currency)}</p>{!commission && <p>Base em euro: {money(item.eur_cents)} · Comissão (5%): {money(commissionCents)} · Líquido: {money(item.eur_cents - commissionCents)}</p>}</div>
    <div className="fin-form-grid"><Field label={commission ? 'Data do pagamento da comissão' : 'Data do recebimento'}><input required type="date" min={commission ? item.paid_on : item.contract.contract_date} max={today} value={paidOn} onChange={event => setPaidOn(event.target.value)} /></Field>
      {!commission && <Field label="Meio de pagamento"><select value={method} onChange={event => setMethod(event.target.value)}>{['Wise', 'Cartão', 'Pix'].map(value => <option key={value}>{value}</option>)}</select></Field>}
    </div><p className="fin-muted">Confirme apenas depois de verificar o pagamento. Este registro não movimenta dinheiro.</p>{error && <p className="fin-error" role="alert">{error}</p>}<button className="fin-btn fin-submit" disabled={busy}>{busy ? 'Registrando…' : commission ? 'Confirmar comissão paga em euro' : 'Confirmar recebimento'}</button>
  </form>
}

function ContactForm({ contract, busy, error, onSubmit }) {
  const [form, setForm] = useState({ name: contract.name, company: contract.company, contact: contract.contact })
  return <form onSubmit={event => { event.preventDefault(); onSubmit(form) }}><div className="fin-form-grid">{[['name', 'Nome'], ['company', 'Empresa'], ['contact', 'Contato']].map(([key, label]) => <Field key={key} label={label} wide={key === 'contact'}><input required maxLength={key === 'contact' ? 180 : 160} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} /></Field>)}</div>{error && <p role="alert" className="fin-error">{error}</p>}<button className="fin-btn fin-submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar dados'}</button></form>
}

function PasswordForm({ busy, error, onSubmit }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirmation: '' })
  return <form onSubmit={event => { event.preventDefault(); onSubmit(form) }}><div className="fin-form-grid">{[['current_password', 'Senha atual'], ['new_password', 'Nova senha'], ['confirmation', 'Confirmar nova senha']].map(([key, label]) => <Field key={key} label={label} wide><input type="password" required minLength={key === 'current_password' ? 1 : 6} autoComplete={key === 'current_password' ? 'current-password' : 'new-password'} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} /></Field>)}</div>{error && <p role="alert" className="fin-error">{error}</p>}<button className="fin-btn fin-submit" disabled={busy}>{busy ? 'Salvando…' : 'Alterar senha'}</button></form>
}

export default function FinanceDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState(null)
  const [plans, setPlans] = useState([])
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos')
  const [modal, setModal] = useState(null)
  const [modalError, setModalError] = useState('')
  const [busy, setBusy] = useState(false)
  const mutationLock = useRef(false)
  const requestSequence = useRef(0)
  const refresh = useCallback(async (foreground = false) => {
    const sequence = ++requestSequence.current
    if (foreground) setLoading(true)
    try {
      const [overview, planList] = await Promise.all([api.get('/finance/overview'), api.get('/finance/plans')])
      if (sequence !== requestSequence.current) return
      setData(overview.data); setPlans(planList.data); setError('')
    } catch (error) { if (sequence === requestSequence.current) setError(errorText(error)) }
    finally { if (sequence === requestSequence.current) setLoading(false) }
  }, [])
  const refreshQuote = useCallback(async () => {
    setQuoteBusy(true)
    try { const response = await api.get('/finance/quote'); setQuote(response.data); setQuoteError(response.data.unavailable ? `${response.data.message || 'Consulta indisponível.'} Exibindo a última cotação obtida.` : '') }
    catch (error) { setQuoteError(error.response?.status === 503 && typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Cotação indisponível. O cadastro em euro continua funcionando.'); setQuote(current => current ? { ...current, unavailable: true, stale: true } : null) }
    finally { setQuoteBusy(false) }
  }, [])
  useEffect(() => {
    refresh(true); refreshQuote()
    const interval = setInterval(() => { refresh(); refreshQuote() }, 60000)
    const onFocus = () => { refresh(); refreshQuote() }
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); requestSequence.current++ }
  }, [refresh, refreshQuote])
  const open = value => { setModalError(''); setModal(value) }
  const close = () => { if (!mutationLock.current) setModal(null) }
  const mutate = async (operation, message) => {
    if (mutationLock.current) return
    mutationLock.current = true; setBusy(true); setModalError(''); setNotice('')
    try { await operation(); setModal(null); setNotice(message); await refresh() }
    catch (error) { setModalError(errorText(error)) }
    finally { mutationLock.current = false; setBusy(false) }
  }
  const contracts = data?.contracts || []
  const totals = data?.totals || {}
  const today = data?.today || dateToday()
  const allItems = contracts.flatMap(contract => contract.installments.map(item => ({ ...item, contract })))
  const matches = contract => `${contract.name} ${contract.company} ${contract.contact} ${contract.plan_name}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
  const visibleContracts = contracts.filter(contract => matches(contract) && (filter === 'todos' || contract.status === filter))
  const items = allItems.filter(item => matches(item.contract) && (filter === 'todos' || item.status === filter)).sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id)
  const commissions = allItems.filter(item => item.paid_on && matches(item.contract) && (filter === 'todos' || (filter === 'pagas' ? item.commission_paid_on : !item.commission_paid_on))).sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.id - a.id)
  const navigate = next => { setTab(next); setSearch(''); setFilter('todos'); setNotice('') }
  const detailContract = modal?.type === 'detail' ? contracts.find(contract => contract.id === modal.contract.id) || modal.contract : null
  const installmentTable = (rows, isCommission = false) => <div className="fin-table-wrap"><table><thead><tr><th>Empresa / parcela</th><th>{isCommission ? 'Recebimento' : 'Vencimento'}</th><th>{isCommission ? 'Base em euro' : 'Valor'}</th><th>{isCommission ? 'Comissão · 5%' : 'Status'}</th><th>{isCommission ? 'Pagamento da comissão' : 'Recebimento'}</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{rows.map(item => <tr key={item.id}>
    <td><button className="fin-text-btn" onClick={() => open({ type: 'detail', contract: item.contract })}>{item.contract.company}</button><small>{item.number}/{item.contract.installment_count} · {item.contract.name}</small></td>
    <td>{dateLabel(isCommission ? item.paid_on : item.due_date)}</td><td>{money(isCommission ? item.eur_cents : item.amount_cents, isCommission ? 'EUR' : item.contract.currency)}</td>
    <td>{isCommission ? money(item.commission_eur_cents) : statusBadge(item.status)}</td>
    <td>{isCommission ? item.commission_paid_on ? <><span className="fin-badge pago">Paga</span><small>{dateLabel(item.commission_paid_on)}</small></> : <span className="fin-badge a_receber">A pagar</span> : item.paid_on ? <>{dateLabel(item.paid_on)}<small>{item.received_via}</small></> : '—'}</td>
    <td>{isCommission ? !item.commission_paid_on && <button className="fin-btn secondary small" onClick={() => open({ type: 'commission', item })}>Registrar pagamento</button> : !item.paid_on && <button className="fin-btn secondary small" onClick={() => open({ type: 'receive', item })}>Receber</button>}</td>
  </tr>)}</tbody></table>{!rows.length && <div className="fin-empty">Nenhum registro encontrado.</div>}</div>

  return <div className="finance-app">
    <aside className="fin-sidebar"><div className="fin-brand"><div><Wallet size={23} /></div><span>Financeiro<small>Contratos e comissões</small></span></div><nav aria-label="Financeiro">{nav.map(([key, label, Icon]) => <button key={key} className={tab === key ? 'selected' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={19} />{label}</button>)}</nav><div className="fin-account"><strong>{user.name}</strong><small>Perfil Financeiro</small><button onClick={() => open({ type: 'password' })}><Settings size={17} /> Minha conta</button><button onClick={onLogout}><LogOut size={17} /> Sair</button></div></aside>
    <main className="fin-main"><header className="fin-page-head"><div><p className="fin-eyebrow">CONTROLE FINANCEIRO</p><h1>{nav.find(([key]) => key === tab)?.[1]}</h1></div><div className="fin-head-actions"><button className="fin-btn secondary" onClick={() => refresh(true)} disabled={loading}><RefreshCw size={16} /> Atualizar</button><button className="fin-btn" disabled={loading || !data} onClick={() => open({ type: tab === 'plans' || !plans.some(plan => plan.active) ? 'plan' : 'contract' })}><Plus size={18} />{tab === 'plans' || !plans.some(plan => plan.active) ? 'Novo plano' : 'Novo contrato'}</button></div></header>
      <div className="fin-quote"><span><strong>{quote ? `€ 1 = ${Number(quote.eur_brl).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}` : 'Cotação EUR / BRL'}</strong><small>{quote ? `${quote.stale ? 'Última cotação salva · ' : ''}${quote.source || 'Frankfurter / BCE'} · Referência: ${dateLabel(quote.reference_date)}` : 'Cotação diária · Frankfurter / BCE'}</small></span><p>{quoteError || 'Referência diária, não em tempo real. Em fins de semana e feriados, vale a última publicação.'}</p><button className="fin-icon" disabled={quoteBusy} aria-label="Atualizar cotação" onClick={refreshQuote}><RefreshCw size={17} /></button></div>
      {error && <p className="fin-error" role="alert">{error}</p>}{notice && <div className="fin-success" role="status"><Check size={18} />{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={16} /></button></div>}
      {loading && !data ? <div role="status" className="fin-empty">Carregando seus contratos…</div> : !data ? <div className="fin-empty">Não foi possível carregar os dados. Use Atualizar para tentar novamente.</div> : <>
        {tab === 'overview' && <><div className="fin-stats">
          <article className="fin-stat featured"><span>Comissão a ser paga</span><strong>{money(totals.commission_pending_eur_cents)}</strong><button onClick={() => navigate('commissions')}>Ver comissões <ArrowUpRight size={18} /></button></article>
          <article className="fin-stat"><span>Total recebido</span><strong>{money(totals.received_eur_cents)}</strong><small>Base registrada em euro</small></article>
          <article className="fin-stat"><span>Líquido após comissão</span><strong>{money(totals.net_eur_cents)}</strong><small>Recebido menos 5% de cada parcela</small></article>
          <article className="fin-stat"><span>Saldo a receber</span><strong>{money(totals.outstanding_eur_cents)}</strong><small>Parcelas ainda não recebidas</small></article>
        </div><div className="fin-status-strip"><div><span>Vence em até 7 dias</span><strong>{money(totals.due_soon_eur_cents)}</strong></div><div><span>Atrasado</span><strong className="fin-danger">{money(totals.overdue_eur_cents)}</strong></div><div><span>Comissões já pagas</span><strong>{money(totals.commission_paid_eur_cents)}</strong></div><div><span>Contratos</span><strong>{contracts.filter(contract => contract.status === 'ativo').length} ativos · {contracts.filter(contract => contract.status === 'encerrado').length} encerrados</strong></div></div>
          {!contracts.length ? <section className="fin-panel fin-empty"><FileText size={36} /><h2>Seu primeiro contrato começa aqui</h2><p>{plans.some(plan => plan.active) ? 'Cadastre o cliente e o primeiro pagamento. As próximas parcelas serão organizadas automaticamente.' : 'Cadastre um plano para começar a registrar seus contratos.'}</p><button className="fin-btn" onClick={() => open({ type: plans.some(plan => plan.active) ? 'contract' : 'plan' })}><Plus size={18} />{plans.some(plan => plan.active) ? 'Cadastrar contrato' : 'Cadastrar plano'}</button></section> : <section className="fin-panel"><div className="fin-panel-head"><h2>Atenção aos vencimentos</h2><button className="fin-text-btn" onClick={() => navigate('receivables')}>Ver todos</button></div>{installmentTable(allItems.filter(item => ['atrasado', 'a_receber'].includes(item.status)).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 10))}</section>}
        </>}
        {['contracts', 'receivables', 'commissions'].includes(tab) && <section className="fin-panel"><div className="fin-toolbar"><label className="fin-search"><Search size={18} /><input aria-label="Buscar registros" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nome, empresa ou contato" /></label><label className="fin-filter"><span>Status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="todos">Todos</option>{(tab === 'contracts' ? [['ativo', 'Ativos'], ['encerrado', 'Encerrados']] : tab === 'commissions' ? [['pendentes', 'A pagar'], ['pagas', 'Pagas']] : [['agendado', 'Agendados'], ['a_receber', 'A receber (até 7 dias)'], ['atrasado', 'Atrasados'], ['pago', 'Pagos']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          {tab === 'contracts' ? <div className="fin-table-wrap"><table><thead><tr><th>Cliente / empresa</th><th>Plano</th><th>Contrato</th><th>Valor total</th><th>Parcelas</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{visibleContracts.map(contract => <tr key={contract.id}><td><strong>{contract.company}</strong><small>{contract.name}</small></td><td>{contract.plan_name}</td><td>{dateLabel(contract.contract_date)}<small>{contract.payment_method}</small></td><td>{money(contract.total_cents, contract.currency)}{contract.currency === 'BRL' && <small>Base: {money(contract.total_eur_cents)}</small>}</td><td>{contract.installments.filter(item => item.paid_on).length}/{contract.installment_count} pagas</td><td>{statusBadge(contract.status)}</td><td><button className="fin-text-btn" onClick={() => open({ type: 'detail', contract })}>Ver contrato</button></td></tr>)}</tbody></table>{!visibleContracts.length && <div className="fin-empty">Nenhum contrato encontrado.</div>}</div> : installmentTable(tab === 'commissions' ? commissions : items, tab === 'commissions')}
        </section>}
        {tab === 'plans' && <section className="fin-panel"><div className="fin-panel-head"><h2>Planos cadastrados</h2><span>{plans.length} planos</span></div><div className="fin-table-wrap"><table><thead><tr><th>Plano</th><th>Valor sugerido</th><th>Disponibilidade</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{plans.map(plan => <tr key={plan.id}><td><strong>{plan.name}</strong></td><td>{money(plan.amount_cents, plan.currency)}</td><td><span className={`fin-badge ${plan.active ? 'pago' : 'agendado'}`}>{plan.active ? 'Ativo' : 'Arquivado'}</span></td><td><button className="fin-text-btn" onClick={() => open({ type: 'plan', plan })}>Editar plano</button></td></tr>)}</tbody></table>{!plans.length && <div className="fin-empty">Cadastre seu primeiro plano no botão Novo plano.</div>}</div></section>}
      </>}
      <footer className="fin-footer">Parcelas a cada 30 dias · Comissão de 5% por parcela recebida · Sem renovação automática</footer>
    </main>
    {modal && <Modal key={`${modal.type}-${modal.item?.id || modal.plan?.id || modal.contract?.id || ''}`} title={{ contract: 'Novo contrato', plan: modal.plan ? 'Editar plano' : 'Novo plano', receive: 'Registrar recebimento', commission: 'Pagar comissão', detail: 'Detalhes do contrato', contact: 'Editar dados do cliente', password: 'Minha conta' }[modal.type]} onClose={close}>
      {modal.type === 'contract' && <ContractForm plans={plans} quote={quote} today={today} busy={busy} error={modalError} onSubmit={body => mutate(() => api.post('/finance/contracts', body), 'Contrato cadastrado. Primeira parcela e comissão registradas.')} />}
      {modal.type === 'plan' && <PlanForm plan={modal.plan} busy={busy} error={modalError} onSubmit={body => mutate(() => modal.plan ? api.put(`/finance/plans/${modal.plan.id}`, body) : api.post('/finance/plans', body), 'Plano salvo.')} />}
      {['receive', 'commission'].includes(modal.type) && <PaymentForm item={modal.item} commission={modal.type === 'commission'} today={today} busy={busy} error={modalError} onSubmit={body => mutate(() => api.post(`/finance/installments/${modal.item.id}/${modal.type === 'commission' ? 'commission-paid' : 'receive'}`, body), modal.type === 'commission' ? 'Pagamento da comissão registrado em euro.' : 'Parcela recebida. Comissão de 5% registrada.')} />}
      {modal.type === 'contact' && <ContactForm contract={modal.contract} busy={busy} error={modalError} onSubmit={body => mutate(() => api.patch(`/finance/contracts/${modal.contract.id}`, body), 'Dados do cliente atualizados.')} />}
      {modal.type === 'password' && <PasswordForm busy={busy} error={modalError} onSubmit={body => { if (body.new_password !== body.confirmation) return setModalError('A nova senha e a confirmação não coincidem.'); mutate(() => api.put(`/users/${user.id}/password`, { current_password: body.current_password, new_password: body.new_password }), 'Senha alterada.') }} />}
      {detailContract && <><div className="fin-detail-head"><div><h3>{detailContract.company}</h3><p>{detailContract.name} · {detailContract.contact}</p></div>{statusBadge(detailContract.status)}</div><dl className="fin-details"><div><dt>Plano</dt><dd>{detailContract.plan_name}</dd></div><div><dt>Data do contrato</dt><dd>{dateLabel(detailContract.contract_date)}</dd></div><div><dt>Valor contratado</dt><dd>{money(detailContract.total_cents, detailContract.currency)}</dd></div><div><dt>Base total em euro</dt><dd>{money(detailContract.total_eur_cents)}</dd></div><div><dt>Pagamento</dt><dd>{detailContract.payment_type === 'a_vista' ? 'À vista' : `${detailContract.installment_count} parcelas`} · {detailContract.payment_method}</dd></div></dl><button className="fin-btn secondary" onClick={() => open({ type: 'contact', contract: detailContract })}>Editar dados do cliente</button><h3 className="fin-section-title">Parcelas e recebimentos</h3>{installmentTable(detailContract.installments.map(item => ({ ...item, contract: detailContract })))}<h3 className="fin-section-title">Comissões geradas</h3>{installmentTable(detailContract.installments.filter(item => item.paid_on).map(item => ({ ...item, contract: detailContract })), true)}<p className="fin-muted">Valores e vencimentos são preservados após o cadastro para manter o histórico dos pagamentos.</p></>}
    </Modal>}
  </div>
}
