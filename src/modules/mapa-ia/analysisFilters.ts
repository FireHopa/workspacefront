import type { Company, Result } from "./types";

export type ResultFilters = {q: string; niche: string; presence: string; city: string; order: string};
export const defaultResultFilters: ResultFilters = {q: "", niche: "all", presence: "all", city: "all", order: "original"};
export const filterKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const compare = (a: string, b: string) => filterKey(a) < filterKey(b) ? -1 : filterKey(a) > filterKey(b) ? 1 : 0;

export function filterResults(results: Result[], filters: ResultFilters, companies: Company[]) {
  const people = new Map(companies.map(c => [c.id, c.participants.map(p => p.name)]));
  const query = filterKey(filters.q);
  const selected = results.filter(r => {
    const text = filterKey([r.name, r.original_name, r.niche, r.actual_neighborhood || "", r.actual_city || "", ...(people.get(r.id) || r.participants?.map(p => p.name) || [])].join(" "));
    return (!query || text.includes(query)) &&
      (filters.niche === "all" || filterKey(r.niche) === filterKey(filters.niche)) &&
      (filters.presence === "all" || r.status === filters.presence) &&
      (filters.city === "all" || (filterKey(r.actual_city || "") || "__missing__") === filterKey(filters.city));
  });
  if (filters.order.startsWith("frequency_")) {
    const sign = filters.order === "frequency_desc" ? -1 : 1;
    selected.sort((a, b) => Number(a.validQueries === 0) - Number(b.validQueries === 0) || sign * (a.appearances / Math.max(1, a.validQueries) - b.appearances / Math.max(1, b.validQueries)) || compare(a.name, b.name));
  } else if (filters.order === "position") {
    selected.sort((a, b) => (a.bestPosition ?? Infinity) - (b.bestPosition ?? Infinity) || compare(a.name, b.name));
  } else if (filters.order === "name") {
    selected.sort((a, b) => compare(a.name, b.name));
  }
  return selected;
}
