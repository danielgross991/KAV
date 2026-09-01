"use client";

import { useFormStatus } from "react-dom";

import { KavLoading } from "@/components/kav-loading";

export function FormPendingOverlay() {
  const { pending } = useFormStatus();

  return pending ? <KavLoading label="מבצע פעולה" /> : null;
}
