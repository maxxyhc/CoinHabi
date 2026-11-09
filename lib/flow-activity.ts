import type { CashflowTransaction } from "./types";

// Keep only IDs in this tab, so refreshing does not lose unseen activity.
const storageKey = "coinhabi-flow-activity-v1";
let pending: { id: string; time: number }[] = [];
function restore() {
  if (typeof window === "undefined") return;
  try {
    const items: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) || "[]");
    if (Array.isArray(items)) pending = items.filter((item): item is { id: string; time: number } =>
      !!item && typeof item.id === "string" && typeof item.time === "number").slice(-30);
  } catch { /* In-memory playback still works when storage is unavailable. */ }
}
function persist() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(storageKey, JSON.stringify(pending)); } catch { /* Optional storage. */ }
}
export function queueFlowActivity(id: string) {
  restore();
  pending = [...pending.filter(item => item.id !== id), { id, time: Date.now() }].slice(-30);
  persist();
}
export function takeFlowActivity(transactions: CashflowTransaction[], month: string) {
  restore();
  pending = pending.filter(item => Date.now() - item.time < 60 * 60 * 1000);
  const rows = transactions.filter(row => row.transaction_date.slice(0, 7) === month);
  const item = pending.find(item => rows.some(row => row.id === item.id));
  if (!item) { persist(); return null; }
  const row = rows.find(row => row.id === item.id)!;
  const branch = row.transaction_type === "income" ? "income" : row.category === "investment" ? "investment" : "expense";
  // Combine successive entries for the same destination into one short effect.
  pending = pending.filter(item => !rows.some(other => other.id === item.id &&
    (other.transaction_type === "income" ? "income" : other.category === "investment" ? "investment" : "expense") === branch));
  persist();
  return { id: item.id, branch };
}
