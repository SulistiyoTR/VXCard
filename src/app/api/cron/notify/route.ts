import { NextResponse } from "next/server";
import webpush from "web-push";
import { env } from "@/lib/env";
import { today } from "@/lib/date";
import { currentStreak } from "@/lib/streak";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Daily reminder job (SPEC 6.3). Wired to Vercel Cron in vercel.json.
 * Sends a push to anyone who hasn't finished a session today and has either
 * words due or a live streak to protect.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  webpush.setVapidDetails(env.vapidSubject(), env.vapidPublic(), env.vapidPrivate());
  const admin = createAdminClient();
  const day = today();
  const startOfDay = `${day}T00:00:00.000Z`;

  const { data: subs } = await admin.from("push_subscriptions").select("*");
  const byUser = new Map<string, SubRow[]>();
  for (const s of (subs ?? []) as SubRow[]) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  let sent = 0;
  for (const [userId, userSubs] of byUser) {
    const [{ data: doneToday }, { count: due }, { data: completed }] = await Promise.all([
      admin
        .from("sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("completed", true)
        .gte("started_at", startOfDay)
        .limit(1),
      admin
        .from("words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .lte("due_date", day),
      admin.from("sessions").select("started_at").eq("user_id", userId).eq("completed", true),
    ]);

    if (doneToday && doneToday.length > 0) continue;

    const streak = currentStreak(
      (completed ?? []).map((r) => (r.started_at as string).slice(0, 10)),
      day,
    );

    let body: string | null = null;
    if ((due ?? 0) > 0) body = `${due} words waiting`;
    else if (streak > 0) body = `Keep your ${streak}-day streak`;
    if (!body) continue;

    const payload = JSON.stringify({ title: "VX Card", body, url: "/" });
    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
