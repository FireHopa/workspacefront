import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Building2, CheckCircle2, ChevronLeft, ChevronRight,
  CircleHelp, Download, Eye, Filter, Globe2, Loader2, Map as MapIcon, MapPin, Medal, Network, RefreshCw,
  Search, ShieldCheck, Sparkles, Star, Target, Trophy, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Answer, Choice, DownloadLink, Sources, request, timeLabel } from "./helpers";
import type {
  DashboardAudit, DashboardCompany, DashboardEntity, DashboardEntityDetail, DashboardFilters,
  DashboardMap as DashboardMapResponse, DashboardMapPin, DashboardSummary, Detail, GoogleProfile,
  Job,
} from "./types";

const DEFAULT_FILTERS: DashboardFilters = {q: "", niche: "", city: "", neighborhood: "", company: "", presence: "all", position: "all"};

function paramsFromFilters(filters: DashboardFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  return params;
}

function pct(value: number) {return `${value.toLocaleString("pt-BR", {maximumFractionDigits: 1})}%`;}
function rank(value: number | null) {return value == null ? "—" : `#${value.toLocaleString("pt-BR", {maximumFractionDigits: 1})}`;}
function plural(value: number, one: string, many: string) {return `${value.toLocaleString("pt-BR")} ${value === 1 ? one : many}`;}
function frequencyClass(value: number) {return value >= 80 ? "strong" : value >= 60 ? "good" : value >= 30 ? "medium" : value > 0 ? "low" : "none";}

function presenceLabel(value: number) {return value >= 80 ? "Muito recorrente" : value >= 60 ? "Recorrente" : value >= 30 ? "Moderada" : value >= 10 ? "Ocasional" : value > 0 ? "Rara" : "Não detectada";}



type LeafletNamespace = {
  map: (element: HTMLElement, options?: any) => any;
  tileLayer: (url: string, options?: any) => any;
  latLngBounds: (points: [number, number][]) => any;
  divIcon: (options?: any) => any;
  marker: (latlng: [number, number], options?: any) => any;
};

let leafletLoader: Promise<LeafletNamespace> | null = null;
function loadLeafletAssets(): Promise<LeafletNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("Leaflet só pode ser carregado no navegador."));
  if ((window as any).L) return Promise.resolve((window as any).L as LeafletNamespace);
  if (leafletLoader) return leafletLoader;
  leafletLoader = new Promise((resolve, reject) => {
    const finish = () => {
      if ((window as any).L) resolve((window as any).L as LeafletNamespace);
      else reject(new Error("Leaflet não foi carregado."));
    };
    const existingScript = document.querySelector('script[data-leaflet="true"]') as HTMLScriptElement | null;
    const existingStyle = document.querySelector('link[data-leaflet="true"]') as HTMLLinkElement | null;
    if (!existingStyle) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet", "true");
      document.head.appendChild(link);
    }
    if (existingScript) {
      if ((window as any).L) finish();
      else {
        existingScript.addEventListener("load", finish, {once: true});
        existingScript.addEventListener("error", () => reject(new Error("Não foi possível carregar o Leaflet.")), {once: true});
      }
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.setAttribute("data-leaflet", "true");
    script.onload = finish;
    script.onerror = () => reject(new Error("Não foi possível carregar o Leaflet."));
    document.body.appendChild(script);
  });
  return leafletLoader;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function AnimatedNumber({value, decimals = 0, suffix = ""}: {value: number; decimals?: number; suffix?: string}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const duration = 760;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown.toLocaleString("pt-BR", {minimumFractionDigits: decimals, maximumFractionDigits: decimals})}{suffix}</>;
}

function ExecutiveGauge({value}: {value: number}) {
  const safe = Math.min(100, Math.max(0, value));
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const target = circumference * (1 - safe / 100);
  return <div className="executive-gauge" style={{"--gauge-target": target} as React.CSSProperties}>
    <svg viewBox="0 0 112 112" aria-label={`${pct(safe)} das empresas foram recomendadas`}>
      <circle className="executive-gauge-track" cx="56" cy="56" r={radius}/>
      <circle className="executive-gauge-progress" cx="56" cy="56" r={radius} strokeDasharray={circumference}/>
    </svg>
    <div><strong><AnimatedNumber value={safe} decimals={safe % 1 ? 1 : 0} suffix="%"/></strong><span>presença</span></div>
    <i className="executive-gauge-orbit"/>
  </div>;
}

function ExecutivePositionChart({rows}: {rows: {position: number | null; count: number}[]}) {
  const visible = rows.filter(row => row.count > 0).slice(0, 7);
  const max = Math.max(1, ...visible.map(row => row.count));
  if (!visible.length) return <MiniEmpty>Ainda não há posições suficientes para desenhar o gráfico.</MiniEmpty>;
  return <div className="executive-position-chart">{visible.map((row, index) => {
    const height = Math.max(14, row.count / max * 100);
    return <div className="executive-position-column" key={row.position ?? "unranked"}>
      <strong>{row.count}</strong>
      <div><i style={{height: `${height}%`, animationDelay: `${260 + index * 80}ms`}} className={row.position == null ? "unranked" : ""}/></div>
      <span>{row.position == null ? "S/ rank" : `#${row.position}`}</span>
    </div>;
  })}</div>;
}

function ExecutivePresenceBars({companies}: {companies: DashboardCompany[]}) {
  if (!companies.length) return <MiniEmpty>Nenhuma empresa corresponde à visão atual.</MiniEmpty>;
  return <div className="executive-presence-bars">{companies.slice(0, 8).map((company, index) => <div className="executive-presence-row" key={company.companyId}>
    <div className="executive-presence-name"><span>{index + 1}</span><div><strong>{company.name}</strong><small>{[company.neighborhood, company.city].filter(Boolean).join(" · ")}</small></div></div>
    <div className="executive-presence-track"><i className={`presence-${frequencyClass(company.frequencyPercent)}`} style={{width: `${Math.max(2, company.frequencyPercent)}%`, animationDelay: `${220 + index * 75}ms`}}/></div>
    <div className="executive-presence-value"><strong>{pct(company.frequencyPercent)}</strong><span>{presenceLabel(company.frequencyPercent)}</span></div>
  </div>)}</div>;
}

export function ExecutiveDashboard({
  job, jobs, historyId, onHistoryChange, googleProfiles, googleConfigured, onOpenAdvanced,
}: {
  job?: Job;
  jobs: Job[];
  historyId: string;
  onHistoryChange: (id: string) => void;
  googleProfiles: Record<string, GoogleProfile>;
  googleConfigured: boolean;
  onOpenAdvanced: () => void;
}) {
  const [filters, setFilters] = useState<DashboardFilters>({...DEFAULT_FILTERS});
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [mapData, setMapData] = useState<DashboardMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);

  useEffect(() => {setFilters({...DEFAULT_FILTERS});}, [job?.id]);
  const executiveParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.city) params.set("city", filters.city);
    if (filters.neighborhood) params.set("neighborhood", filters.neighborhood);
    if (filters.presence && filters.presence !== "all") params.set("presence", filters.presence);
    return params.toString();
  }, [filters.city, filters.neighborhood, filters.presence]);

  useEffect(() => {
    if (!job) {setSummary(null); return;}
    let cancelled = false;
    setLoading(true);
    request<DashboardSummary>(`/api/jobs/${job.id}/dashboard${executiveParams ? `?${executiveParams}` : ""}`)
      .then(data => {if (!cancelled) setSummary(data);})
      .catch(error => {if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível montar o painel principal.");})
      .finally(() => {if (!cancelled) setLoading(false);});
    return () => {cancelled = true;};
  }, [job?.id, job?.status, job?.completed, job?.failed, executiveParams]);

  useEffect(() => {
    if (!job) {setMapData(null); return;}
    let cancelled = false;
    setMapLoading(true);
    const query = new URLSearchParams(executiveParams);
    query.set("limit", "80");
    request<DashboardMapResponse>(`/api/jobs/${job.id}/dashboard/map?${query}`)
      .then(data => {if (!cancelled) setMapData(data);})
      .catch(error => {if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível montar o mapa.");})
      .finally(() => {if (!cancelled) setMapLoading(false);});
    return () => {cancelled = true;};
  }, [job?.id, executiveParams]);

  if (!job) return <section className="dashboard-empty panel"><div className="dashboard-empty-icon"><BarChart3/></div><h2>O dashboard nasce depois da primeira análise</h2><p>Execute uma análise na etapa 3 para visualizar presença, posições e distribuição geográfica.</p></section>;

  const topCompanies = [...(summary?.companies || [])].sort((a, b) => b.frequencyPercent - a.frequencyPercent || b.top1 - a.top1 || b.appearances - a.appearances);
  const best = topCompanies.slice(0, 3);
  const visibleCompanyIds = new Set((summary?.companies || []).map(company => company.companyId));
  const liveGoogleMatched = Object.entries(googleProfiles).filter(([id, profile]) => visibleCompanyIds.has(id) && profile.status === "matched").length;
  const hasSimpleFilters = Boolean(filters.city || filters.neighborhood || (filters.presence && filters.presence !== "all"));
  const setFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => setFilters(current => ({...current, [key]: value}));
  const clear = () => setFilters({...DEFAULT_FILTERS});

  return <div className="executive-dashboard">
    <section className="executive-hero panel executive-reveal executive-delay-1">
      <div className="executive-hero-copy">
        <div className="eyebrow"><span className="executive-live-dot"/>VISÃO PRINCIPAL</div>
        <h2>O retrato das recomendações de IA, em uma tela.</h2>
        <p>Uma leitura rápida de quem está aparecendo, com qual força e onde essas recomendações estão concentradas.</p>
        <div className="executive-hero-meta"><span><Activity/>Execução de {timeLabel(job.created_at)}</span>{summary && <span><MapPin/>{summary.kpis.cities} cidades · {summary.kpis.neighborhoods} bairros</span>}</div>
      </div>
      <div className="executive-hero-visual">
        {summary ? <ExecutiveGauge value={summary.kpis.recommendationRate}/> : <div className="executive-gauge executive-gauge-loading"><Loader2 className="spin"/></div>}
        <div className="executive-hero-total"><span>Empresas recomendadas</span><strong>{summary ? <><AnimatedNumber value={summary.kpis.recommendedCompanies}/><small> / {summary.kpis.auditedCompanies.toLocaleString("pt-BR")}</small></> : "—"}</strong><em>{summary ? presenceLabel(summary.kpis.recommendationRate) : "Consolidando…"}</em></div>
      </div>
      <div className="executive-hero-actions">
        <Choice label="Execução" value={historyId || job.id} onChange={onHistoryChange} options={jobs.map(item => ({value: item.id, label: `${timeLabel(item.created_at)} · ${item.status === "completed" ? "Concluída" : item.status === "partial" ? "Com falhas" : item.status}`}))}/>
        <Button variant="outline" onClick={onOpenAdvanced}>Abrir avançado<ArrowRight/></Button>
      </div>
    </section>

    <section className="executive-filters panel executive-reveal executive-delay-2">
      <div className="executive-filter-intro"><Filter/><div><strong>Recorte rápido</strong><span>Só os filtros que mudam a leitura executiva.</span></div></div>
      <Choice label="Cidade" value={filters.city || "all"} onChange={value => setFilter("city", value === "all" ? "" : value)} options={[{value: "all", label: "Todas as cidades"}, ...(summary?.options.cities || []).map(value => ({value, label: value}))]}/>
      <Choice label="Bairro" value={filters.neighborhood || "all"} onChange={value => setFilter("neighborhood", value === "all" ? "" : value)} options={[{value: "all", label: "Todos os bairros"}, ...(summary?.options.neighborhoods || []).map(value => ({value, label: value}))]}/>
      <Choice label="Tipo de presença" value={filters.presence} onChange={value => setFilter("presence", value)} options={[{value: "all", label: "Todas"}, {value: "mentioned", label: "Recomendadas"}, {value: "absent", label: "Não recomendadas"}, {value: "uncertain", label: "Menção incerta"}]}/>
      {hasSimpleFilters && <Button size="sm" variant="ghost" onClick={clear}>Limpar</Button>}
    </section>

    {loading && !summary ? <section className="executive-building panel"><div className="executive-building-rings"><i/><i/><i/><Sparkles/></div><div><strong>Montando seu dashboard</strong><span>Consolidando presença, posições e localização das empresas…</span></div></section> : summary && <>
      <section className="executive-kpis executive-reveal executive-delay-3">
        <div className="executive-kpi executive-kpi-primary"><div><CheckCircle2/></div><span>Recomendadas</span><strong><AnimatedNumber value={summary.kpis.recommendedCompanies}/></strong><small>{pct(summary.kpis.recommendationRate)} das empresas analisadas</small><i style={{width: `${summary.kpis.recommendationRate}%`}}/></div>
        <div className="executive-kpi"><div><Trophy/></div><span>Chegaram ao topo</span><strong><AnimatedNumber value={summary.kpis.top1Companies}/></strong><small>empresas em posição #1 explícita</small></div>
        <div className="executive-kpi"><div><MapPin/></div><span>Cobertura</span><strong><AnimatedNumber value={summary.kpis.cities}/><small> cidades</small></strong><small>{summary.kpis.neighborhoods.toLocaleString("pt-BR")} bairros analisados</small></div>
        <div className="executive-kpi"><div><Star/></div><span>Google confirmado</span><strong><AnimatedNumber value={liveGoogleMatched || summary.kpis.googleMatched}/><small> / {summary.kpis.googleTotal}</small></strong><small>{googleConfigured ? "perfis associados com segurança" : "conecte a API do Google Maps"}</small></div>
      </section>

      <section className="executive-grid executive-reveal executive-delay-4">
        <div className="panel executive-chart-card executive-presence-card">
          <div className="executive-section-heading"><div><span><Target/></span><div><h3>Quem aparece com mais força</h3><p>Frequência de recomendação nas consultas aplicáveis de cada empresa.</p></div></div><b>{topCompanies.length} empresas</b></div>
          <ExecutivePresenceBars companies={topCompanies}/>
        </div>
        <div className="panel executive-chart-card executive-position-card">
          <div className="executive-section-heading"><div><span><BarChart3/></span><div><h3>Posições conquistadas</h3><p>Somente posições explicitamente numeradas pela IA.</p></div></div></div>
          <ExecutivePositionChart rows={summary.positionDistribution}/>
          <div className="executive-position-note"><Sparkles/><span>Um primeiro lugar só conta quando a resposta trouxe ranking explícito.</span></div>
        </div>
      </section>

      <section className="executive-highlights executive-reveal executive-delay-5">
        <div className="executive-highlights-title"><div><Medal/><div><h3>Destaques da execução</h3><p>As empresas com maior presença no recorte atual.</p></div></div></div>
        <div className="executive-highlight-grid">{best.map((company, index) => <article className={`executive-highlight-card executive-place-${index + 1}`} key={company.companyId}><div className="executive-highlight-rank">{index + 1}</div><div className="executive-highlight-main"><span>{company.niche}</span><h4>{company.name}</h4><small>{[company.neighborhood, company.city].filter(Boolean).join(" · ")}</small></div><div className="executive-highlight-score"><strong>{pct(company.frequencyPercent)}</strong><span>{company.appearances}/{company.validQueries} aparições</span></div><div className="executive-highlight-stats"><span><Trophy/>{company.top1} Top 1</span><span><BarChart3/>{rank(company.averageRank)} média</span></div></article>)}</div>
      </section>

      <section className="panel executive-map-panel executive-reveal executive-delay-6">
        <div className="executive-map-heading"><div><span><MapIcon/></span><div><h3>Onde as recomendações estão acontecendo</h3><p>{mapData?.configured ? `${mapData.located} empresas citadas foram localizadas com segurança no recorte atual.` : "Conecte o Google Maps para transformar as citações em presença geográfica."}</p></div></div><span className="executive-map-badge"><span className="executive-live-dot"/>{mapLoading ? "Atualizando mapa" : "Mapa auditável"}</span></div>
        {mapLoading && !mapData ? <div className="map-loading executive-map-loading"><Loader2 className="spin"/>Posicionando empresas confirmadas…</div> : <CitationMap data={mapData}/>} 
        {mapData?.configured && mapData.eligible > mapData.located && <p className="map-footnote"><CircleHelp/>O mapa não inventa coordenadas: empresas sem correspondência segura no Google ficam fora da visualização.</p>}
      </section>

      <section className="executive-advanced-cta panel executive-reveal executive-delay-7"><div><Eye/><div><strong>Precisa investigar um resultado?</strong><span>A etapa 5 mantém rankings completos, concorrentes, filtros avançados, auditoria consulta por consulta e respostas originais.</span></div></div><Button onClick={onOpenAdvanced}>Ir para o avançado<ArrowRight/></Button></section>
    </>}
  </div>;
}

export function RecommendationDashboard({
  job, jobs, historyId, onHistoryChange, googleProfiles, googleProfilesLoading, googleConfigured,
}: {
  job?: Job;
  jobs: Job[];
  historyId: string;
  onHistoryChange: (id: string) => void;
  googleProfiles: Record<string, GoogleProfile>;
  googleProfilesLoading: boolean;
  googleConfigured: boolean;
}) {
  const [filters, setFilters] = useState<DashboardFilters>({...DEFAULT_FILTERS});
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [audit, setAudit] = useState<DashboardAudit | null>(null);
  const [mapData, setMapData] = useState<DashboardMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [rankingMode, setRankingMode] = useState<"citations" | "top1" | "rank">("citations");
  const [groupDimension, setGroupDimension] = useState<"niche" | "city" | "neighborhood">("niche");
  const [mapRefresh, setMapRefresh] = useState(0);
  const lastForcedMapRefresh = useRef(0);
  const searchTimer = useRef<number | null>(null);
  const [searchDraft, setSearchDraft] = useState("");

  useEffect(() => {
    setFilters({...DEFAULT_FILTERS}); setSearchDraft(""); setAuditPage(1); setSelectedEntity(""); setSelectedTask("");
  }, [job?.id]);

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {setFilters(current => ({...current, q: searchDraft})); setAuditPage(1);}, 280);
    return () => {if (searchTimer.current) window.clearTimeout(searchTimer.current);};
  }, [searchDraft]);

  const filterKey = useMemo(() => paramsFromFilters(filters).toString(), [filters]);
  useEffect(() => {
    if (!job) {setSummary(null); return;}
    let cancelled = false;
    setLoading(true);
    request<DashboardSummary>(`/api/jobs/${job.id}/dashboard${filterKey ? `?${filterKey}` : ""}`)
      .then(data => {if (!cancelled) setSummary(data);})
      .catch(error => {if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível carregar o dashboard.");})
      .finally(() => {if (!cancelled) setLoading(false);});
    return () => {cancelled = true;};
  }, [job?.id, job?.status, job?.completed, job?.failed, filterKey]);

  useEffect(() => {
    if (!job) {setAudit(null); return;}
    let cancelled = false;
    setAuditLoading(true);
    const query = new URLSearchParams(paramsFromFilters(filters));
    query.set("page", String(auditPage)); query.set("page_size", "25");
    request<DashboardAudit>(`/api/jobs/${job.id}/dashboard/audit?${query}`)
      .then(data => {if (!cancelled) setAudit(data);})
      .catch(error => {if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível carregar a auditoria.");})
      .finally(() => {if (!cancelled) setAuditLoading(false);});
    return () => {cancelled = true;};
  }, [job?.id, job?.status, job?.completed, job?.failed, filterKey, auditPage]);

  useEffect(() => {
    if (!job) {setMapData(null); return;}
    let cancelled = false;
    setMapLoading(true);
    const query = new URLSearchParams(paramsFromFilters(filters));
    query.set("limit", "80");
    const forceRefresh = mapRefresh > lastForcedMapRefresh.current;
    if (forceRefresh) {query.set("refresh", "true"); lastForcedMapRefresh.current = mapRefresh;}
    request<DashboardMapResponse>(`/api/jobs/${job.id}/dashboard/map?${query}`)
      .then(data => {if (!cancelled) setMapData(data);})
      .catch(error => {if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível montar o mapa de citações.");})
      .finally(() => {if (!cancelled) setMapLoading(false);});
    return () => {cancelled = true;};
  }, [job?.id, filterKey, mapRefresh]);

  const rankedEntities = useMemo(() => {
    const rows = [...(summary?.entityRanking || [])];
    if (rankingMode === "citations") rows.sort((a, b) => b.citations - a.citations || b.queries - a.queries);
    if (rankingMode === "top1") rows.sort((a, b) => b.top1 - a.top1 || b.queries - a.queries);
    if (rankingMode === "rank") rows.sort((a, b) => (a.averageRank ?? 999) - (b.averageRank ?? 999) || b.queries - a.queries);
    return rows;
  }, [summary?.entityRanking, rankingMode]);
  const groupedLeaders = summary?.groupRankings?.[groupDimension] || [];
  const googleMatchedLive = Object.values(googleProfiles).filter(profile => profile.status === "matched").length;

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key !== "q" && value && value !== "all").length + (filters.q ? 1 : 0);
  const clearFilters = () => {setFilters({...DEFAULT_FILTERS}); setSearchDraft(""); setAuditPage(1);};
  const setFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {setFilters(current => ({...current, [key]: value})); setAuditPage(1);};

  if (!job) return <section className="dashboard-empty panel"><div className="dashboard-empty-icon"><BarChart3/></div><h2>O Radar de Recomendação nasce depois da primeira análise</h2><p>Execute uma análise na etapa 3. Esta página consolida concorrentes, frequência, posições, mapa e evidências de cada consulta.</p></section>;

  return <div className="radar-dashboard">
    <div className="dashboard-hero panel">
      <div><div className="eyebrow">ANÁLISE AVANÇADA</div><h2>Radar e auditoria completos</h2><p>Filtros completos, concorrentes, rankings e evidências rastreáveis até a resposta original.</p></div>
      <div className="dashboard-hero-actions">
        <Choice label="Execução" value={historyId || job.id} onChange={onHistoryChange} options={jobs.map(item => ({value: item.id, label: `${timeLabel(item.created_at)} · ${item.status === "completed" ? "Concluída" : item.status === "partial" ? "Com falhas" : item.status}`}))}/>
        <DownloadLink className="dashboard-export" path={`/api/jobs/${job.id}/dashboard/export`}><Download/>Exportar auditoria</DownloadLink>
      </div>
    </div>

    <section className="dashboard-filterbar panel">
      <div className="dashboard-search"><Search/><input value={searchDraft} onChange={e => setSearchDraft(e.target.value)} placeholder="Buscar empresa, concorrente, nicho, cidade ou bairro…"/></div>
      <Choice label="Nicho" value={filters.niche || "all"} onChange={value => setFilter("niche", value === "all" ? "" : value)} options={[{value: "all", label: "Todos os nichos"}, ...(summary?.options.niches || []).map(value => ({value, label: value}))]}/>
      <Choice label="Cidade" value={filters.city || "all"} onChange={value => setFilter("city", value === "all" ? "" : value)} options={[{value: "all", label: "Todas as cidades"}, ...(summary?.options.cities || []).map(value => ({value, label: value}))]}/>
      <Choice label="Bairro" value={filters.neighborhood || "all"} onChange={value => setFilter("neighborhood", value === "all" ? "" : value)} options={[{value: "all", label: "Todos os bairros"}, ...(summary?.options.neighborhoods || []).map(value => ({value, label: value}))]}/>
      <Choice label="Empresa auditada" value={filters.company || "all"} onChange={value => setFilter("company", value === "all" ? "" : value)} options={[{value: "all", label: "Todas as empresas"}, ...(summary?.options.companies || []).map(value => ({value: value.id, label: value.name}))]}/>
      <Choice label="Presença" value={filters.presence} onChange={value => setFilter("presence", value)} options={[{value: "all", label: "Qualquer presença"}, {value: "mentioned", label: "Empresa recomendada"}, {value: "absent", label: "Não recomendada"}, {value: "uncertain", label: "Menção incerta"}]}/>
      <Choice label="Posição" value={filters.position} onChange={value => setFilter("position", value)} options={[{value: "all", label: "Qualquer posição"}, {value: "top1", label: "Top 1 explícito"}, {value: "top3", label: "Top 3 explícito"}, {value: "ranked", label: "Com ranking explícito"}, {value: "unranked", label: "Só ordem de menção"}]}/>
      <div className="dashboard-filter-meta"><span><Filter/>{activeFilterCount ? `${activeFilterCount} filtros ativos` : "Sem filtros"}</span>{activeFilterCount > 0 && <Button size="sm" variant="ghost" onClick={clearFilters}>Limpar</Button>}</div>
    </section>

    {loading && !summary ? <div className="dashboard-loading panel"><Loader2 className="spin"/>Consolidando a execução…</div> : summary && <>
      <section className="dashboard-kpis">
        <Kpi icon={<Building2/>} value={summary.kpis.auditedCompanies} label="Empresas auditadas" help="Empresas-alvo com consultas dentro dos filtros atuais."/>
        <Kpi icon={<CheckCircle2/>} value={summary.kpis.recommendedCompanies} suffix={` · ${pct(summary.kpis.recommendationRate)}`} label="Empresas recomendadas" accent="green" help="Empresas auditadas citadas em ao menos uma consulta válida."/>
        <Kpi icon={<Network/>} value={summary.kpis.competitorsUnique} label="Concorrentes únicos" accent="purple" help="Entidades citadas em consultas de outras empresas-alvo."/>
        <Kpi icon={<Search/>} value={summary.kpis.queriesValid} suffix={` / ${summary.kpis.queriesPlanned}`} label="Consultas válidas" help="Falhas e respostas não avaliáveis não viram ausência."/>
        <Kpi icon={<Sparkles/>} value={summary.kpis.citations} label="Citações extraídas" accent="amber" help="Todas as menções a empresas nas respostas avaliáveis."/>
        <Kpi icon={<Trophy/>} value={summary.kpis.top1Companies} label="Empresas que chegaram ao #1" accent="amber" help="Conta apenas posição numérica explícita na resposta."/>
        <Kpi icon={<MapPin/>} value={googleMatchedLive || summary.kpis.googleMatched} suffix={` / ${summary.kpis.googleTotal}`} label="Perfis Google confirmados" accent="green" help="Vínculos já confirmados para empresas auditadas nesta execução."/>
        <Kpi icon={<Globe2/>} value={summary.kpis.cities} suffix={` cidades · ${summary.kpis.neighborhoods} bairros`} label="Cobertura geográfica" help="Localizações efetivamente usadas pelas consultas filtradas."/>
      </section>

      <section className="dashboard-grid dashboard-grid-top">
        <div className="panel dashboard-card company-dominance">
          <CardHeader icon={<Target/>} title="Força das empresas auditadas" subtitle="Frequência usa somente as consultas válidas aplicáveis à própria empresa e localização."/>
          <div className="dashboard-company-list">
            {summary.companies.slice(0, 10).map((company, index) => <CompanyStrength key={company.companyId} company={company} index={index} onOpen={() => setSelectedEntity(`company:${company.companyId}`)}/>) }
            {!summary.companies.length && <MiniEmpty>Nenhuma empresa corresponde aos filtros.</MiniEmpty>}
          </div>
        </div>
        <div className="panel dashboard-card position-card">
          <CardHeader icon={<BarChart3/>} title="Distribuição das posições" subtitle="Ranking explícito é separado de simples ordem de menção."/>
          <PositionChart rows={summary.positionDistribution}/>
          <div className="position-legend"><span><i className="legend-explicit"/>Posição explícita</span><span><i className="legend-order"/>Sem ranking explícito</span></div>
        </div>
      </section>

      <section className="panel dashboard-map-panel">
        <div className="dashboard-map-heading"><CardHeader icon={<MapIcon/>} title="Mapa de empresas citadas" subtitle={mapData?.configured ? `${mapData.located} de ${mapData.eligible} entidades mais citadas foram localizadas com segurança.` : "Conecte a Places API para localizar as empresas citadas."}/><div className="dashboard-map-actions"><span className="maps-attribution">Localizações: Google Maps</span><Button size="sm" variant="outline" disabled={mapLoading || !googleConfigured} onClick={() => setMapRefresh(value => value + 1)}><RefreshCw className={mapLoading ? "spin" : ""}/>Atualizar pontos</Button></div></div>
        {mapLoading && !mapData ? <div className="map-loading"><Loader2 className="spin"/>Localizando as empresas citadas…</div> : <CitationMap data={mapData} onSelect={setSelectedEntity}/>} 
        {mapData?.configured && mapData.eligible > mapData.located && <p className="map-footnote"><CircleHelp/>Empresas sem correspondência segura no Google não recebem coordenada aproximada. Isso evita colocar homônimos ou empresas de outra cidade no mapa.</p>}
      </section>

      <section className="dashboard-grid dashboard-grid-middle">
        <div className="panel dashboard-card entity-ranking">
          <div className="dashboard-ranking-heading"><CardHeader icon={<Medal/>} title="Quem domina as citações" subtitle="Empresas auditadas e concorrentes citados nas respostas."/><Choice label="Ordenar ranking" value={rankingMode} onChange={value => setRankingMode(value as typeof rankingMode)} options={[{value: "citations", label: "Mais citadas"}, {value: "top1", label: "Mais vezes em #1"}, {value: "rank", label: "Melhor posição média"}]}/></div>
          <div className="entity-ranking-list">{rankedEntities.slice(0, 15).map((entity, index) => <EntityRank key={entity.entityKey} entity={entity} index={index} onOpen={() => setSelectedEntity(entity.entityKey)}/>)}</div>
        </div>
        <div className="panel dashboard-card niche-leaders">
          <div className="dashboard-ranking-heading"><CardHeader icon={<Users/>} title="Líderes por mercado e região" subtitle="Troque o agrupamento para enxergar quem domina por nicho, cidade ou bairro."/><Choice label="Agrupar líderes" value={groupDimension} onChange={value => setGroupDimension(value as typeof groupDimension)} options={[{value: "niche", label: "Por nicho"}, {value: "city", label: "Por cidade"}, {value: "neighborhood", label: "Por bairro"}]}/></div>
          <div className="niche-leader-list">{groupedLeaders.slice(0, 10).map(group => <div className="niche-leader" key={`${groupDimension}-${group.label}`}><strong>{group.label}</strong><div>{group.entities.slice(0, 4).map((entity, index) => <button key={entity.entityKey} onClick={() => setSelectedEntity(entity.entityKey)}><span>{index + 1}</span><em>{entity.name}</em><b>{entity.citations}</b></button>)}</div></div>)}{!groupedLeaders.length && <MiniEmpty>Nenhum grupo corresponde aos filtros atuais.</MiniEmpty>}</div>
        </div>
      </section>

      <section className="panel dashboard-card ai-google-card">
        <CardHeader icon={<Star/>} title="IA × Google Business Profile" subtitle="Reputação no Google e presença na IA são dimensões diferentes; o painel mostra as duas sem assumir causalidade."/>
        <div className="dashboard-table-wrap"><Table className="ai-google-table"><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Presença na IA</TableHead><TableHead>Top 1</TableHead><TableHead>Posição média</TableHead><TableHead>Google</TableHead><TableHead>Avaliações</TableHead><TableHead className="right">Detalhes</TableHead></TableRow></TableHeader><TableBody>{summary.companies.slice(0, 20).map(company => {const profile = googleProfiles[company.companyId]; return <TableRow key={company.companyId}><TableCell><strong>{company.name}</strong><small className="cell-subtitle">{company.neighborhood}, {company.city}</small></TableCell><TableCell><Frequency value={company.frequencyPercent} label={company.presenceLabel}/></TableCell><TableCell>{company.top1}</TableCell><TableCell>{rank(company.averageRank)}</TableCell><TableCell><GoogleCompact profile={profile} loading={googleProfilesLoading}/></TableCell><TableCell>{profile?.status === "matched" ? (profile.reviewCount || 0).toLocaleString("pt-BR") : "—"}</TableCell><TableCell className="right"><Button size="sm" variant="ghost" onClick={() => setSelectedEntity(`company:${company.companyId}`)}>Abrir<ChevronRight/></Button></TableCell></TableRow>;})}</TableBody></Table></div>
      </section>

      <section className="dashboard-grid dashboard-grid-quality">
        <div className="panel dashboard-card quality-card"><CardHeader icon={<ShieldCheck/>} title="Qualidade da execução" subtitle="Separação entre consulta concluída, resposta avaliável e falha."/><div className="quality-score"><strong>{pct(summary.quality.successRate)}</strong><span>consultas válidas</span></div><div className="quality-bars"><Quality label="Válidas" value={summary.quality.valid} total={summary.quality.total}/><Quality label="Não avaliáveis" value={summary.quality.incomplete} total={summary.quality.total}/><Quality label="Falhas" value={summary.quality.failed} total={summary.quality.total}/></div></div>
        <div className="panel dashboard-card alerts-card"><CardHeader icon={<AlertTriangle/>} title="Pontos de atenção" subtitle="Casos que merecem inspeção antes de usar a execução comercialmente."/>{summary.alerts.length ? <div className="dashboard-alerts">{summary.alerts.map(alert => <div key={`${alert.filter}-${alert.label}`} className={`dashboard-alert alert-${alert.type}`}><strong>{alert.count}</strong><span>{alert.label}</span></div>)}</div> : <div className="all-clear"><CheckCircle2/><div><strong>Nenhum alerta relevante</strong><span>Os dados filtrados não apresentam falhas ou ambiguidades registradas.</span></div></div>}</div>
      </section>

      <section className="panel audit-table-panel">
        <div className="audit-table-heading"><CardHeader icon={<Eye/>} title="Auditoria consulta por consulta" subtitle="Abra qualquer linha para ver prompt, resposta bruta, fontes e extração que alimentaram o dashboard."/><span>{audit?.total.toLocaleString("pt-BR") || 0} consultas</span></div>
        <div className="dashboard-table-wrap"><Table className="dashboard-audit-table"><TableHeader><TableRow><TableHead>Empresa auditada</TableHead><TableHead>Local / nicho</TableHead><TableHead>Resultado</TableHead><TableHead>Posição</TableHead><TableHead>Empresas citadas</TableHead><TableHead>Data</TableHead><TableHead className="right">Evidência</TableHead></TableRow></TableHeader><TableBody>{audit?.rows.map(row => <TableRow key={row.taskId}><TableCell><strong>{row.company}</strong><small className="cell-subtitle">Consulta {row.iteration}</small></TableCell><TableCell><strong>{row.niche}</strong><small className="cell-subtitle">{[row.neighborhood, row.city].filter(Boolean).join(", ")}</small></TableCell><TableCell><AuditStatus status={row.targetStatus}/></TableCell><TableCell>{row.explicitRank != null ? <><strong className="position">#{row.explicitRank}</strong><small className="cell-subtitle">ranking explícito</small></> : row.mentionOrder != null ? <><strong>{row.mentionOrder}ª menção</strong><small className="cell-subtitle">sem ranking explícito</small></> : <span className="muted">—</span>}</TableCell><TableCell><div className="mention-chips">{row.mentions.slice(0, 4).map(mention => <button key={`${mention.entityKey}-${mention.mentionOrder}`} onClick={() => setSelectedEntity(mention.entityKey)}>{mention.name}{mention.explicitRank != null ? <b>#{mention.explicitRank}</b> : null}</button>)}{row.mentions.length > 4 && <span>+{row.mentions.length - 4}</span>}</div></TableCell><TableCell>{timeLabel(row.updatedAt)}</TableCell><TableCell className="right"><Button size="sm" variant="ghost" onClick={() => setSelectedTask(row.taskId)}>Ver resposta<ChevronRight/></Button></TableCell></TableRow>)}</TableBody></Table></div>
        {auditLoading && <div className="audit-loading"><Loader2 className="spin"/>Atualizando auditoria…</div>}
        {!auditLoading && !audit?.rows.length && <MiniEmpty>Nenhuma consulta corresponde aos filtros atuais.</MiniEmpty>}
        <div className="audit-pagination"><span>Página {audit?.page || 1} de {audit?.pages || 1}</span><div><Button size="sm" variant="outline" disabled={!audit || audit.page <= 1 || auditLoading} onClick={() => setAuditPage(page => Math.max(1, page - 1))}><ChevronLeft/>Anterior</Button><Button size="sm" variant="outline" disabled={!audit || audit.page >= audit.pages || auditLoading} onClick={() => setAuditPage(page => page + 1)}>Próxima<ChevronRight/></Button></div></div>
      </section>
    </>}

    {selectedEntity && <EntityDrawer jobId={job.id} entityKey={selectedEntity} mapPin={mapData?.pins.find(pin => pin.entityKey === selectedEntity)} googleProfiles={googleProfiles} onEntity={setSelectedEntity} onTask={setSelectedTask} onClose={() => setSelectedEntity("")}/>} 
    {selectedTask && <TaskEvidenceDrawer taskId={selectedTask} onClose={() => setSelectedTask("")}/>} 
  </div>;
}

function Kpi({icon, value, suffix = "", label, accent = "blue", help}: {icon: React.ReactNode; value: number; suffix?: string; label: string; accent?: string; help: string}) {return <div className={`dashboard-kpi kpi-${accent}`}><div className="dashboard-kpi-icon">{icon}</div><div><strong>{value.toLocaleString("pt-BR")}<small>{suffix}</small></strong><span>{label}</span></div><span className="kpi-help" title={help}><CircleHelp/></span></div>;}
function CardHeader({icon, title, subtitle}: {icon: React.ReactNode; title: string; subtitle: string}) {return <div className="dashboard-card-header"><span>{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div>;}
function MiniEmpty({children}: {children: React.ReactNode}) {return <div className="dashboard-mini-empty">{children}</div>;}

function Frequency({value, label}: {value: number; label: string}) {return <div className={`frequency-meter frequency-${frequencyClass(value)}`}><div><strong>{pct(value)}</strong><span>{label}</span></div><i><b style={{width: `${Math.min(100, Math.max(0, value))}%`}}/></i></div>;}

function CompanyStrength({company, index, onOpen}: {company: DashboardCompany; index: number; onOpen: () => void}) {return <button className="company-strength" onClick={onOpen}><span className="rank-index">{index + 1}</span><div className="company-strength-main"><strong>{company.name}</strong><small>{company.niche} · {[company.neighborhood, company.city].filter(Boolean).join(", ")}</small><Frequency value={company.frequencyPercent} label={company.presenceLabel}/></div><div className="company-strength-numbers"><b>{company.appearances}/{company.validQueries}</b><span>menções</span><b>{company.top1}</b><span>Top 1</span><b>{rank(company.averageRank)}</b><span>posição média</span></div><ChevronRight/></button>;}

function PositionChart({rows}: {rows: {position: number | null; count: number}[]}) {const max = Math.max(1, ...rows.map(row => row.count)); return <div className="position-chart">{rows.length ? rows.map(row => <div className="position-row" key={row.position ?? "unranked"}><span>{row.position == null ? "Sem ranking" : `#${row.position}`}</span><i><b className={row.position == null ? "unranked" : ""} style={{width: `${Math.max(5, row.count / max * 100)}%`}}/></i><strong>{row.count}</strong></div>) : <MiniEmpty>Ainda não há posições extraídas.</MiniEmpty>}</div>;}

function EntityRank({entity, index, onOpen}: {entity: DashboardEntity; index: number; onOpen: () => void}) {return <button className="entity-rank" onClick={onOpen}><span className="rank-index">{index + 1}</span><div><strong>{entity.name}</strong><small>{entity.entityType === "audited" ? "Empresa auditada" : entity.matchStatus === "uncertain_company" ? "Identidade a conferir" : "Concorrente citado"}{entity.cities[0] ? ` · ${entity.cities[0]}` : ""}</small></div><div><b>{entity.queries}</b><span>consultas</span></div><div><b>{entity.top1}</b><span>Top 1</span></div><div><b>{rank(entity.averageRank)}</b><span>posição média</span></div><ChevronRight/></button>;}

function GoogleCompact({profile, loading}: {profile?: GoogleProfile; loading: boolean}) {if (loading && !profile) return <span className="google-compact muted"><Loader2 className="spin"/>consultando</span>; if (!profile) return <span className="muted">—</span>; if (profile.status !== "matched") return <span className="google-compact muted">{profile.status === "ambiguous" ? "Incerto" : profile.status === "not_found" ? "Não localizado" : "Indisponível"}</span>; return <span className="google-compact"><Star/><b>{profile.rating?.toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1}) || "—"}</b></span>;}
function Quality({label, value, total}: {label: string; value: number; total: number}) {const width = total ? value / total * 100 : 0; return <div className="quality-row"><div><span>{label}</span><strong>{value}</strong></div><i><b style={{width: `${width}%`}}/></i></div>;}
function AuditStatus({status}: {status: string}) {const label = status === "mentioned" ? "Recomendada" : status === "absent" ? "Não recomendada" : status === "uncertain" ? "Menção incerta" : "Não avaliável"; return <span className={`audit-result audit-result-${status}`}>{label}</span>;}

function CitationMap({data, onSelect}: {data: DashboardMapResponse | null; onSelect?: (key: string) => void}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const [leafletFailed, setLeafletFailed] = useState(false);

  useEffect(() => {
    if (!data?.configured || !data.pins.length || !mapRef.current) return;
    let cancelled = false;
    loadLeafletAssets()
      .then(L => {
        if (cancelled || !mapRef.current) return;
        setLeafletFailed(false);
        if (!mapInstanceRef.current) {
          const map = L.map(mapRef.current, {
            zoomControl: true,
            scrollWheelZoom: false,
            attributionControl: true,
          });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(map);
          mapInstanceRef.current = map;
          layerGroupRef.current = [];
        }
        const map = mapInstanceRef.current;
        if (Array.isArray(layerGroupRef.current)) {
          layerGroupRef.current.forEach((layer: any) => layer.remove());
          layerGroupRef.current = [];
        }

        const seen = new Map<string, number>();
        const points: [number, number][] = [];
        data.pins.forEach(pin => {
          const key = `${pin.lat.toFixed(5)}:${pin.lng.toFixed(5)}`;
          const overlapIndex = seen.get(key) || 0;
          seen.set(key, overlapIndex + 1);
          const offsetDistance = overlapIndex * 0.0018;
          const offsetAngle = overlapIndex * 0.9;
          const lat = pin.lat + Math.sin(offsetAngle) * offsetDistance;
          const lng = pin.lng + Math.cos(offsetAngle) * offsetDistance;
          points.push([lat, lng]);
          const markerClass = [
            'citation-map-marker-real',
            pin.entityType === 'audited' ? 'audited' : 'competitor',
            pin.top1 > 0 ? 'hot' : '',
          ].filter(Boolean).join(' ');
          const icon = L.divIcon({
            className: 'citation-map-divicon-shell',
            html: `<div class="${markerClass}"><span>${pin.citations}</span></div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -16],
          });
          const marker = L.marker([lat, lng], {icon, keyboard: Boolean(onSelect)}).addTo(map);
          const popup = `
            <div class="citation-map-popup">
              <strong>${escapeHtml(pin.name)}</strong>
              <span>${escapeHtml([pin.neighborhood, pin.city].filter(Boolean).join(', ') || 'Localização confirmada')}</span>
              <span>${escapeHtml(plural(pin.citations, 'consulta', 'consultas'))}${pin.top1 > 0 ? ` · #1 ${escapeHtml(plural(pin.top1, 'vez', 'vezes'))}` : ''}</span>
              ${pin.rating != null ? `<span>Google ${pin.rating.toLocaleString('pt-BR', {maximumFractionDigits: 1})}★</span>` : ''}
            </div>`;
          marker.bindPopup(popup, {closeButton: false, offset: [0, -10]});
          marker.on('mouseover', () => marker.openPopup());
          marker.on('mouseout', () => marker.closePopup());
          if (onSelect) marker.on('click', () => onSelect(pin.entityKey));
          layerGroupRef.current.push(marker);
        });
        if (points.length === 1) {
          map.setView(points[0], 12, {animate: true});
        } else if (points.length > 1) {
          map.fitBounds(L.latLngBounds(points), {padding: [38, 38], animate: true, maxZoom: 12});
        }
        setTimeout(() => map.invalidateSize(), 60);
      })
      .catch(() => {
        if (!cancelled) setLeafletFailed(true);
      });
    return () => {cancelled = true;};
  }, [data, onSelect]);

  useEffect(() => () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    }
  }, []);

  if (!data?.configured) return <div className="map-disabled"><MapPin/><strong>Google Maps não está conectado</strong><span>Adicione GOOGLE_MAPS_API_KEY no backend para localizar os perfis citados.</span></div>;
  if (!data.pins.length) return <div className="map-disabled"><MapPin/><strong>Nenhum ponto confirmado</strong><span>O mapa só posiciona empresas que tiveram correspondência geográfica segura.</span></div>;
  if (leafletFailed) return <div className="map-disabled"><MapPin/><strong>Não foi possível carregar o mapa</strong><span>Verifique se a rede permite carregar o Leaflet e os tiles do OpenStreetMap.</span></div>;
  return <div className="citation-map citation-map-real-wrapper">
    <div ref={mapRef} className="citation-map-real" role="img" aria-label={`Mapa geográfico com ${data.pins.length} empresas citadas localizadas`}/>
    <div className="citation-map-legend"><span><i className="map-dot audited"/>Empresa auditada citada</span><span><i className="map-dot competitor"/>Concorrente citado</span><span><i className="map-dot hot"/>Chegou ao #1</span></div>
  </div>;
}

function EntityDrawer({jobId, entityKey, mapPin, googleProfiles, onEntity, onTask, onClose}: {jobId: string; entityKey: string; mapPin?: DashboardMapPin; googleProfiles: Record<string, GoogleProfile>; onEntity: (key: string) => void; onTask: (id: string) => void; onClose: () => void}) {
  const [detail, setDetail] = useState<DashboardEntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {let cancelled = false; setLoading(true); request<DashboardEntityDetail>(`/api/jobs/${jobId}/dashboard/entities/${encodeURIComponent(entityKey)}`).then(value => {if (!cancelled) setDetail(value);}).catch(error => {if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível abrir a empresa citada.");}).finally(() => {if (!cancelled) setLoading(false);}); return () => {cancelled = true;};}, [jobId, entityKey]);
  const profile = detail?.matchedCompanyId ? googleProfiles[detail.matchedCompanyId] : undefined;
  const google = mapPin || (profile?.status === "matched" ? {rating: profile.rating, reviewCount: profile.reviewCount, address: profile.address, mapsUrl: profile.mapsUrl} : undefined);
  return <div className="dashboard-drawer-backdrop" role="presentation" onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}><aside className="dashboard-drawer" role="dialog" aria-modal="true" aria-label="Detalhes da empresa citada"><button className="drawer-close" onClick={onClose} aria-label="Fechar"><X/></button>{loading || !detail ? <div className="drawer-loading"><Loader2 className="spin"/>Abrindo histórico da empresa…</div> : <><div className="drawer-title"><span className={detail.matchedCompanyId ? "drawer-entity-audited" : "drawer-entity-competitor"}>{detail.matchedCompanyId ? "Empresa auditada" : "Concorrente citado"}</span><h2>{detail.name}</h2><p>{[detail.neighborhoods[0], detail.cities[0]].filter(Boolean).join(", ")} {detail.niches[0] ? `· ${detail.niches[0]}` : ""}</p></div><div className="drawer-metrics"><div><strong>{detail.queries}</strong><span>consultas com citação</span></div><div><strong>{detail.top1}</strong><span>vezes em #1</span></div><div><strong>{rank(detail.averageRank)}</strong><span>posição média</span></div><div><strong>{rank(detail.bestRank)}</strong><span>melhor posição</span></div></div>{google && <section className="drawer-section drawer-google"><div><Star/><strong>Google Business Profile</strong></div><p><b>{google.rating != null ? `${google.rating.toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1})} ★` : "Sem nota"}</b> · {(google.reviewCount || 0).toLocaleString("pt-BR")} avaliações</p>{google.address && <span>{google.address}</span>}{google.mapsUrl && <a href={google.mapsUrl} target="_blank" rel="noreferrer">Abrir no Google Maps</a>}</section>}<section className="drawer-section"><h3>Concorrentes que aparecem junto</h3>{detail.cooccurring.length ? <div className="cooccurring-list">{detail.cooccurring.map(row => <button key={row.entityKey} onClick={() => onEntity(row.entityKey)}><span>{row.name}</span><b>{row.count}</b></button>)}</div> : <p className="muted">Nenhuma coocorrência registrada.</p>}</section><section className="drawer-section"><h3>Aparições auditáveis</h3><div className="occurrence-list">{detail.occurrences.map(row => <button key={`${row.taskId}-${row.mentionOrder}`} onClick={() => onTask(row.taskId)}><div><strong>{row.targetCompany}</strong><span>{row.niche} · {[row.neighborhood, row.city].filter(Boolean).join(", ")}</span></div><div>{row.explicitRank != null ? <b>#{row.explicitRank}</b> : <b>{row.mentionOrder}ª menção</b>}<span>{timeLabel(row.createdAt)}</span></div><ChevronRight/></button>)}</div></section></>}</aside></div>;
}

function TaskEvidenceDrawer({taskId, onClose}: {taskId: string; onClose: () => void}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {let cancelled = false; setLoading(true); request<Detail>(`/api/tasks/${taskId}`).then(value => {if (!cancelled) setDetail(value);}).catch(error => {if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível abrir a evidência.");}).finally(() => {if (!cancelled) setLoading(false);}); return () => {cancelled = true;};}, [taskId]);
  return <div className="dashboard-drawer-backdrop evidence-backdrop" role="presentation" onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}><aside className="dashboard-drawer evidence-drawer" role="dialog" aria-modal="true" aria-label="Evidência da consulta"><button className="drawer-close" onClick={onClose} aria-label="Fechar"><X/></button>{loading || !detail ? <div className="drawer-loading"><Loader2 className="spin"/>Carregando resposta original…</div> : <><div className="drawer-title"><span className="drawer-entity-audited">Evidência da consulta</span><h2>{detail.company_name || detail.niche}</h2><p>{detail.niche} · {[detail.company_neighborhood, detail.company_city].filter(Boolean).join(", ")} · {timeLabel(detail.updated_at)}</p></div><section className="drawer-section evidence-prompt"><h3>Pergunta enviada</h3><p>{detail.prompt}</p><div className="evidence-meta"><span>Pesquisa: <b>{detail.searchModel}</b></span><span>Extração: <b>{detail.extractionModel}</b></span><span>Status: <b>{detail.status}</b></span></div></section><section className="drawer-section"><h3>Resposta original</h3><Answer raw={detail.raw}/>{detail.raw.sources?.length ? <><h4>Fontes retornadas</h4><Sources sources={detail.raw.sources}/></> : <p className="muted">A resposta não registrou fontes estruturadas.</p>}</section><section className="drawer-section"><h3>Empresas extraídas</h3>{detail.result.mentions?.length ? <div className="extracted-mentions">{detail.result.mentions.map((mention, index) => <div key={`${mention.name}-${index}`}><span>{mention.name}</span><b>{mention.position != null ? `#${mention.position}` : `${index + 1}ª menção`}</b></div>)}</div> : <p className="muted">Nenhuma empresa foi extraída desta resposta.</p>}</section></>}</aside></div>;
}
