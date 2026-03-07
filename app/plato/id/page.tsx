"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LegacyPlatoByIdPage() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  useEffect(() => {
    if (!id) {
      router.replace("/registro");
      return;
    }
    router.replace(`/plato/${id}`);
  }, [id, router]);

  return null;
}

// PAGE_INFO: Ruta legacy /plato/id?id=... que redirige a /plato/[id].
