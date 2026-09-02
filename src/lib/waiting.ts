export interface WaitingIndicator {
  count: number;
  tone: "none" | "plain" | "warn" | "urgent";
  message: string;
  hint?: string;
}

/** "N words waiting" indicator (SPEC 4.2), thresholds relative to the daily quota. */
export function waitingIndicator(count: number, quota: number): WaitingIndicator {
  if (count === 0) {
    return { count, tone: "none", message: "Nothing due — free practice" };
  }
  const label = `${count} ${count === 1 ? "word" : "words"} waiting`;
  if (count > quota * 4) {
    return {
      count,
      tone: "urgent",
      message: label,
      hint: "Try more per session, or pause adding new words.",
    };
  }
  if (count > quota * 2) {
    return { count, tone: "warn", message: label };
  }
  return { count, tone: "plain", message: label };
}
