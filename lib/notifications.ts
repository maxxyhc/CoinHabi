import { Capacitor } from "@capacitor/core";
import { formatCurrency } from "@/lib/calculations";
import { tx } from "@/lib/i18n";
import type { Debt, Locale, RecurringExpense } from "@/lib/types";

/**
 * On-device payment / subscription reminders via @capacitor/local-notifications.
 * Fully free (no server, no push service). Every call is a guarded no-op on the
 * web / during SSR; only fires inside the native app.
 */

const DEFAULT_LEAD_DAYS = 3;

function isNative() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/** Stable positive 31-bit int id derived from an item id, so re-syncs replace cleanly. */
function notificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000;
}

function reminderDate(dueDate: string, leadDays: number): Date | null {
  const due = new Date(`${dueDate}T09:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const remind = new Date(due);
  remind.setDate(remind.getDate() - Math.max(0, leadDays));
  return remind > new Date() ? remind : null;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch {
    return false;
  }
}

/**
 * Reschedules all payment reminders from the current data. When `enabled` is
 * false (or on web) it simply clears any pending reminders.
 */
export async function syncReminders(
  recurringExpenses: RecurringExpense[],
  debts: Debt[],
  locale: Locale,
  enabled: boolean,
): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    if (!enabled) return;

    const title = tx(locale, "Payment reminder");
    const notifications = [];

    for (const expense of recurringExpenses) {
      if (!expense.is_active) continue;
      const at = reminderDate(expense.next_due_date, expense.reminder_days ?? DEFAULT_LEAD_DAYS);
      if (!at) continue;
      notifications.push({
        id: notificationId(`recurring:${expense.id}`),
        title,
        body: tx(locale, "{name} · {amount} is due on {date}", {
          name: expense.name,
          amount: formatCurrency(expense.amount, expense.currency),
          date: expense.next_due_date,
        }),
        schedule: { at },
      });
    }

    for (const debt of debts) {
      if (!debt.is_active) continue;
      const at = reminderDate(debt.next_payment_date, DEFAULT_LEAD_DAYS);
      if (!at) continue;
      notifications.push({
        id: notificationId(`debt:${debt.id}`),
        title,
        body: tx(locale, "{name} · {amount} is due on {date}", {
          name: debt.name,
          amount: formatCurrency(debt.minimum_payment, debt.currency),
          date: debt.next_payment_date,
        }),
        schedule: { at },
      });
    }

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch {
    // Reminders are best-effort; never break the app over them.
  }
}
