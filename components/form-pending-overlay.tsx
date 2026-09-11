"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { KavLoading } from "@/components/kav-loading";

const pendingOverlayDelayMs = 350;
const maxPendingOverlayMs = 9000;

export function FormPendingOverlay() {
  const { pending } = useFormStatus();

  return pending ? <AutoExpiringPendingOverlay /> : null;
}

function AutoExpiringPendingOverlay() {
  const [expired, setExpired] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimeout = window.setTimeout(() => setVisible(true), pendingOverlayDelayMs);
    const expireTimeout = window.setTimeout(() => setExpired(true), maxPendingOverlayMs);
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(expireTimeout);
    };
  }, []);

  return expired || !visible ? null : <KavLoading label="מבצע פעולה" />;
}
