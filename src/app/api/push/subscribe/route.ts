import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface Body {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/** POST — register this device for reminders (SPEC 6.3). */
export async function POST(request: Request) {
  const user = await requireUser();
  const supabase = await createClient();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** DELETE — unregister this device. */
export async function DELETE(request: Request) {
  const user = await requireUser();
  const supabase = await createClient();
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (endpoint) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
  }
  return NextResponse.json({ ok: true });
}
