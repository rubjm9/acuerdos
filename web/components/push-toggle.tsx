"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Activa/desactiva los avisos push en este dispositivo. */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) return;
    setSupported(true);
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setEnabled(Boolean(sub));
    });
  }, [vapidPublicKey]);

  async function toggle() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setEnabled(false);
        toast.success("Avisos desactivados en este dispositivo");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("El navegador no concedió permiso de notificaciones");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
        });
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        setEnabled(true);
        toast.success("Avisos activados en este dispositivo");
      }
    } catch {
      toast.error("No se pudo cambiar el estado de los avisos");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={busy}>
      {enabled ? (
        <>
          <BellOff className="size-4" aria-hidden /> Desactivar avisos aquí
        </>
      ) : (
        <>
          <BellRing className="size-4" aria-hidden /> Activar avisos en este dispositivo
        </>
      )}
    </Button>
  );
}
