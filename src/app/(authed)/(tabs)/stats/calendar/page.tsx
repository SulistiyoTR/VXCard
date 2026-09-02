"use client";

import { today } from "@/lib/date";
import { useAppData } from "@/lib/store/provider";
import { CalendarClient } from "./CalendarClient";

export default function CalendarPage() {
  const { sessions } = useAppData();
  return <CalendarClient sessions={sessions} todayISO={today()} />;
}
