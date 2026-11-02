export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** 102 → "01:42" */
export function formatTime(seconds: number) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

/** 1.5 → "1½", 0.25 → "¼", 600 → "600" */
export function formatAmount(amount: number) {
  const whole = Math.floor(amount);
  const fraction = FRACTIONS[String(Math.round((amount - whole) * 100) / 100)];

  if (fraction) return whole ? `${whole}${fraction}` : fraction;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}
