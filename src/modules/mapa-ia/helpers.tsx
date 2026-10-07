import { useState, type ComponentProps, type ReactNode } from "react";
import { api } from "../../services/api";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type { Detail, Source } from "./types";

function modulePath(path: string): string {
  if (!path.startsWith("/api/")) throw new Error("Endereço inválido do Mapa IA.");
  return "/mapa-ia/" + path.slice(5);
}
function errorMessage(error: unknown): string {
  const value = error as {response?: {data?: {error?: string; detail?: unknown}}};
  const message = value.response?.data?.error || value.response?.data?.detail;
  return typeof message === "string" ? message : "Não foi possível concluir. Confira sua conexão e tente novamente.";
}
export async function request<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  try {
    const response = body === undefined ? await api.get(modulePath(path)) : await api.post(modulePath(path), body);
    return response.data as T;
  } catch (error) {throw new Error(errorMessage(error));}
}
export function DownloadLink({path, children, ...props}: Omit<ComponentProps<"a">, "href"> & {path: string}) {
  const [downloading, setDownloading] = useState(false);
  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      // Downloads usam o mesmo Bearer da sessão, inclusive com VITE_API_URL
      // em outro domínio ou com o prefixo /api do Nginx.
      const response = await api.get(modulePath(path), {responseType: "blob"});
      const header = String(response.headers["content-disposition"] || "");
      const encodedName = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const filename = encodedName ? decodeURIComponent(encodedName) : "mapa-ia-exportacao";
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      const value = error as {response?: {data?: Blob | {error?: string; detail?: unknown}}};
      if (value.response?.data instanceof Blob) {
        try {value.response.data = JSON.parse(await value.response.data.text());} catch { /* Resposta sem JSON. */ }
      }
      toast.error(errorMessage(value));
    } finally {setDownloading(false);}
  }
  return <a {...props} href="#" aria-busy={downloading} aria-disabled={downloading} onClick={event => {event.preventDefault(); void download();}}>{children}</a>;
}
export const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const labels: Record<string, string> = {pending: "Identificar", review: "Revisar cadastro", ready: "Confirmado", excluded: "Fora da análise", mentioned: "Com menção", absent: "Sem menção", uncertain: "Conferir menção", queued: "Na fila", running: "Em andamento", completed: "Concluída", failed: "Falha", partial: "Com falhas", paused: "Pausada", stopped: "Encerrada"};
export const timeLabel = (date: string) => new Date(date).toLocaleString("pt-BR", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"});
export function Badge({status, children}: {status: string; children?: ReactNode}) {return <span className={`status status-${status}`}>{children || labels[status] || status}</span>;}
export function Field({label, children, hint}: {label: string; children: ReactNode; hint?: string}) {return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;}
export function Choice({value, onChange, options, label, disabled = false}: {value: string; onChange: (value: string) => void; options: {value: string; label: string}[]; label: string; disabled?: boolean}) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className="choice"><SelectValue placeholder={label}/></SelectTrigger><SelectContent position="popper">{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
export function host(url: string) {try {return new URL(url).hostname.replace(/^www\./, "");} catch {return "Site";}}
export function Sources({sources}: {sources: Source[]}) {return <ul className="sources">{sources.map((s, i) => <li key={`${s.url}-${i}`}><a href={s.url} target="_blank" rel="noreferrer">{s.title || host(s.url)}</a><small>{host(s.url)}</small></li>)}</ul>;}
export function Answer({raw}: {raw: Detail["raw"]}) {
  const chars = Array.from(raw.text || "");
  let cursor = 0;
  const nodes: ReactNode[] = [];
  for (const [i, a] of [...(raw.annotations || [])].sort((a, b) => a.start - b.start).entries()) {
    if (a.start < cursor || a.start < 0 || a.end > chars.length || a.end <= a.start) continue;
    nodes.push(chars.slice(cursor, a.start).join(""));
    nodes.push(<a key={i} href={a.url} target="_blank" rel="noreferrer" title={a.title}>{chars.slice(a.start, a.end).join("")}</a>);
    cursor = a.end;
  }
  nodes.push(chars.slice(cursor).join(""));
  return <div className="raw-answer">{nodes}</div>;
}
