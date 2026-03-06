"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LegacyIngresarMenuNuevoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const menuId = params.get("menuId");

  useEffect(() => {
    const destination = menuId
      ? `/dashboard/menus/nuevo?menuId=${menuId}`
      : "/dashboard/menus";
    router.replace(destination);
  }, [menuId, router]);

  return null;
}
