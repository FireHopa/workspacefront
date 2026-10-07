import type { NicheSuggestion } from "./types";

export function nextNicheSuggestion(suggestions: NicheSuggestion[], blocked: boolean, paused: boolean, includeDeferred: boolean) {
  if (blocked) return null;
  return (!paused ? suggestions.find(s => s.status === "pending") : undefined) ||
    (includeDeferred ? suggestions.find(s => s.status === "deferred") : undefined) || null;
}
