import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CreateOrderItem = {
  plato_id: string;
  cantidad: number;
};

type CreateOrderInput = {
  restaurante_id: string;
  total: number;
  items: CreateOrderItem[];
};

export async function createOrder(input: CreateOrderInput) {
  const { restaurante_id, total, items } = input;

  // 1. Create order
  const { data: orden, error: ordenError } = await supabase
    .from("ordenes")
    .insert({
      restaurante_id,
      estado: "pendiente",
      total,
      visto: false,
    })
    .select("id")
    .single();

  if (ordenError) {
    throw new Error(ordenError.message);
  }

  // 2. Create order items
  const rows = items.map((item) => ({
    orden_id: orden.id,
    plato_id: item.plato_id,
    cantidad: item.cantidad,
  }));

  const { error: itemsError } = await supabase
    .from("orden_items")
    .insert(rows);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return orden;
}