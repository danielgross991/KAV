"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { KavLoading } from "@/components/kav-loading";

const maxPendingOverlayMs = 9000;

export function FormPendingOverlay() {
  const { pending } = useFormStatus();

  return pending ? <AutoExpiringPendingOverlay /> : null;
}

function AutoExpiringPendingOverlay() {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setExpired(true), maxPendingOverlayMs);
    return () => window.clearTimeout(timeout);
  }, []);

  return expired ? null : <KavLoading label="מבצע פעולה" />;
}
