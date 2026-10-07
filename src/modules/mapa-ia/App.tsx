import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { ArrowRight, Building2, Check, ChevronRight, CircleHelp, Download, FileSpreadsheet, FolderOpen, Globe, History, Import, KeyRound, Loader2, LogOut, MapPin, Pause, Play, Plus, RefreshCw, Search, Settings as SettingsIcon, ShieldCheck, Sparkles, Square, UserRound, Users, WandSparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Progress } from "./ui/progress";
import { AuditDialog, CompanyDialog, ImportDialog, NicheConfirmDialog, SettingsDialog } from "./Dialogs";
import { Badge, Choice, DownloadLink, Field, fold, host, labels, request, timeLabel } from "./helpers";
import { defaultResultFilters, filterKey, filterResults } from "./analysisFilters";
import { nextNicheSuggestion } from "./nicheSuggestions";
import { NicheBatchDialog, NicheResults, NicheRunDialog, nicheCandidates, type NicheScope } from "./NicheWorkflow";
import type { Company, Job, Staged, State } from "./types";
import { AccountDialog, type WorkspaceUser } from "./AccountDialog";
import "./styles.css";

const DEFAULT_QUERY = "Quais as melhores empresas de {nicho} em {cidade}?";
const empty: State = {version: "1.5.0", settings: {identificationModel: "gpt-6-luna", model: "gpt-6.1-sol", extractionModel: "gpt-6-luna", keyConfigured: false, keyHint: "", fromEnvironment: false}, immersions: [], selectedId: "", companies: [], jobs: [], nicheSuggestions: []};

export default function App({user, onLogout}: {user: WorkspaceUser; onLogout: () => void}) {
  const [state, setState] = useState<State>(empty);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [tab, setTab] = useState("import");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [edit, setEdit] = useState<Company | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [repetitions, setRepetitions] = useState("3");
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [historyId, setHistoryId] = useState("");
  const [analysisFilters, setAnalysisFilters] = useState({...defaultResultFilters});
  const [researchNiche, setResearchNiche] = useState("all");
  const [autoReviewPaused, setAutoReviewPaused] = useState(false);
  const [reviewDeferred, setReviewDeferred] = useState(false);
  const [nicheRunOpen, setNicheRunOpen] = useState(false);
  const [identifyHistoryId, setIdentifyHistoryId] = useState("");
  const [reviewSuggestionId, setReviewSuggestionId] = useState("");
  const [batchJobId, setBatchJobId] = useState("");
  const [audit, setAudit] = useState<{id: string; niche: string} | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedId = useRef("");
  const sequence = useRef(0);
  const initialized = useRef(false);
  const refresh = useCallback(async (id = selectedId.current) => {
    const current = ++sequence.current;
    try {
      const next = await request<State>(`/api/state${id ? `?immersion=${encodeURIComponent(id)}` : ""}`);
      if (sequence.current !== current) return;
      selectedId.current = next.selectedId; setState(next); setConnectionError(""); setLoading(false);
      if (!initialized.current) {initialized.current = true; setTab(next.selectedId ? "review" : "import");}
    } catch (e) {
      if (sequence.current === current) {setConnectionError(e instanceof Error ? e.message : "Não foi possível acessar o servidor do Workspace."); setLoading(false);}
      throw e;
    }
  }, []);
  useEffect(() => {void refresh().catch(() => {}); const interval = setInterval(() => {void refresh().catch(() => {});}, 4000); return () => clearInterval(interval);}, [refresh]);
  async function perform(operation: () => Promise<void>) {
    setBusy(true);
    try {await operation();} catch (e) {toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");} finally {setBusy(false);}
  }
  function selectImmersion(id: string) {selectedId.current = id; setResearchNiche("all"); setAutoReviewPaused(false); setReviewDeferred(false); setReviewSuggestionId(""); setIdentifyHistoryId(""); setBatchJobId(""); setFilter(""); setStatusFilter("all"); setHistoryId(""); setTab("review"); void perform(() => refresh(id));}
  async function upload(file?: File) {
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) {toast.error("Selecione um arquivo .xlsx ou .csv."); return;}
    if (file.size > 10 * 1024 * 1024) {toast.error("A planilha deve ter até 10 MB."); return;}
    await perform(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      const inspected = await request<Staged>("/api/uploads/inspect", {filename: file.name, base64: btoa(binary)});
      if (!inspected.sheets.length) throw new Error("A planilha está vazia. Escolha um arquivo com inscrições.");
      setStaged(inspected);
    });
    if (fileInput.current) fileInput.current.value = "";
  }
  const immersion = state.immersions.find(i => i.id === state.selectedId);
  const ready = state.companies.filter(c => c.status === "ready");
  const niches = [...new Map(ready.map(c => [filterKey(c.niche), c.niche])).values()];
  const allNiches = [...new Set(state.companies.map(c => c.niche).filter(Boolean))].sort();
  const active = state.jobs.find(j => ["queued", "running", "paused"].includes(j.status));
  const analyses = state.jobs.filter(j => j.kind === "analyze");
  const history = analyses.find(j => j.id === historyId) || analyses[0];
  const identifications = state.jobs.filter(j => j.kind === "identify");
  const latestIdentify = identifications.find(j => j.id === identifyHistoryId) || identifications[0];
  const auditJob = state.jobs.find(j => j.id === audit?.id) || null;
  const visible = state.companies.filter(c => (statusFilter === "all" || c.status === statusFilter) && fold([c.name, c.original_name, c.niche, ...c.participants.map(p => p.name)].join(" ")).includes(fold(filter)));
  const identifiedCandidates = nicheCandidates(state.companies, "all");
  const scopedReady = researchNiche === "all" ? ready : ready.filter(c => filterKey(c.niche) === researchNiche);
  const scopedNiches = [...new Map(scopedReady.map(c => [filterKey(c.niche), c.niche])).values()];
  const results = history?.results || [];
  const visibleResults = filterResults(results, analysisFilters, state.companies);
  const resultNiches = [...new Map(results.map(r => [filterKey(r.niche), r.niche])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const resultCities = [...new Map(results.filter(r => r.actual_city).map(r => [filterKey(r.actual_city), r.actual_city])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const filteredResults = Object.entries(analysisFilters).some(([key, value]) => value !== defaultResultFilters[key as keyof typeof defaultResultFilters]);
  const suggestions = state.nicheSuggestions || [];
  const blockingDialog = Boolean(staged || edit || settingsOpen || accountOpen || audit || nicheRunOpen || batchJobId || loading || busy);
  const nicheSuggestion = !blockingDialog && reviewSuggestionId ? suggestions.find(s => s.id === reviewSuggestionId) || null : nextNicheSuggestion(suggestions, blockingDialog, autoReviewPaused, reviewDeferred);
  const observedJobs = useRef(new Map<string, string>());
  useEffect(() => {
    for (const job of state.jobs) {
      const before = observedJobs.current.get(job.id);
      if (before && ["queued", "running", "paused"].includes(before) && ["completed", "partial", "stopped"].includes(job.status)) {
        if (job.kind === "identify") {
          const counts = job.identification?.counts;
          toast.info(`Identificação ${job.status === "stopped" ? "encerrada" : "finalizada"}: ${counts?.pending || 0} sugestões para confirmar, ${counts?.inconclusive || 0} para revisão manual e ${job.failed} falhas. O resumo ficou salvo em Revisar empresas e nichos.`, {duration: 10000});
        } else toast.info(`Análise finalizada: ${job.completed}/${job.total} consultas concluídas e ${job.failed} falhas. Confira os resultados na etapa 3.`, {duration: 8000});
      }
      observedJobs.current.set(job.id, job.status);
    }
  }, [state.jobs]);
  useEffect(() => {setAnalysisFilters({...defaultResultFilters});}, [state.selectedId, history?.id]);
  useEffect(() => {if (researchNiche !== "all" && !niches.some(n => filterKey(n) === researchNiche)) setResearchNiche("all");}, [researchNiche, niches.join("|")]);
  useEffect(() => {if (!suggestions.length) setReviewDeferred(false);}, [suggestions.length]);
  useEffect(() => {if (reviewSuggestionId && !suggestions.some(s => s.id === reviewSuggestionId)) setReviewSuggestionId("");}, [suggestions, reviewSuggestionId]);
  const exportUrl = (format: string) => `/api/export/${state.selectedId}?${new URLSearchParams({format, ...(history ? {job: history.id} : {}), ...analysisFilters})}`;

  async function startJob(kind: "identify" | "analyze", scope: NicheScope = "pending", refreshSources = false) {
    if (!state.settings.keyConfigured) {setSettingsOpen(true); return;}
    if (kind === "identify") {setAutoReviewPaused(false); setReviewDeferred(false);}
    await perform(async () => {
      const created = await request<{id: string; queries: number}>(`/api/immersions/${state.selectedId}/jobs`, {kind, repetitions: Number(repetitions), queryTemplate: query, ...(kind === "identify" ? {verifyNiche: true, scope, refreshSources} : researchNiche !== "all" ? {niches: scopedNiches} : {})});
      toast.success(kind === "identify" ? `${created.queries} cadastros na fila. Confira e confirme as sugestões para aplicar os nichos.` : `${created.queries} consultas adicionadas à fila.`);
      if (kind === "identify") {setIdentifyHistoryId(created.id); setNicheRunOpen(false); setTab("review");}
      if (kind === "analyze") {setHistoryId(created.id); setTab("analysis");}
      await refresh();
    });
  }
  function jobAction(job: Job, action: string) {void perform(async () => {await request(`/api/jobs/${job.id}`, {action}); await refresh();});}

  // Ferramentas locais opcionais: leitura do mapa e abertura do formulário, sem salvar alterações.
  const currentState = useRef(state); currentState.current = state;
  useEffect(() => {
    const context = (navigator as Navigator & {modelContext?: {registerTool: (tool: unknown) => void; unregisterTool: (name: string) => void}}).modelContext;
    if (!context) return;
    const names = ["read_immersion_mapping", "open_company_review"];
    try {
      context.registerTool({name: names[0], description: "Ler empresas, nichos e contagens da imersão selecionada, sem contatos pessoais.", inputSchema: {type: "object", properties: {}, additionalProperties: false}, execute: async () => ({content: [{type: "text", text: JSON.stringify({immersion: currentState.current.immersions.find(i => i.id === currentState.current.selectedId), companies: currentState.current.companies.map(c => ({id: c.id, name: c.name, niche: c.niche, status: c.status})), jobs: currentState.current.jobs.map(j => ({id: j.id, kind: j.kind, status: j.status, completed: j.completed, total: j.total}))})}]})});
      context.registerTool({name: names[1], description: "Abrir a revisão de uma empresa no painel. Esta ferramenta não salva nem confirma o cadastro.", inputSchema: {type: "object", properties: {companyId: {type: "string"}}, required: ["companyId"], additionalProperties: false}, execute: async ({companyId}: {companyId: string}) => {const company = currentState.current.companies.find(c => c.id === companyId); if (!company) throw new Error("Cadastro não encontrado."); setEdit(company); return {content: [{type: "text", text: "Formulário de revisão aberto."}]};}});
    } catch {return;}
    return () => names.forEach(name => {try {context.unregisterTool(name);} catch {/* Navegador sem suporte completo. */}});
  }, []);

  return <div className="mapa-ia-surface mapa-ia-app">
    <div data-mapa-portals/>
    <header className="topbar"><div className="topbar-inner"><a className="brand" href="#" onClick={e => {e.preventDefault(); setTab("import");}} aria-label="Mapa IA · Imersões"><div className="brand-icon"><MapPin size={23}/></div><div><strong>Mapa <span>IA</span></strong><small>IMERSÕES</small></div></a><div className="topbar-actions"><span className="local-pill"><span/>{user.name}</span><Button className="settings-button" variant="ghost" onClick={() => setSettingsOpen(true)}><SettingsIcon/>{state.settings.keyConfigured ? "Configurações" : "Conectar pesquisas"}</Button><Button className="settings-button" variant="ghost" onClick={() => setAccountOpen(true)}><UserRound/>Minha conta</Button><Button className="settings-button" variant="ghost" onClick={onLogout}><LogOut/>Sair</Button></div></div></header>
    <main className="main-shell">
      <div className="page-heading"><div><div className="eyebrow">PRESENÇA NAS RECOMENDAÇÕES DA IA</div><h1>{immersion?.name || "Seu próximo mapa começa aqui."}</h1><p>{immersion ? <><MapPin size={15}/>{immersion.city}{immersion.region ? `, ${immersion.region}` : ""}<span className="dot">·</span>{immersion.filename}</> : "Transforme a planilha de inscritos em uma análise por nicho e cidade."}</p></div><div className="heading-actions">{!!state.immersions.length && <Choice label="Escolher imersão" value={state.selectedId} onChange={selectImmersion} disabled={busy} options={state.immersions.map(i => ({value: i.id, label: i.name}))}/>}<Button variant="outline" onClick={() => {setTab("import"); fileInput.current?.click();}} disabled={busy}><Plus/>Nova importação</Button></div></div>
      {connectionError && <div className="notice error connection-error"><p><strong>O painel não conseguiu acessar o servidor.</strong><br/>Confira sua conexão com o Workspace. {connectionError}</p><Button variant="outline" onClick={() => void perform(() => refresh())}><RefreshCw/>Tentar novamente</Button></div>}
      {tab !== "review" && suggestions.length > 0 && <div className="notice pending-niches"><Check/><p><strong>{suggestions.length} sugestões de nicho aguardando confirmação.</strong><br/>Confirme na etapa 2 para atualizar os cadastros.</p><Button size="sm" variant="outline" onClick={() => {setTab("review"); setAutoReviewPaused(false); setReviewDeferred(true);}}>Revisar sugestões</Button></div>}
      {loading ? <div className="loading-page"><Loader2 className="spin"/>Carregando seu painel…</div> : <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="workflow-tabs" variant="line"><TabsTrigger value="import"><span className="step-number">1</span><span>Importar planilha</span></TabsTrigger><TabsTrigger value="review" disabled={!immersion}><span className="step-number">2</span><span>Revisar empresas e nichos</span>{ready.length > 0 && <span className="tab-count">{ready.length}</span>}</TabsTrigger><TabsTrigger value="analysis" disabled={!immersion}><span className="step-number">3</span><span>Executar análise</span></TabsTrigger></TabsList>
        <TabsContent value="import">
          <div className="import-layout"><section className="panel import-panel"><div className="section-heading"><span className="icon-box"><FileSpreadsheet/></span><div><h2>Importe a lista de inscritos</h2><p>Comece com a planilha que sua equipe já usa.</p></div></div><div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={e => {e.preventDefault(); if (!busy) setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={e => {e.preventDefault(); setDragging(false); if (!busy) void upload(e.dataTransfer.files[0]);}}><div className="upload-art"><FileSpreadsheet size={37}/><span><Plus size={16}/></span></div><h3>{busy ? "Lendo a planilha…" : "Arraste sua planilha para cá"}</h3><p>ou selecione um arquivo no computador</p><Button onClick={() => fileInput.current?.click()} disabled={busy}>{busy ? <Loader2 className="spin"/> : <FolderOpen/>}Selecionar planilha</Button><small>Excel .xlsx ou CSV · até 10 MB · até 5.000 linhas</small></div><div className="import-foot"><ShieldCheck size={18}/><span>Organize com IA antes de importar ou confira as colunas no modo manual. Os dados ficam salvos no painel.</span></div></section>
            <aside className="panel process-card"><div className="eyebrow">COMO O MAPA É CONSTRUÍDO</div><h2>Uma pergunta por nicho.<br/>Uma visão de cada empresa.</h2><div className="process-item"><span>01</span><div><h3>Organize os cadastros</h3><p>A IA separa participante, empresa e atividade antes da importação. Confira a prévia organizada.</p></div></div><div className="process-item"><span>02</span><div><h3>Confira as identidades</h3><p>A busca sugere só o nicho e, quando disponível, a cidade. Sua equipe aprova os cadastros.</p></div></div><div className="process-item"><span>03</span><div><h3>Meça a presença</h3><p>Consulte as melhores empresas por nicho e cidade e veja quem foi citado.</p></div></div><div className="sample-query"><Search size={17}/><p>“Quais as melhores empresas de<br/><strong>imobiliárias em Maringá?</strong>”</p></div></aside>
          </div>
          {!!state.immersions.length && <section className="panel saved-imports"><div className="section-heading"><History size={19}/><h2>Imersões salvas</h2></div><div className="saved-grid">{state.immersions.map(i => <button key={i.id} onClick={() => selectImmersion(i.id)}><div className="saved-icon"><MapPin size={19}/></div><div><strong>{i.name}</strong><span>{i.city} · {i.participant_count} inscrições · {i.company_count} cadastros</span></div><ChevronRight size={18}/></button>)}</div></section>}
        </TabsContent>
        <TabsContent value="review">
          <div className="metrics"><Metric icon={<Users/>} value={immersion?.participant_count || 0} label="Inscrições preservadas"/><Metric icon={<Building2/>} value={state.companies.length} label="Cadastros de empresas"/><Metric icon={<Check/>} value={ready.length} label="Confirmados para análise" color="green"/><Metric icon={<Globe/>} value={niches.length} label="Nichos confirmados"/></div>
          {active && <JobProgress job={active} busy={busy} action={jobAction} onAudit={() => setAudit({id: active.id, niche: ""})}/>}
          <NicheResults jobs={identifications} job={latestIdentify} busy={busy} active={Boolean(active)} onSelect={setIdentifyHistoryId} onReview={id => setReviewSuggestionId(id)} onBatch={() => {setAutoReviewPaused(true); setBatchJobId(latestIdentify?.id || "");}} onAudit={() => latestIdentify && setAudit({id: latestIdentify.id, niche: ""})} onEdit={id => setEdit(state.companies.find(c => c.id === id) || null)} onRetry={() => latestIdentify && jobAction(latestIdentify, "retry")}/>
          <section className="panel company-panel"><div className="panel-heading"><div><h2>Empresas e nichos</h2><p>Identifique e confira os nichos com IA. Revise as sugestões e confirme para atualizar os cadastros.</p></div><div className="review-controls">{suggestions.length > 0 && <Button variant="outline" onClick={() => {setAutoReviewPaused(false); setReviewDeferred(true);}}>Revisar sugestões ({suggestions.length})</Button>}<Button variant="outline" disabled={busy || Boolean(active) || !identifiedCandidates.length} onClick={() => state.settings.keyConfigured ? setNicheRunOpen(true) : setSettingsOpen(true)}><WandSparkles/>Identificar e conferir nichos</Button></div></div>
            <div className="table-toolbar"><div className="search-input"><Search size={17}/><input aria-label="Buscar cadastros" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar empresa, nicho ou participante"/></div><Choice value={statusFilter} onChange={setStatusFilter} label="Filtrar situação" options={[{value: "all", label: "Todas as situações"}, ...["pending", "review", "ready", "excluded"].map(s => ({value: s, label: labels[s]}))]}/><small className="muted">{visible.length} de {state.companies.length} cadastros</small></div>
            <Table className="company-table"><TableHeader><TableRow><TableHead>Participante(s)</TableHead><TableHead>Empresa / profissional</TableHead><TableHead>Nicho da pesquisa</TableHead><TableHead>Cidade da empresa</TableHead><TableHead>Situação</TableHead><TableHead className="right">Revisão</TableHead></TableRow></TableHeader><TableBody>{visible.map(c => <TableRow key={c.id}><TableCell className="participant-name">{c.participants.slice(0, 2).map(p => <div key={p.id}>{p.name || "Nome não informado"}</div>)}{c.participants.length > 2 && <details><summary>Mais {c.participants.length - 2} participantes</summary>{c.participants.slice(2).map(p => <div key={p.id}>{p.name || "Nome não informado"}</div>)}</details>}</TableCell><TableCell><div className="company-cell"><span className={`company-avatar ${!c.name ? "generic" : ""}`}>{c.name ? c.name.slice(0, 2).toUpperCase() : "?"}</span><div><strong>{c.name || "Empresa não informada"}</strong>{!c.name && <small>Informado: {c.activity || c.original_name}</small>}<small>{c.participants.length} {c.participants.length === 1 ? "inscrição" : "inscrições"}{c.website && <> · <a href={c.website} target="_blank" rel="noreferrer">{host(c.website)}</a></>}</small></div></div></TableCell><TableCell>{c.niche || <span className="missing">Nicho a definir</span>}</TableCell><TableCell>{c.actual_city || <span className="muted">A confirmar</span>}</TableCell><TableCell><Badge status={c.status}/></TableCell><TableCell className="right"><Button size="sm" variant="ghost" onClick={() => setEdit(c)}>Revisar<ChevronRight/></Button></TableCell></TableRow>)}</TableBody></Table>
            {!visible.length && <div className="empty-mini">Nenhum cadastro corresponde ao filtro.</div>}
            <div className="table-footer"><span><CircleHelp size={15}/>Atividades genéricas ficam para revisão. Confira o nicho pelo participante em Revisar.</span><Button onClick={() => setTab("analysis")} disabled={!ready.length}>Ir para a análise<ArrowRight/></Button></div>
          </section>
        </TabsContent>
        <TabsContent value="analysis">
          {active && <JobProgress job={active} busy={busy} action={jobAction} onAudit={() => setAudit({id: active.id, niche: ""})}/>}
          <div className="analysis-layout"><section className="panel query-panel"><div className="section-heading"><span className="icon-box"><Search/></span><div><h2>Análise de presença nas recomendações</h2><p>Usa os nichos confirmados na etapa 2 para medir quais empresas a IA recomenda.</p></div></div><Field label="Pergunta por nicho" hint="Mantenha {nicho} e {cidade}. Use uma pergunta neutra para pesquisar recomendações."><textarea rows={3} value={query} onChange={e => setQuery(e.target.value)} maxLength={1000}/></Field><Field label="Nicho da próxima análise" hint="Escolher um nicho limita os novos pedidos e reduz o consumo."><Choice value={researchNiche} onChange={setResearchNiche} label="Nicho da próxima análise" options={[{value: "all", label: "Todos os nichos confirmados"}, ...niches.map(n => ({value: filterKey(n), label: n}))]}/></Field><div className="row spread"><Field label="Consultas por nicho"><Choice value={repetitions} onChange={setRepetitions} label="Consultas por nicho" options={[1, 2, 3, 4, 5].map(n => ({value: String(n), label: `${n} ${n === 1 ? "consulta" : "consultas"}`}))}/></Field><div className="query-total"><strong>{scopedNiches.length * Number(repetitions)}</strong><span>consultas nesta análise</span></div></div><div className="query-preview"><small>EXEMPLO DA PERGUNTA ENVIADA</small><p>{query.replaceAll("{nicho}", scopedNiches[0] || "[nicho confirmado]").replaceAll("{cidade}", immersion?.city || "[cidade]")}</p></div><Button className="run-button" onClick={() => void startJob("analyze")} disabled={busy || Boolean(active) || !scopedReady.length || !query.includes("{nicho}") || !query.includes("{cidade}")}><Play/>Executar análise</Button><p className="small muted">Cada consulta usa pesquisa na web e uma etapa de extração. O consumo é cobrado pela API OpenAI.</p></section>
            <aside className="panel scope-panel"><div className="eyebrow">ESCOPO DA ANÁLISE</div><h2>{scopedReady.length} empresas<br/><span>em {scopedNiches.length} nichos</span></h2><div className="chips">{scopedNiches.length ? scopedNiches.map(n => <span key={n} className="chip">{n}</span>) : <p className="muted">Confirme empresas e nichos na etapa 2 para começar.</p>}</div><div className="method-note"><ShieldCheck size={18}/><div><strong>Pergunta sem nomes de inscritos</strong><p>A pesquisa recebe apenas o nicho e a cidade. Depois, o painel compara as recomendações com os cadastros confirmados.</p></div></div><div className="method-note"><CircleHelp size={18}/><div><strong>Frequência e ordem da lista</strong><p>Falhas ficam fora da frequência. Uma posição só aparece quando a resposta contém uma lista numerada.</p></div></div></aside>
          </div>
          <section className="panel results-panel"><div className="panel-heading"><div><h2>Resultados da presença</h2><p>{history ? `${history.completed} consultas válidas de ${history.total} planejadas · Pesquisa: ${history.model} · Extração inicial: ${history.extraction_model}` : "Execute a primeira análise para descobrir as menções."}</p></div><Button variant="outline" asChild><DownloadLink path={exportUrl("xlsx")}><Download/>Exportar Excel</DownloadLink></Button></div>
            {history ? <><div className="table-toolbar"><div className="history-select"><History size={17}/><Choice value={history.id} onChange={setHistoryId} label="Histórico de análises" options={analyses.map(j => ({value: j.id, label: `${timeLabel(j.created_at)} · ${labels[j.status]}`}))}/></div><Badge status={history.status}/>{history.failed > 0 && ["partial", "completed", "stopped"].includes(history.status) && <Button size="sm" variant="outline" disabled={busy || Boolean(active)} onClick={() => jobAction(history, "retry")}><RefreshCw/>Repetir {history.failed} falhas</Button>}<Button size="sm" variant="ghost" onClick={() => setAudit({id: history.id, niche: ""})}>Todas as respostas<ChevronRight/></Button></div>
              <div className="analysis-filters"><div className="search-input"><Search size={17}/><input aria-label="Buscar resultados" value={analysisFilters.q} onChange={e => setAnalysisFilters({...analysisFilters, q: e.target.value})} placeholder="Buscar empresa, participante ou nicho" maxLength={300}/></div>
                <Choice value={analysisFilters.niche} onChange={niche => setAnalysisFilters({...analysisFilters, niche})} label="Filtrar resultados por nicho" options={[{value: "all", label: "Todos os nichos"}, ...resultNiches.map(([value, label]) => ({value, label}))]}/>
                <Choice value={analysisFilters.presence} onChange={presence => setAnalysisFilters({...analysisFilters, presence})} label="Filtrar presença" options={[{value: "all", label: "Todas as presenças"}, {value: "mentioned", label: "Com menção"}, {value: "absent", label: "Sem menção"}, {value: "uncertain", label: "Menção a conferir"}, {value: "pending", label: "Sem consulta válida"}]}/>
                <Choice value={analysisFilters.city} onChange={city => setAnalysisFilters({...analysisFilters, city})} label="Filtrar cidade da empresa" options={[{value: "all", label: "Todas as cidades da empresa"}, ...resultCities.map(([value, label]) => ({value, label})), ...(results.some(r => !r.actual_city) ? [{value: "__missing__", label: "Cidade não informada"}] : [])]}/>
                <Choice value={analysisFilters.order} onChange={order => setAnalysisFilters({...analysisFilters, order})} label="Ordenar resultados" options={[{value: "original", label: "Ordem do cadastro"}, {value: "frequency_desc", label: "Maior frequência"}, {value: "frequency_asc", label: "Menor frequência"}, {value: "position", label: "Melhor ordem na lista"}, {value: "name", label: "Nome A–Z"}]}/>
                <div className="filter-count"><small>{visibleResults.length} de {results.length} empresas</small>{filteredResults && <Button size="sm" variant="ghost" onClick={() => setAnalysisFilters({...defaultResultFilters})}>Limpar filtros</Button>}</div>
              </div>
              <Table className="results-table"><TableHeader><TableRow><TableHead>Empresa / nicho</TableHead><TableHead>Presença</TableHead><TableHead>Frequência</TableHead><TableHead>Melhor ordem na lista</TableHead><TableHead className="right">Evidências</TableHead></TableRow></TableHeader><TableBody>{visibleResults.map(r => <TableRow key={r.id}><TableCell><strong>{r.name}</strong><small className="cell-subtitle">{r.niche}</small>{r.competitors.length > 0 && <details className="competitors"><summary>Concorrentes mencionados</summary><ul>{r.competitors.map(c => <li key={c.name}>{c.name}<span>{c.count} {c.count === 1 ? "consulta" : "consultas"}</span></li>)}</ul></details>}</TableCell><TableCell><Badge status={r.status}>{r.validQueries ? undefined : "Sem consulta válida"}</Badge></TableCell><TableCell><div className="frequency"><strong>{r.appearances}<span>/{r.validQueries}</span></strong><small>consultas válidas</small>{r.uncertain > 0 && <em>{r.uncertain} {r.uncertain === 1 ? "menção a revisar" : "menções a revisar"}</em>}</div></TableCell><TableCell>{r.bestPosition != null ? <><strong className="position">{r.bestPosition}ª</strong><small className="cell-subtitle">Ordem de apresentação</small></> : <span className="muted">Sem classificação numérica</span>}</TableCell><TableCell className="right"><Button variant="ghost" size="sm" onClick={() => setAudit({id: history.id, niche: r.niche})}>Ver respostas<ChevronRight/></Button></TableCell></TableRow>)}</TableBody></Table>
              {!visibleResults.length && <div className="empty-mini">Nenhum resultado corresponde aos filtros.{filteredResults && <Button size="sm" variant="ghost" onClick={() => setAnalysisFilters({...defaultResultFilters})}>Limpar filtros</Button>}</div>}
              <div className="table-footer"><span><CircleHelp size={15}/>A exportação dos resultados acompanha os filtros. Resultados variam entre consultas. A ordem da lista não é um ranking fixo.</span><div className="export-links"><DownloadLink path={exportUrl("csv")}>CSV</DownloadLink><DownloadLink path={exportUrl("json")}>Respostas em JSON</DownloadLink></div></div>
            </> : <div className="results-empty"><div className="empty-illustration"><Search size={26}/><span className="illustration-line"/><span className="illustration-line short"/></div><h3>O mapa de menções vai aparecer aqui</h3><p>Confirme os cadastros, configure a pergunta e execute a análise.</p><Button variant="ghost" onClick={() => setTab("review")}>Revisar empresas<ArrowRight/></Button></div>}
          </section>
        </TabsContent>
      </Tabs>}
      <footer className="page-footer"><span>Mapa IA · Imersões <small>v{state.version}</small></span><p>Pesquisa via API OpenAI · Pode diferir do aplicativo ChatGPT</p><span><ShieldCheck size={14}/>Histórico da sua conta</span></footer>
    </main>
    <input ref={fileInput} className="sr-only" type="file" accept=".xlsx,.csv" aria-label="Selecionar planilha" onChange={e => void upload(e.target.files?.[0])}/>
    <ImportDialog staged={staged} keyConfigured={state.settings.keyConfigured} onConfigure={() => setSettingsOpen(true)} onClose={() => setStaged(null)} onImported={async id => {selectedId.current = id; setStaged(null); setHistoryId(""); setTab("review"); await refresh(id);}}/>
    <CompanyDialog company={edit} niches={allNiches} immersionId={state.selectedId} keyConfigured={state.settings.keyConfigured} active={Boolean(active)} onClose={() => setEdit(null)} onSaved={() => refresh()}/>
    <SettingsDialog open={settingsOpen} settings={state.settings} active={Boolean(active)} onClose={() => setSettingsOpen(false)} onSaved={() => refresh()}/>
    <AuditDialog immersionId={state.selectedId} job={auditJob} niche={audit?.niche || ""} onClose={() => setAudit(null)}/>
    <NicheRunDialog open={nicheRunOpen} companies={state.companies} busy={busy} onClose={() => setNicheRunOpen(false)} onStart={(scope, refreshSources) => startJob("identify", scope, refreshSources)}/>
    <NicheBatchDialog job={state.jobs.find(j => j.id === batchJobId) || null} suggestions={suggestions} onClose={() => setBatchJobId("")} onSaved={() => refresh()}/>
    <NicheConfirmDialog suggestion={nicheSuggestion} company={state.companies.find(c => c.id === nicheSuggestion?.companyId)} remaining={suggestions.length} onResolved={async () => {await refresh(); setReviewSuggestionId("");}} onDeferred={() => {setAutoReviewPaused(true); setReviewDeferred(false); setReviewSuggestionId("");}}/>
    <AccountDialog user={user} open={accountOpen} onClose={() => setAccountOpen(false)}/>
    <Toaster position="bottom-right" richColors closeButton theme="light"/>
  </div>;
}

function Metric({icon, value, label, color = "blue"}: {icon: React.ReactNode; value: number; label: string; color?: string}) {return <div className="metric"><div className={`metric-icon ${color}`}>{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>;}
function JobProgress({job, busy, action, onAudit}: {job: Job; busy: boolean; action: (job: Job, action: string) => void; onAudit: () => void}) {
  const ended = job.completed + job.failed;
  const percent = job.total ? Math.round(ended / job.total * 100) : 0;
  return <section className="job-progress"><div className="job-label"><span className="job-icon">{job.status === "paused" ? <Pause/> : <Loader2 className="spin"/>}</span><div><strong>{job.kind === "identify" ? "Identificando nichos" : "Consultando recomendações"}</strong><span>{job.completed} concluídas · {job.failed} falhas · {job.total - ended} pendentes</span></div></div><div className="progress-track"><div><Badge status={job.status}/><small>{percent}%</small></div><Progress value={percent}/></div><div className="job-actions">{job.status === "paused" && job.failed > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => action(job, "retry")}><RefreshCw/>Repetir falhas</Button>}<Button size="sm" variant="ghost" onClick={onAudit}>Respostas</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => action(job, job.status === "paused" ? "resume" : "pause")}>{job.status === "paused" ? <Play/> : <Pause/>}{job.status === "paused" ? "Continuar" : "Pausar"}</Button><Button size="icon-sm" variant="ghost" disabled={busy} title="Encerrar consultas pendentes" aria-label="Encerrar consultas pendentes" onClick={() => action(job, "stop")}><Square/></Button></div>{!!job.waiting && <p className="job-note"><strong>{job.waiting} consultas aguardando espaço na API. A fila continua automaticamente.</strong></p>}{job.pause_reason && <p className="job-note"><strong>{job.pause_reason}</strong></p>}{!!job.failureSummary?.length && <p className="job-note">{job.failureSummary.map(f => `${f.count} × ${f.label}`).join(" · ")}</p>}<p className="job-note">A fila continua no servidor, mesmo com o navegador fechado. Pausar impede novas etapas; solicitações já enviadas à API podem terminar e consumir saldo.</p></section>;
}
