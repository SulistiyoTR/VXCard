"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "checking" | "unsupported" | "needs-install" | "idle" | "on" | "denied" | "working";

export function EnableReminders() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState("unsupported");

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;
      if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
        return setState("needs-install");
      }
      if (Notification.permission === "denied") return setState("denied");

      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "idle");
    })();
  }, []);

  async function enable() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "idle");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("no vapid key");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState("on");
    } catch {
      setState("idle");
    }
  }

  if (state === "checking" || state === "unsupported") return null;

  if (state === "needs-install") {
    return (
      <p className="text-center text-sm text-text-faint">
        Add VX Card to your home screen to turn on reminders.
      </p>
    );
  }
  if (state === "denied") {
    return (
      <p className="text-center text-sm text-text-faint">
        Reminders are blocked in your browser settings.
      </p>
    );
  }
  if (state === "on") {
    return <p className="text-center text-sm text-good">Daily reminders are on.</p>;
  }

  return (
    <Button variant="secondary" onClick={enable} disabled={state === "working"}>
      {state === "working" ? "…" : "Turn on daily reminders"}
    </Button>
  );
}
