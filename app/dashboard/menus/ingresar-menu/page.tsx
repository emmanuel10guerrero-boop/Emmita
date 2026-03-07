"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyIngresarMenuPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/menus");
  }, [router]);

  return null;
}

// PAGE_INFO: Pantalla intermedia de ingreso/selección de menú.
