import type { PeriodInput } from "@/lib/finance";

export type DashboardPeriods = {
  today: PeriodInput;
  month: PeriodInput;
};

export function getDashboardPeriods(now = new Date()): DashboardPeriods {
  const end = validateNow(now);
  const todayStart = new Date(end);
  todayStart.setHours(0, 0, 0, 0);

  return {
    today: { start: todayStart, end },
    month: { start: new Date(end.getFullYear(), end.getMonth(), 1), end },
  };
}

function validateNow(now: Date): Date {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("data atual deve ser valida.");
  }

  return now;
}
