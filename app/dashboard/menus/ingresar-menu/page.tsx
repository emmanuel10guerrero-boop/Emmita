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
