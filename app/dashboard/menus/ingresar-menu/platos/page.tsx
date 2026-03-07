"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LegacyIngresarMenuPlatosPage() {
  const router = useRouter();
  const params = useSearchParams();
  const menuId = params.get("menuId");

  useEffect(() => {
    const destination = menuId
      ? `/dashboard/menus/platos?menuId=${menuId}`
      : "/dashboard/menus";
    router.replace(destination);
  }, [menuId, router]);

  return null;
}

// PAGE_INFO: Ruta legacy que redirige al listado de platos del menú.
