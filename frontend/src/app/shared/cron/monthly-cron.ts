/** Simple mode of the cron field: "day N of every month" or "last day of the month". */
export type MonthlyDay = number | 'L';

const MONTHLY = /^0 0 0 (L|[1-9]|[12]\d|3[01]) \* \*$/;

export function monthlyCron(day: MonthlyDay): string {
  return `0 0 0 ${day} * *`;
}

/** Day of a simple monthly expression, or null when the expression needs the advanced mode. */
export function parseMonthlyCron(expression: string | null | undefined): MonthlyDay | null {
  const match = MONTHLY.exec((expression ?? '').trim());
  if (!match) {
    return null;
  }
  return match[1] === 'L' ? 'L' : Number(match[1]);
}
