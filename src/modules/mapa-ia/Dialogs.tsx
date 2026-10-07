import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, KeyRound, Loader2, Save, Search, ShieldCheck, WandSparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Answer, Badge, Choice, DownloadLink, Field, request, Sources, timeLabel } from "./helpers";
import type { Company, Detail, Job, Settings, Staged, Preparation, NicheSuggestion } from "./types";

function errorText(error: unknown) {return error instanceof Error ? error.message : "Não foi possível concluir.";}

export function ImportDialog({staged, keyConfigured, onConfigure, onClose, onImported}: {staged: Staged | null; keyConfigured: boolean; onConfigure: () => void; onClose: () => void; onImported: (id: string) => Promise<void>}) {
  const [sheetName, setSheetName] = useState("");
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [header, setHeader] = useState(false);
  const [city, setCity] = useState("Londrina");
  const [region, setRegion] = useState("Paraná");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState(false);
  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [previewFilter, setPreviewFilter] = useState("");
  const [pollError, setPollError] = useState("");
  const currentUpload = useRef("");
  const preparing = Boolean(preparation && ["queued", "running"].includes(preparation.status));
  const complete = preparation?.status === "completed";
  function reset() {setPreparation(null); setManual(false); setPreviewFilter(""); setPollError("");}
  function chooseSheet(value: string) {
    if (preparing || saving) return;
    const sheet = staged?.sheets.find(s => s.name === value);
    if (sheet) {setSheetName(value); setMapping(sheet.mapping); setHeader(sheet.hasHeader); reset();}
  }
  useEffect(() => {
    currentUpload.current = staged?.uploadId || "";
    if (staged?.sheets[0]) {const sheet = staged.sheets[0]; setSheetName(sheet.name); setMapping(sheet.mapping); setHeader(sheet.hasHeader); setName(""); setDate(""); reset();}
  }, [staged]);
  useEffect(() => {
    if (!preparation || !preparing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const id = preparation.id;
    async function poll() {
      try {const next = await request<Preparation>(`/api/preparations/${id}`); if (!cancelled) {setPreparation(next); setPollError("");}}
      catch (e) {if (!cancelled) setPollError(errorText(e));}
      if (!cancelled) timer = setTimeout(() => void poll(), 1500);
    }
    timer = setTimeout(() => void poll(), 800);
    return () => {cancelled = true; clearTimeout(timer);};
  }, [preparation?.id, preparing]);
  const sheet = staged?.sheets.find(s => s.name === sheetName);
  const columns = [{value: "-1", label: "Não usar"}, ...Array.from({length: sheet?.columns || 0}, (_, i) => ({value: String(i), label: `Coluna ${String.fromCharCode(65 + i)}${header ? ` · ${(sheet?.preview[0]?.[i] || "").slice(0, 35)}` : ""}`}))];
  const params = {uploadId: staged?.uploadId, sheet: sheetName, mapping, hasHeader: header};
  async function organize(retry = false) {
    if (!staged) return;
    const uploadId = staged.uploadId;
    setSaving(true); setManual(false);
    try {
      const result = retry && preparation ? await request<Preparation>(`/api/preparations/${preparation.id}`, {action: "retry"}) : await request<Preparation>("/api/uploads/organize", params);
      if (currentUpload.current === uploadId) setPreparation(result);
    } catch (e) {toast.error(errorText(e));} finally {setSaving(false);}
  }
  async function close() {
    if (saving) return;
    if (preparing && preparation) {
      setSaving(true);
      try {await request(`/api/preparations/${preparation.id}`, {action: "stop"});}
      catch (e) {toast.error(errorText(e)); setSaving(false); return;}
      setSaving(false);
    }
    onClose();
  }
  async function submit() {
    if (!staged || (!manual && !complete)) return;
    setSaving(true);
    try {
      const result = await request<{id: string; participants: number; companies: number}>("/api/immersions/import", {...params, preparationId: !manual ? preparation?.id : undefined, city, region, name, date});
      toast.success(`${result.participants} inscrições importadas em ${result.companies} cadastros.`);
      await onImported(result.id);
    } catch (e) {toast.error(errorText(e));} finally {setSaving(false);}
  }
  const rows = preparation?.rows.filter(r => `${r.person} ${r.company} ${r.activity} ${r.niche}`.toLocaleLowerCase().includes(previewFilter.toLocaleLowerCase())) || [];
  return <Dialog open={Boolean(staged)} onOpenChange={open => !open && void close()}><DialogContent className="modal modal-import"><DialogHeader><DialogTitle>{complete && !manual ? "Confira os dados organizados" : "Organizar a planilha antes de importar"}</DialogTitle><DialogDescription>{staged?.filename} · Participante, empresa e atividade ficam em campos separados.</DialogDescription></DialogHeader>
    <div className="form-grid"><Field label="Cidade da imersão"><input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex.: Maringá" maxLength={100}/></Field><Field label="Estado"><input value={region} onChange={e => setRegion(e.target.value)} placeholder="Ex.: Paraná"/></Field><Field label="Nome da imersão (opcional)"><input value={name} onChange={e => setName(e.target.value)} placeholder={`Imersão em ${city || "…"}`} maxLength={200}/></Field><Field label="Data (opcional)"><input type="date" value={date} onChange={e => setDate(e.target.value)}/></Field></div>
    <fieldset className="import-options" disabled={preparing || saving}><div className="row spread"><Field label="Aba da planilha"><Choice value={sheetName} onChange={chooseSheet} options={(staged?.sheets || []).map(s => ({value: s.name, label: `${s.name} · ${s.rows} linhas`}))} label="Aba"/></Field><label className="check-label"><Checkbox disabled={preparing || saving} checked={header} onCheckedChange={v => {setHeader(v === true); reset();}}/>A primeira linha é um cabeçalho</label></div>
    <details className="mapping-options"><summary>Conferir ou ajustar as colunas</summary><div className="column-grid">{[["company", "Empresa / atividade"], ["person", "Participante"], ["phone", "Telefone"], ["email", "E-mail"], ["niche", "Nicho (opcional)"], ["website", "Site (opcional)"], ["actual_city", "Cidade da empresa (opcional)"]].map(([key, label]) => <Field key={key} label={label}><Choice disabled={preparing || saving} value={String(mapping[key] ?? -1)} onChange={v => {setMapping({...mapping, [key]: Number(v)}); reset();}} options={columns} label={label}/></Field>)}</div></details></fieldset>
    {preparing ? <div className="notice"><Loader2 className="spin"/><p><strong>Organizando com IA · lote {Math.min((preparation?.completedBatches || 0)+1, preparation?.totalBatches || 1)} de {preparation?.totalBatches}</strong><br/>{preparation?.error || "Separando os campos, sem pesquisa na web."}<br/><small>Fechar esta janela interrompe os próximos lotes. Chamadas já enviadas podem consumir saldo.</small></p></div> : complete && !manual ? <>
      <div className="notice"><Check/><p><strong>{preparation.reused ? "Organização reaproveitada · " : ""}{preparation.rows.length} linhas organizadas</strong> · {preparation.rows.filter(r => r.needsReview).length} precisam de conferência. Os nomes abaixo vêm das células originais. Nichos ainda precisam ser revisados.</p></div>
      <input className="preview-search" aria-label="Buscar na prévia" placeholder="Buscar participante, empresa ou atividade…" value={previewFilter} onChange={e => setPreviewFilter(e.target.value)}/>
      <div className="preview-table organized-preview"><Table><TableHeader><TableRow><TableHead>Linha</TableHead><TableHead>Participante</TableHead><TableHead>Empresa / profissional</TableHead><TableHead>Atividade informada</TableHead><TableHead>Nicho sugerido</TableHead></TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.line}><TableCell>{r.line}{r.needsReview && <small className="cell-subtitle missing">Conferir</small>}</TableCell><TableCell className="participant-name">{r.person || "Nome não informado"}</TableCell><TableCell>{r.company || "Empresa não informada"}</TableCell><TableCell>{r.activity || "—"}</TableCell><TableCell>{r.niche || "A verificar"}</TableCell></TableRow>)}</TableBody></Table></div>
    </> : <>
      <div className="preview-table"><Table><TableHeader><TableRow><TableHead>Participante · prévia local</TableHead><TableHead>Empresa / atividade · prévia local</TableHead></TableRow></TableHeader><TableBody>{sheet?.preview.slice(header ? 1 : 0, header ? 5 : 4).map((r, i) => <TableRow key={i}><TableCell>{r[mapping.person] || "—"}</TableCell><TableCell>{r[mapping.company] || "—"}</TableCell></TableRow>)}</TableBody></Table></div>
      <p className="small muted">{manual ? "Modo manual: confira as colunas antes de importar." : "A IA organiza até 25 linhas por lote, sem busca na web. Telefones e e-mails ficam no Workspace. A revisão dos nichos acontece depois."}</p>
    </>}
    {preparation?.status === "failed" && !manual && <div className="notice error"><p>{preparation.error}<br/>Os lotes concluídos foram preservados. Repetir pode criar uma nova chamada paga.</p></div>}
    {pollError && <div className="notice error">{pollError} O andamento fica salvo; não é necessário reenviar o arquivo.</div>}
    <DialogFooter className="import-actions"><Button variant="outline" onClick={() => void close()} disabled={saving}>{preparing ? "Interromper e fechar" : "Cancelar"}</Button>
      {!preparing && !saving && !manual && !complete && <Button variant="ghost" onClick={() => setManual(true)}>Importar sem IA</Button>}
      {complete || manual ? <Button onClick={submit} disabled={saving || !city.trim() || (manual && (mapping.company ?? -1) < 0)}>{saving ? <Loader2 className="spin"/> : <Check/>}Importar cadastros</Button> : !preparing && (keyConfigured ? <Button onClick={() => void organize(preparation?.status === "failed" || preparation?.status === "stopped")} disabled={saving}>{saving ? <Loader2 className="spin"/> : <WandSparkles/>}{preparation?.status === "failed" ? "Repetir lote pendente" : "Organizar com IA"}</Button> : <Button onClick={onConfigure}><KeyRound/>Conectar OpenAI</Button>)}
    </DialogFooter>
  </DialogContent></Dialog>;
}

export function CompanyDialog({company, niches, immersionId, keyConfigured, active, onClose, onSaved}: {company: Company | null; niches: string[]; immersionId: string; keyConfigured: boolean; active: boolean; onClose: () => void; onSaved: () => Promise<void>}) {
  const [form, setForm] = useState({name: "", niche: "", website: "", actual_city: "", aliases: "", notes: ""});
  const [saving, setSaving] = useState(false);
  useEffect(() => {if (company) setForm({name: company.name, niche: company.niche, website: company.website, actual_city: company.actual_city, aliases: company.aliases.join(", "), notes: company.notes});}, [company]);
  function input(key: keyof typeof form) {return {value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({...form, [key]: e.target.value})};}
  async function save(status: string) {
    if (!company) return;
    setSaving(true);
    try {await request(`/api/companies/${company.id}`, {...form, aliases: form.aliases.split(",").map(s => s.trim()).filter(Boolean), status}); await onSaved(); toast.success(status === "ready" ? "Cadastro confirmado para a análise." : "Cadastro salvo."); onClose();} catch (e) {toast.error(errorText(e));} finally {setSaving(false);}
  }
  async function verify() {
    if (!company) return;
    setSaving(true);
    try {
      await request(`/api/companies/${company.id}`, {...form, aliases: form.aliases.split(",").map(s => s.trim()).filter(Boolean), status: company.status === "ready" && form.name.trim() && form.niche.trim() ? "ready" : "review"});
      await request(`/api/immersions/${immersionId}/jobs`, {kind: "identify", companyIds: [company.id], verifyNiche: true, scope: "all"});
      await onSaved(); toast.success("Conferência iniciada. Confirme a sugestão para aplicar o resultado ao cadastro."); onClose();
    } catch (e) {toast.error(errorText(e)); await onSaved();} finally {setSaving(false);}
  }
  return <Dialog open={Boolean(company)} onOpenChange={open => !open && !saving && onClose()}><DialogContent className="modal modal-company"><DialogHeader><DialogTitle>Revisar empresa e nicho</DialogTitle><DialogDescription>Informado na planilha: {company?.original_name}. Confirme a identidade antes de pesquisar a presença.</DialogDescription></DialogHeader>
    <div className="form-grid"><Field label="Nome comercial *"><input {...input("name")} placeholder="Empresa ou nome do profissional" maxLength={250}/></Field><Field label="Nicho da pesquisa *" hint="Use uma expressão natural, como “clínicas de oftalmologia”."><input {...input("niche")} list="niches" placeholder="Ex.: imobiliárias" maxLength={200}/><datalist id="niches">{niches.map(n => <option key={n} value={n}/>)}</datalist></Field><Field label="Site oficial"><input {...input("website")} type="url" placeholder="https://empresa.com.br"/></Field><Field label="Cidade real da empresa"><input {...input("actual_city")} placeholder="Ex.: Londrina"/></Field></div>
    {!form.name.trim() && company?.participants.length === 1 && company.participants[0].name && <Button variant="outline" size="sm" onClick={() => setForm({...form, name: company.participants[0].name})}>Usar nome do participante como profissional</Button>}
    <div className="notice"><Search/><p><Button variant="outline" size="sm" disabled={saving || active || !keyConfigured || (!form.name.trim() && !(company?.participants.length === 1 && company.participants[0].name))} onClick={() => void verify()}>Conferir nicho com IA</Button><br/><small>Consulta curta: somente nicho e cidade opcional. {active ? "Conclua ou encerre a fila atual antes de conferir." : !keyConfigured ? "Conecte a OpenAI em Configurações." : "Sem empresa informada, usa o nome do participante e a atividade como referência. Dúvidas ficam para revisão."}</small></p></div>
    <Field label="Outros nomes da mesma empresa" hint="Separe por vírgulas. Inclua apenas nomes que você confirmou."><input {...input("aliases")} placeholder="Nome fantasia, razão social"/></Field><Field label="Observações"><textarea {...input("notes")} rows={3}/></Field>
    {!!company?.sources.length && <details><summary>Fontes da identificação ({company.sources.length})</summary><Sources sources={company.sources}/></details>}
    <details open><summary>Participantes vinculados ({company?.participants.length || 0})</summary><div className="participants">{company?.participants.map(p => <div key={p.id}><strong>{p.name || "Sem nome"}</strong><span>{[p.phone, p.email].filter(Boolean).join(" · ")}</span><small>Linha {p.source_row} da planilha</small></div>)}</div></details>
    <DialogFooter className="company-actions"><Button variant="ghost" disabled={saving} onClick={() => save("excluded")}>Fora da análise</Button><Button variant="outline" disabled={saving} onClick={() => save("review")}><Save/>Salvar para revisar</Button><Button disabled={saving || !form.name.trim() || !form.niche.trim()} onClick={() => save("ready")}>{saving ? <Loader2 className="spin"/> : <Check/>}Confirmar cadastro</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export function NicheConfirmDialog({suggestion, company, remaining, onResolved, onDeferred}: {suggestion: NicheSuggestion | null; company?: Company; remaining: number; onResolved: () => Promise<void>; onDeferred: () => void}) {
  const [niche, setNiche] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {if (suggestion) {setNiche(suggestion.niche); setName(suggestion.name);}}, [suggestion?.id]);
  async function resolve(action: "accept" | "defer") {
    if (!suggestion || saving) return;
    setSaving(true);
    try {
      const result = await request<{status: string; companyStatus: string}>(`/api/niche-suggestions/${suggestion.id}`, {action, niche, name});
      if (result.status === "deferred") {onDeferred(); toast.info("Sugestão guardada para revisar depois.");}
      else toast.success(result.companyStatus === "ready" ? "Nicho cadastrado. Empresa confirmada para a análise." : "Nicho cadastrado. Informe o nome da empresa ou profissional para incluir na análise.");
      await onResolved();
    } catch (e) {toast.error(errorText(e)); await onResolved().catch(() => {});} finally {setSaving(false);}
  }
  const person = company?.participants.length === 1 ? company.participants[0].name : "";
  return <Dialog open={Boolean(suggestion)} onOpenChange={open => !open && !saving && void resolve("defer")}><DialogContent className="modal modal-niche"><DialogHeader><DialogTitle>{suggestion?.origin === "local" ? "Confirmar nicho preenchido" : "Nicho identificado pela IA"}</DialogTitle><DialogDescription>{company?.name || "Empresa não informada"} · {remaining} {remaining === 1 ? "sugestão aguardando confirmação" : "sugestões aguardando confirmação"}</DialogDescription></DialogHeader>
    <div className="niche-participants">{company?.participants.map(p => <div key={p.id}><strong>{p.name || "Nome não informado"}</strong><small>Participante · linha {p.source_row}</small></div>)}{company?.activity && <p className="small muted">Atividade informada: {company.activity}</p>}</div>
    <div className="niche-comparison"><div><small>Nicho atual</small><strong>{suggestion?.currentNiche || "Sem nicho cadastrado"}</strong></div><div><small>Proposta para confirmar</small><strong>{suggestion?.niche}</strong></div></div>
    <Field label="Nicho da pesquisa" hint="Confira a sugestão. Você pode ajustar o texto antes de cadastrar."><input aria-label="Nicho da pesquisa" value={niche} onChange={e => setNiche(e.target.value)} disabled={saving} maxLength={200}/></Field>
    {suggestion?.reason && <p className="small muted">{suggestion.reason}</p>}{suggestion?.city && <p className="small">Cidade encontrada: <strong>{suggestion.city}</strong></p>}
    <Field label="Empresa / profissional" hint={!suggestion?.name ? "O nicho pode ser salvo agora. Para entrar na análise, o cadastro precisa de um nome confirmado." : "Ao dar OK, este cadastro fica confirmado para a análise."}><input aria-label="Empresa / profissional" value={name} onChange={e => setName(e.target.value)} disabled={saving} placeholder="Empresa ou nome do profissional" maxLength={250}/></Field>
    {!name.trim() && person && <Button variant="outline" size="sm" disabled={saving} onClick={() => setName(person)}>Usar participante como profissional</Button>}
    {!!suggestion?.sources.length && <details><summary>Fontes da sugestão ({suggestion.sources.length})</summary><Sources sources={suggestion.sources}/></details>}
    <p className="small muted">{suggestion?.origin === "cache" ? "Resultado reaproveitado de pesquisa anterior. " : suggestion?.origin === "local" ? "Nicho da planilha ou do preenchimento anterior; sem consulta à IA. " : ""}Ao confirmar, o nicho será aplicado ao cadastro e aparecerá no resumo. Revisar depois mantém o cadastro atual.</p>
    <DialogFooter><Button variant="outline" disabled={saving} onClick={() => void resolve("defer")}>Revisar depois</Button><Button disabled={saving || !niche.trim()} onClick={() => void resolve("accept")}>{saving ? <Loader2 className="spin"/> : <Check/>}OK, cadastrar nicho</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export function SettingsDialog({open, settings, active, onClose, onSaved}: {open: boolean; settings: Settings; active: boolean; onClose: () => void; onSaved: () => Promise<void>}) {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(settings.model);
  const [extractionModel, setExtractionModel] = useState(settings.extractionModel);
  const [test, setTest] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {if (open) {setKey(""); setModel(settings.model); setExtractionModel(settings.extractionModel);}}, [open, settings.model, settings.extractionModel]);
  async function save(clearKey = false) {
    setSaving(true);
    try {await request("/api/settings", {apiKey: key, model, extractionModel, testConnection: !clearKey && test, clearKey}); await onSaved(); setKey(""); toast.success(clearKey ? "Chave removida deste painel." : test ? "Configuração salva e acesso aos modelos verificado." : "Configuração salva."); if (!clearKey) onClose();} catch (e) {toast.error(errorText(e));} finally {setSaving(false);}
  }
  return <Dialog open={open} onOpenChange={value => !value && !saving && onClose()}><DialogContent className="modal modal-settings"><DialogHeader><div className="modal-symbol"><KeyRound/></div><DialogTitle>Conectar as pesquisas</DialogTitle><DialogDescription>Use sua chave da API OpenAI para identificar empresas e consultar recomendações com busca na web.</DialogDescription></DialogHeader>
    <div className="notice"><ShieldCheck/><p>Importação e histórico ficam salvos na sua conta do Workspace. A organização envia nomes de participantes e dados de empresa/atividade à OpenAI. As pesquisas usam nomes de empresas ou profissionais, nichos e cidades. Telefones e e-mails dos inscritos ficam fora das consultas.</p></div>
    <Field label="Chave da API OpenAI" hint={settings.keyConfigured ? `Chave configurada: ${settings.keyHint}. Deixe em branco para mantê-la.` : "A chave é salva nas configurações desta conta. Use uma chave da API OpenAI."}><input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-…" autoComplete="off" spellCheck={false}/></Field>
    <a className="text-link row" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Criar ou consultar minha chave <ExternalLink size={14}/></a>
    <div className="notice"><p><strong>Identificação econômica: {settings.identificationModel}</strong><br/>Pesquisa somente nicho e cidade opcional, inclusive para conferir nichos preenchidos. Pesquisas anteriores compatíveis podem ser reaproveitadas. Você escolhe o alcance e confirma as alterações na etapa 2.</p></div>
    <Field label="Modelo das recomendações" hint="Recomendado: gpt-6.1-sol. Precisa aceitar busca na web e segundo plano."><input value={model} onChange={e => setModel(e.target.value)} spellCheck={false} placeholder="gpt-6.1-sol"/></Field>
    <Field label="Modelo da extração" hint="Recomendado: gpt-6-luna. Organiza a resposta da pesquisa em dados estruturados."><input value={extractionModel} onChange={e => setExtractionModel(e.target.value)} spellCheck={false} placeholder="gpt-6-luna"/></Field>
    <Button variant="outline" onClick={() => {setModel("gpt-6.1-sol"); setExtractionModel("gpt-6-luna");}}>Usar modelos recomendados</Button>
    <label className="check-label"><Checkbox checked={test} onCheckedChange={v => setTest(v === true)}/>Verificar acesso à chave e aos modelos ao salvar</label>
    <p className="small muted">A API possui cobrança separada da assinatura do ChatGPT. As respostas podem variar e diferir das obtidas no aplicativo. A verificação de acesso não executa uma pesquisa.</p>
    {settings.fromEnvironment && <p className="small">A chave foi configurada pela administração do Workspace. Para removê-la, altere a configuração no servidor.</p>}
    <DialogFooter><Button variant="ghost" disabled={saving || active || !settings.keyConfigured || settings.fromEnvironment} onClick={() => save(true)}>Remover chave</Button><Button onClick={() => save()} disabled={saving || (!key && !settings.keyConfigured)}>{saving ? <Loader2 className="spin"/> : <Check/>}Salvar conexão</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export function AuditDialog({job, niche, immersionId, onClose}: {job: Job | null; niche: string; immersionId: string; onClose: () => void}) {
  const tasks = job?.tasks.filter(t => !niche || t.niche === niche) || [];
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {setSelected(tasks[0]?.id || ""); setDetail(null);}, [job?.id, niche]);
  const selectedStatus = tasks.find(t => t.id === selected)?.status;
  useEffect(() => {
    let cancelled = false;
    if (!selected) return;
    setLoading(true); setError("");
    request<Detail>(`/api/tasks/${selected}`).then(d => {if (!cancelled) setDetail(d);}).catch(e => {if (!cancelled) setError(errorText(e));}).finally(() => {if (!cancelled) setLoading(false);});
    return () => {cancelled = true;};
  }, [selected, selectedStatus]);
  return <Dialog open={Boolean(job)} onOpenChange={value => !value && onClose()}><DialogContent className="modal modal-audit"><DialogHeader><DialogTitle>Respostas e fontes</DialogTitle><DialogDescription>{niche || (job?.kind === "identify" ? "Identificação das empresas" : "Todas as consultas")} · {job && timeLabel(job.created_at)} · Modelo inicial: {job?.model}{job?.kind === "analyze" && <> · Extração inicial: {job.extraction_model}</>}</DialogDescription></DialogHeader>
    <div className="audit-grid"><nav className="task-list" aria-label="Consultas">{tasks.map((t, i) => <button className={selected === t.id ? "selected" : ""} key={t.id} onClick={() => setSelected(t.id)}><span>{t.niche || t.company_name || `Identificação ${i + 1}`}</span><small>{t.niche ? `Consulta ${t.iteration} · ` : ""}{labelsFor(t.status)}</small></button>)}</nav><div className="task-detail">
      {loading ? <div className="loading-inline"><Loader2 className="spin"/>Carregando resposta…</div> : error ? <div className="notice error">{error}</div> : detail ? <>
        <div className="row spread"><Badge status={detail.status}/><small className="muted">{timeLabel(detail.updated_at)}</small></div><p className="small muted">Modelo da pesquisa: {detail.searchModel} · Extração: {detail.extractionModel}</p><div className="question"><Search size={16}/><span>{detail.prompt}</span></div>
        {detail.error && <div className={`notice ${detail.status === "failed" ? "error" : ""}`}><p>{detail.error}</p></div>}
        {detail.result.niche && <div className="extracted"><strong>Nicho: {detail.result.niche}</strong>{detail.result.city && <p>Cidade: {detail.result.city}</p>}{detail.result.reason && <p className="small">{detail.result.reason}</p>}</div>}
        {detail.status === "failed" && detail.raw.text && <p className="small muted">Resposta preservada para conferência. Esta consulta não entra na frequência.</p>}
        {!!detail.diagnostics?.length && <details><summary>Diagnóstico da API e das tentativas</summary><p className="small">Extração: {detail.extractionModel}</p>{detail.diagnostics.map((d, i) => <div className="question" key={i}><div><strong>{d.stage === "search" ? "Pesquisa" : "Extração"} · {d.event} · {d.model}</strong><p className="small">{d.at} {d.status} {d.code} {d.incompleteReason}</p>{d.message && <p>{d.message}</p>}{d.retryAt && <p className="small">Nova tentativa: {timeLabel(d.retryAt)} · tentativa {d.retryNumber}/2 · espera {d.delaySeconds}s</p>}{d.budget != null && <p className="small">Limite: {d.budget} tokens · Raciocínio: {d.effort}</p>}{d.responseId && <p className="small">Resposta: {d.responseId}</p>}{Boolean(d.usage) && <pre className="small" style={{whiteSpace: "pre-wrap"}}>{JSON.stringify(d.usage, null, 2)}</pre>}{d.partialText && <details><summary>Texto parcial</summary><p>{d.partialText}</p></details>}</div></div>)}</details>}
        {detail.error && !detail.diagnostics?.length && <p className="small muted">A versão anterior não registrava o motivo detalhado. Ao repetir a falha, o novo diagnóstico será salvo.</p>}
        {detail.raw.text ? <Answer raw={detail.raw}/> : <div className="empty-mini">A resposta completa ainda não está disponível. A consulta está {labelsFor(detail.status).toLowerCase()}.</div>}
        {!!detail.result.mentions?.length && <div className="extracted"><strong>Recomendações extraídas</strong><div className="chips">{detail.result.mentions.map((m, i) => <span className="chip" key={i}>{m.position ? `${m.position}. ` : ""}{m.name}</span>)}</div></div>}
        {!!detail.raw.sources?.length && <div className="answer-sources"><h3>Fontes consultadas</h3><Sources sources={detail.raw.sources}/></div>}
      </> : <div className="empty-mini">Selecione uma consulta para ver a resposta.</div>}
    </div></div>
    <DialogFooter><Button variant="outline" asChild><DownloadLink path={`/api/diagnostics/${immersionId}?job=${job?.id || ""}`}>Baixar diagnóstico</DownloadLink></Button></DialogFooter>
  </DialogContent></Dialog>;
}
function labelsFor(status: string) {return ({queued: "Na fila", running: "Em andamento", completed: "Concluída", failed: "Falha", stopped: "Encerrada"} as Record<string, string>)[status] || status;}
