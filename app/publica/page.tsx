"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Minus, Plus, Receipt } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Item = {
  id: string;
  nombre: string | null;
  activo: boolean | null;
  seccion: string | null;
  precio: number | null;
  alergenos: string[] | null;
  trazas: string[] | null;
};

type MenuActivo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
};

type TicketData = {
  numeroOrden: number | null;
  cliente: string;
  tipoServicio: "takeaway" | "mesa";
  numeroMesa: string;
  total: number;
  items: Array<{ nombre: string; cantidad: number; precioUnitario: number }>;
  fecha: string;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function PublicPage() {
  const params = useSearchParams();
  const rid = params.get("rid");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [menuActivo, setMenuActivo] = useState<MenuActivo | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [clienteNombre, setClienteNombre] = useState("");
  const [tipoServicio, setTipoServicio] = useState<"takeaway" | "mesa">("takeaway");
  const [numeroMesa, setNumeroMesa] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [ticket, setTicket] = useState<TicketData | null>(null);

  const getNombreItem = (item: Item) => item.nombre ?? "Item sin nombre";
  const hoy = useMemo(
    () =>
      new Date().toLocaleDateString("es-ES", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const groupedItems = useMemo(
    () =>
      Object.entries(
        items.reduce<Record<string, Item[]>>((acc, item) => {
          const key = item.seccion?.trim() || "Sin sección";
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {})
      ),
    [items]
  );

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const item = items.find((i) => i.id === id);
          return { item, qty };
        })
        .filter((row): row is { item: Item; qty: number } => Boolean(row.item)),
    [cart, items]
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (acc, row) => acc + (row.item.precio ?? 0) * row.qty,
        0
      ),
    [cartItems]
  );

  useEffect(() => {
    if (!rid) return;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      const { data: restaurante, error: restError } = await supabase
        .from("restaurantes")
        .select("nombre_restaurante")
        .eq("id", rid)
        .maybeSingle();

      if (restError) {
        setError(`No se pudo cargar el restaurante: ${restError.message}`);
        setLoading(false);
        return;
      }

      setRestaurantName(
        (restaurante?.nombre_restaurante as string | null) ?? "Restaurante"
      );

      const { data: menuData, error: menuError } = await supabase
        .from("menus")
        .select("id, nombre, descripcion, created_at")
        .eq("restaurante_id", rid)
        .eq("activo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (menuError) {
        setError(`No se pudo cargar el menú activo: ${menuError.message}`);
        setLoading(false);
        return;
      }

      if (!menuData) {
        setMenuActivo(null);
        setItems([]);
        setLoading(false);
        return;
      }

      setMenuActivo(menuData as MenuActivo);

      const { data: links, error: linksError } = await supabase
        .from("menu_items")
        .select("item_id")
        .eq("menu_id", menuData.id);

      if (linksError) {
        setError(`No se pudieron cargar los items del menú: ${linksError.message}`);
        setLoading(false);
        return;
      }

      const itemIds = (links ?? [])
        .map((row) => row.item_id as string | null)
        .filter((id): id is string => Boolean(id));

      if (itemIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select("id, nombre, activo, seccion, precio, alergenos, trazas")
        .in("id", itemIds)
        .eq("activo", true)
        .order("created_at", { ascending: false });

      if (itemsError) {
        setError(`No se pudieron cargar los items: ${itemsError.message}`);
        setLoading(false);
        return;
      }

      setItems((itemsData ?? []) as Item[]);
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [rid]);

  const changeQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const next = (prev[itemId] ?? 0) + delta;
      if (next <= 0) {
        const rest = { ...prev };
        delete rest[itemId];
        return rest;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const confirmarCompra = async () => {
    if (!rid) return;
    if (cartItems.length === 0) {
      setError("Añade al menos un item al carrito.");
      return;
    }

    if (!clienteNombre.trim()) {
      setError("Ingresa tu nombre para continuar.");
      return;
    }

    if (tipoServicio === "mesa" && !numeroMesa.trim()) {
      setError("Ingresa número de mesa.");
      return;
    }

    setProcesando(true);
    setError(null);

    const { data: lastOrderRow } = await supabase
      .from("ordenes")
      .select("numero_orden")
      .eq("restaurante_id", rid)
      .order("numero_orden", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrderNumber = ((lastOrderRow?.numero_orden as number | null) ?? 0) + 1;

    const { data: insertedOrder, error: orderError } = await supabase
      .from("ordenes")
      .insert({
        restaurante_id: rid,
        estado: "pendiente",
        total: cartTotal,
        visto: false,
        numero_orden: nextOrderNumber,
        cliente_nombre: clienteNombre.trim(),
        tipo_servicio: tipoServicio,
        numero_mesa: tipoServicio === "mesa" ? numeroMesa.trim() : null,
      })
      .select("id, numero_orden")
      .single();

    if (orderError || !insertedOrder) {
      setError(
        `No se pudo crear la orden. Verifica columnas en 'ordenes' (numero_orden, cliente_nombre, tipo_servicio, numero_mesa). Detalle: ${orderError?.message ?? "sin detalle"}`
      );
      setProcesando(false);
      return;
    }

    const rows = cartItems.map((row) => ({
      orden_id: insertedOrder.id,
      item_id: row.item.id,
      cantidad: row.qty,
    }));

    const { error: itemsError } = await supabase.from("orden_items").insert(rows);

    if (itemsError) {
      setError(`La orden se creó pero falló cargar items: ${itemsError.message}`);
      setProcesando(false);
      return;
    }

    setTicket({
      numeroOrden: (insertedOrder.numero_orden as number | null) ?? null,
      cliente: clienteNombre.trim(),
      tipoServicio,
      numeroMesa: tipoServicio === "mesa" ? numeroMesa.trim() : "",
      total: cartTotal,
      items: cartItems.map((row) => ({
        nombre: getNombreItem(row.item),
        cantidad: row.qty,
        precioUnitario: row.item.precio ?? 0,
      })),
      fecha: new Date().toLocaleString(),
    });

    setCart({});
    setClienteNombre("");
    setNumeroMesa("");
    setProcesando(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <header className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Menú del día</p>
            <h1 className="mt-1 text-3xl font-black text-gray-900">{restaurantName}</h1>
            <p className="mt-1 text-sm text-gray-500">{hoy}</p>
          </header>

          {!rid ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
              Falta el identificador del restaurante en la URL.
            </section>
          ) : loading ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500 shadow-sm">
              Cargando menú activo...
            </section>
          ) : error ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
              {error}
            </section>
          ) : !menuActivo ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
              Este restaurante no tiene un menú activo en este momento.
            </section>
          ) : (
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">{menuActivo.nombre}</h2>
              {menuActivo.descripcion?.trim() && (
                <p className="mt-1 text-sm text-gray-600">{menuActivo.descripcion}</p>
              )}

              <div className="mt-4 space-y-4">
                {groupedItems.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    El menú activo aún no tiene items activos para mostrar.
                  </p>
                ) : (
                  groupedItems.map(([sectionName, sectionItems]) => (
                    <div key={sectionName} className="space-y-2">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">
                        {sectionName}
                      </h3>
                      {sectionItems.map((item) => {
                        const qty = cart[item.id] ?? 0;
                        const price = item.precio ?? 0;
                        return (
                          <article
                            key={item.id}
                            className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-base font-bold text-gray-900">{getNombreItem(item)}</h4>
                              <p className="text-sm font-semibold text-gray-900">{formatMoney(price)}</p>
                            </div>
                            <p className="mt-1 text-xs text-red-700">
                              Alérgenos: {item.alergenos?.length ? item.alergenos.join(", ") : "No declarados"}
                            </p>
                            <p className="mt-1 text-xs text-amber-700">
                              Trazas: {item.trazas?.length ? item.trazas.join(", ") : "No declaradas"}
                            </p>
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => changeQty(item.id, -1)}
                                className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 hover:bg-gray-100"
                                aria-label="Quitar"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="min-w-7 text-center text-sm font-semibold text-gray-800">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => changeQty(item.id, 1)}
                                className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 hover:bg-gray-100"
                                aria-label="Agregar"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900">Tu orden</h3>
            <p className="mt-1 text-xs text-gray-500">Completa tus datos y confirma el pedido.</p>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoServicio("takeaway")}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    tipoServicio === "takeaway"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  Takeaway
                </button>
                <button
                  type="button"
                  onClick={() => setTipoServicio("mesa")}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    tipoServicio === "mesa"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  Mesa
                </button>
              </div>

              {tipoServicio === "mesa" && (
                <input
                  type="text"
                  value={numeroMesa}
                  onChange={(e) => setNumeroMesa(e.target.value)}
                  placeholder="Número de mesa"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              )}
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
              {cartItems.length === 0 ? (
                <p className="text-xs text-gray-500">No hay items seleccionados.</p>
              ) : (
                cartItems.map((row) => (
                  <div key={row.item.id} className="flex justify-between text-sm text-gray-700">
                    <span>{getNombreItem(row.item)} x{row.qty}</span>
                    <span>{formatMoney((row.item.precio ?? 0) * row.qty)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Total</p>
              <p className="text-xl font-black text-gray-900">{formatMoney(cartTotal)}</p>
            </div>

            <button
              type="button"
              onClick={() => void confirmarCompra()}
              disabled={procesando || cartItems.length === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Receipt className="h-4 w-4" />
              {procesando ? "Procesando pago..." : "Pagar y confirmar"}
            </button>
          </section>

          {ticket && (
            <section className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <h3 className="text-lg font-bold text-green-800">Ticket de compra</h3>
              <p className="mt-1 text-xs text-green-700">{ticket.fecha}</p>
              <p className="mt-2 text-sm text-green-900">
                Orden: #{String(ticket.numeroOrden ?? 0).padStart(3, "0")}
              </p>
              <p className="text-sm text-green-900">Cliente: {ticket.cliente}</p>
              <p className="text-sm text-green-900">
                Servicio: {ticket.tipoServicio === "mesa" ? `Mesa ${ticket.numeroMesa}` : "Takeaway"}
              </p>
              <div className="mt-3 space-y-1 rounded-lg border border-green-200 bg-white p-3">
                {ticket.items.map((row, idx) => (
                  <div key={`${row.nombre}-${idx}`} className="flex justify-between text-xs text-gray-700">
                    <span>{row.nombre} x{row.cantidad}</span>
                    <span>{formatMoney(row.precioUnitario * row.cantidad)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-sm font-bold text-green-900">
                <span>Total pagado</span>
                <span>{formatMoney(ticket.total)}</span>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

// PAGE_INFO: Página pública de compra con carrito, checkout y ticket tras confirmar orden.
