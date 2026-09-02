import { getMonthActivity } from "@/lib/stats";
import { today } from "@/lib/date";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const month = today().slice(0, 7);
  const data = await getMonthActivity(month);
  return <CalendarClient month={month} initial={data} todayISO={today()} />;
}
