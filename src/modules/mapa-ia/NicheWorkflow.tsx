import { useEffect, useState } from "react";
import { Check, CircleHelp, Loader2, RefreshCw, Search, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge, Choice, Field, fold, request, timeLabel } from "./helpers";
import type { Company, Job, NicheOutcome, NicheResult, NicheSuggestion } from "./types";

export type NicheScope = "pending" | "missing" | "all";
const genericNames = new Set(["", "educacao", "biomedica", "biomedico", "agronomo", "agronoma", "produtor rural", "produtora rural", "autonoma", "autonomo", "empresario", "empresaria", "profissional liberal", "nao informado", "sem empresa"]);
export function nicheCandidates(companies: Company[], scope: NicheScope) {
  return companies.filter(c => {
    const reference = c.name || (c.participants.length === 1 ? c.participants[0].name : "");
    return c.status !== "excluded" && (scope === "all" || c.status !== "ready") && (scope !== "missing" || !c.niche.trim()) && !genericNames.has(fold(reference).trim().replace(/\s+/g, " "));
  });
}

export function NicheRunDialog({open, companies, busy, onClose, onStart}: {open: boolean; companies: Company[]; busy: boolean; onClose: () => void; onStart: (scope: NicheScope, refreshSources: boolean) => Promise<void>}) {
  const [scope, setScope] = useState<NicheScope>("pending");
  const [refreshSources, setRefreshSources] = useState(false);
  useEffect(() => {if (open) {setScope(nicheCandidates(companies, "pending").length ? "pending" : "all"); setRefreshSources(false);}}, [open]);
  const candidates = nicheCandidates(companies, scope);
  const withoutReference = companies.filter(c => c.status !== "excluded" && (scope === "all" || c.status !== "ready") && (scope !== "missing" || !c.niche.trim())).length - candidates.length;
  const prefilled = candidates.filter(c => c.niche.trim()).length;
  return <Dialog open={open} onOpenChange={value => !value && !busy && onClose()}><DialogContent className="modal modal-niche-run"><DialogHeader><DialogTitle>Identificar e conferir nichos</DialogTitle><DialogDescription>Escolha o alcance. Ao terminar, confira e confirme as sugestões para atualizar os cadastros.</DialogDescription></DialogHeader>
    <Field label="Cadastros a pesquisar"><Choice label="Cadastros a pesquisar" value={scope} onChange={value => setScope(value as NicheScope)} disabled={busy} options={[
      {value: "pending", label: `Aguardando revisão (${nicheCandidates(companies, "pending").length})`},
      {value: "missing", label: `Somente sem nicho (${nicheCandidates(companies, "missing").length})`},
      {value: "all", label: `Todos, inclusive confirmados (${nicheCandidates(companies, "all").length})`}
    ]}/></Field>
    <div className="niche-run-summary"><strong>{candidates.length} {candidates.length === 1 ? "cadastro selecionado" : "cadastros selecionados"}</strong><p>{prefilled ? `${prefilled} ${prefilled === 1 ? "já tem nicho preenchido e também será conferido" : "já têm nicho preenchido e também serão conferidos"} pela IA.` : "A pesquisa vai buscar um nicho para cada cadastro selecionado."}</p>{withoutReference > 0 && <p>{withoutReference} sem referência suficiente ficam para revisão manual. Informe uma empresa ou um único participante.</p>}</div>
    <label className="check-line"><Checkbox checked={refreshSources} disabled={busy} onCheckedChange={value => setRefreshSources(value === true)}/>Pesquisar novamente, sem reaproveitar pesquisas anteriores</label>
    <p className="small muted">{refreshSources ? "Cada cadastro selecionado gera uma nova pesquisa na API." : "Pesquisas anteriores compatíveis, de até 90 dias, podem ser reaproveitadas. Um nicho preenchido sozinho não dispensa a pesquisa."} Novas consultas são cobradas pela API OpenAI.</p>
    <div className="notice"><CircleHelp/><p>O nicho atual fica preservado até sua confirmação. Resultados sem evidência suficiente ficam sinalizados para revisão.</p></div>
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy || !candidates.length} onClick={() => void onStart(scope, refreshSources)}>{busy ? <Loader2 className="spin"/> : <WandSparkles/>}Pesquisar {candidates.length} {candidates.length === 1 ? "cadastro" : "cadastros"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

const outcomeLabels: Record<NicheOutcome, string> = {pending: "Confirmar sugestão", accepted: "Aplicado ao cadastro", unchanged: "Resultado preservado", reused: "Nicho reaproveitado", inconclusive: "Revisão manual", failed: "Falha na pesquisa", superseded: "Cadastro alterado", stopped: "Encerrado", queued: "Na fila", running: "Pesquisando"};
export function NicheResults({jobs, job, busy, active, onSelect, onReview, onBatch, onAudit, onEdit, onRetry}: {jobs: Job[]; job?: Job; busy: boolean; active: boolean; onSelect: (id: string) => void; onReview: (id: string) => void; onBatch: () => void; onAudit: () => void; onEdit: (id: string) => void; onRetry: () => void}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  useEffect(() => {setFilter("all"); setSearch("");}, [job?.id]);
  if (!job) return null;
  const counts = job.identification?.counts;
  const rows = job.identification?.rows || [];
  const visible = rows.filter(r => (filter === "all" || (filter === "attention" ? ["failed", "inconclusive", "superseded"].includes(r.outcome) : r.outcome === filter)) && fold(`${r.name} ${r.previousNiche} ${r.proposedNiche}`).includes(fold(search)));
  const ended = !["running", "queued", "paused"].includes(job.status);
  return <section className="panel niche-results" aria-label="Resultado da identificação de nichos">
    <div className="panel-heading"><div><div className="eyebrow">IDENTIFICAÇÃO DOS NICHOS</div><h2>{ended ? "Pesquisa finalizada. Confira o resultado." : "Resultados da identificação"}</h2><p>{job.identification?.legacyResults ? "Histórico preservado. Os contadores de aplicação mostram as confirmações registradas; confira os cadastros e as respostas anteriores." : ended && !counts?.pending && !counts?.accepted ? "Nenhuma alteração aplicada nesta pesquisa. Veja o motivo em cada cadastro." : "As sugestões ficam salvas aqui. Confirme para aplicar os nichos às empresas."}</p></div><Badge status={job.status}/></div>
    <div className="niche-summary" aria-live="polite"><div><strong>{counts?.pending || 0}</strong><span>Aguardando confirmação</span></div><div className="green"><strong>{counts?.accepted || 0}</strong><span>Aplicadas ao cadastro</span></div><div><strong>{counts?.inconclusive || 0}</strong><span>Revisão manual</span></div><div className="red"><strong>{counts?.failed || 0}</strong><span>Falhas na pesquisa</span></div></div>
    <div className="niche-summary-note"><span>{counts?.changed || 0} {(counts?.changed || 0) === 1 ? "nicho alterado" : "nichos alterados"} · {counts?.reused || 0} resultados reaproveitados · {job.completed}/{job.total} consultas concluídas</span>{!!counts?.superseded && <span>{counts.superseded} cadastros editados depois da pesquisa: as edições foram preservadas.</span>}{job.status === "stopped" && <span>Fila encerrada. As sugestões já obtidas continuam disponíveis.</span>}</div>
    <div className="table-toolbar niche-toolbar"><Choice label="Histórico de identificações" value={job.id} onChange={onSelect} options={jobs.map(j => ({value: j.id, label: `${timeLabel(j.created_at)} · ${j.completed}/${j.total} · ${j.status === "completed" ? "Finalizada" : j.status === "partial" ? "Com falhas" : j.status === "stopped" ? "Encerrada" : "Em andamento"}`}))}/><div className="niche-result-actions">{!!counts?.pending && <Button size="sm" onClick={onBatch} disabled={busy}><Check/>Confirmar em lote</Button>}{job.failed > 0 && ["partial", "completed", "stopped", "paused"].includes(job.status) && <Button size="sm" variant="outline" disabled={busy || active && job.status !== "paused"} onClick={onRetry}><RefreshCw/>Repetir {job.failed} {job.failed === 1 ? "falha" : "falhas"}</Button>}<Button size="sm" variant="ghost" onClick={onAudit}>Ver respostas e fontes</Button></div></div>
    <div className="table-toolbar"><div className="search-input"><Search size={17}/><input aria-label="Buscar identificação" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa ou nicho"/></div><Choice label="Filtrar resultado da identificação" value={filter} onChange={setFilter} options={[{value: "all", label: "Todos os resultados"}, {value: "pending", label: "Aguardando confirmação"}, {value: "accepted", label: "Aplicados ao cadastro"}, {value: "attention", label: "Precisam de atenção"}, {value: "inconclusive", label: "Revisão manual"}, {value: "failed", label: "Falhas"}]}/><small className="muted">{visible.length} de {rows.length} cadastros</small></div>
    <Table className="niche-results-table"><TableHeader><TableRow><TableHead>Empresa / referência</TableHead><TableHead>Nicho antes da pesquisa</TableHead><TableHead>Resultado encontrado</TableHead><TableHead>Situação</TableHead><TableHead className="right">Próximo passo</TableHead></TableRow></TableHeader><TableBody>{visible.map(row => <TableRow key={row.id}><TableCell><strong>{row.name || "Empresa não informada"}</strong><small className="cell-subtitle">{row.origin === "cache" ? "Pesquisa anterior reaproveitada" : row.origin === "local" ? "Preenchimento existente · sem consulta" : row.origin === "skipped" ? "Consulta dispensada" : row.hasSources ? "Pesquisa com fontes" : ""}</small></TableCell><TableCell>{row.previousNiche || <span className="missing">Sem nicho</span>}</TableCell><TableCell><strong>{row.outcome === "accepted" ? row.approvedNiche : row.proposedNiche || "—"}</strong>{row.reason && <small className="cell-subtitle">{row.reason}</small>}</TableCell><TableCell><span className={`niche-outcome niche-outcome-${row.outcome}`}>{outcomeLabels[row.outcome]}</span>{row.suggestionStatus === "deferred" && <small className="cell-subtitle">Guardada para depois</small>}</TableCell><TableCell className="right"><ResultAction row={row} busy={busy} onReview={onReview} onEdit={onEdit}/></TableCell></TableRow>)}</TableBody></Table>
    {!visible.length && <div className="empty-mini">Nenhum cadastro neste filtro.</div>}
    <div className="table-footer"><span><CircleHelp size={15}/>Concluir a pesquisa salva resultados. Confirmar aplica as alterações.</span></div>
  </section>;
}
function ResultAction({row, busy, onReview, onEdit}: {row: NicheResult; busy: boolean; onReview: (id: string) => void; onEdit: (id: string) => void}) {
  if (row.outcome === "pending") return <Button size="sm" disabled={busy} onClick={() => onReview(row.suggestionId)}>Conferir e aplicar</Button>;
  if (["inconclusive", "superseded", "reused", "unchanged"].includes(row.outcome)) return <Button size="sm" variant="outline" onClick={() => onEdit(row.companyId)}>Revisar cadastro</Button>;
  return row.outcome === "accepted" ? <Check size={18} className="niche-applied-check" aria-label="Aplicado"/> : null;
}

export function NicheBatchDialog({job, suggestions, onClose, onSaved}: {job: Job | null; suggestions: NicheSuggestion[]; onClose: () => void; onSaved: () => Promise<void>}) {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{accepted: number; changed: number; skipped: {id: string; reason: string}[]} | null>(null);
  // O conjunto revisado fica congelado: sugestões que chegarem depois não entram no clique.
  useEffect(() => {if (job) {setSelected(suggestions.filter(s => s.jobId === job.id && s.canAcceptInBatch).map(s => s.id)); setResult(null);}}, [job?.id]);
  const candidates = suggestions.filter(s => s.jobId === job?.id && selected.includes(s.id));
  const individual = suggestions.filter(s => s.jobId === job?.id && !s.canAcceptInBatch).length;
  async function confirm() {
    if (!job || !candidates.length || saving) return;
    setSaving(true);
    try {
      const next = await request<{accepted: number; changed: number; skipped: {id: string; reason: string}[]}>("/api/niche-confirmations", {jobId: job.id, suggestionIds: candidates.map(s => s.id)});
      setResult(next);
      toast.success(`${next.accepted} ${next.accepted === 1 ? "sugestão confirmada" : "sugestões confirmadas"}. ${next.changed} ${next.changed === 1 ? "nicho alterado" : "nichos alterados"}.`);
      await onSaved();
    } catch (error) {toast.error(error instanceof Error ? error.message : "Não foi possível confirmar.");}
    finally {setSaving(false);}
  }
  return <Dialog open={Boolean(job)} onOpenChange={value => !value && !saving && onClose()}><DialogContent className="modal modal-niche-batch"><DialogHeader><DialogTitle>Confirmar sugestões em lote</DialogTitle><DialogDescription>Confira o nicho atual e a proposta. Apenas as sugestões marcadas serão aplicadas, sem novas consultas à IA.</DialogDescription></DialogHeader>
    {result ? <div className="notice"><Check/><div><strong>{result.accepted} {result.accepted === 1 ? "sugestão aplicada" : "sugestões aplicadas"} · {result.changed} {result.changed === 1 ? "nicho alterado" : "nichos alterados"}</strong>{result.skipped.length > 0 && <p>{result.skipped.length} não foram aplicadas: {Array.from(new Set(result.skipped.map(s => s.reason))).join(" ")}</p>}<p>O resumo e os cadastros foram atualizados.</p></div></div> : <>
      {!!individual && <p className="small muted">{individual} {individual === 1 ? "sugestão precisa" : "sugestões precisam"} da confirmação individual do nome da empresa ou profissional.</p>}
      <div className="preview-table"><Table><TableHeader><TableRow><TableHead>Aplicar</TableHead><TableHead>Empresa</TableHead><TableHead>Nicho atual</TableHead><TableHead>Nicho proposto</TableHead></TableRow></TableHeader><TableBody>{suggestions.filter(s => s.jobId === job?.id && s.canAcceptInBatch).map(s => <TableRow key={s.id}><TableCell><Checkbox aria-label={`Aplicar nicho de ${s.name}`} checked={selected.includes(s.id)} disabled={saving} onCheckedChange={value => setSelected(ids => value === true ? [...ids, s.id] : ids.filter(id => id !== s.id))}/></TableCell><TableCell>{s.name}</TableCell><TableCell>{s.currentNiche || "Sem nicho"}</TableCell><TableCell>{s.niche}</TableCell></TableRow>)}</TableBody></Table></div>
      {!candidates.length && <div className="empty-mini">Nenhuma sugestão marcada para aplicação. Confira individualmente os cadastros que precisam de nome.</div>}
      <p className="small muted">Se um cadastro tiver sido editado desde a pesquisa, ele será preservado e sinalizado no resumo.</p>
    </>}
    <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>{result ? "Fechar" : "Cancelar"}</Button>{!result && <Button disabled={saving || !candidates.length} onClick={() => void confirm()}>{saving ? <Loader2 className="spin"/> : <Check/>}Confirmar {candidates.length} {candidates.length === 1 ? "sugestão" : "sugestões"}</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}
