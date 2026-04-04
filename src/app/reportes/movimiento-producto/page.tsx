"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  ArrowLeft, Search, TrendingUp, TrendingDown, Package,
  Loader2, ArrowUpCircle, ArrowDownCircle, RefreshCw
} from "lucide-react";
import Link from "next/link";

const supabase = createClient();

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const formatDate = (d: string) =>
  new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface Movement {
  date: string;
  type: "entrada" | "salida";
  origin: string;         // "Compra a proveedor" | "Venta POS"
  qty: number;
  unit_price: number;
  balance_after: number;  // saldo calculado acumulado
  ref_id: string;
}

export default function MovimientoProductoPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [searchProduct, setSearchProduct] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Cargar productos
  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, barcode, stock, price")
      .order("name")
      .then(({ data }) => {
        if (data) setProducts(data);
        setLoadingProducts(false);
      });
  }, []);

  // Cuando cambia el producto seleccionado
  useEffect(() => {
    if (!selectedProductId) { setMovements([]); return; }
    fetchMovements(selectedProductId);
  }, [selectedProductId]);

  const fetchMovements = async (productId: string) => {
    setLoadingMovements(true);

    // 1. Entradas: ventas de purchase_items (compras a proveedor)
    const { data: purchaseItems } = await supabase
      .from("purchase_items")
      .select("*, purchases(created_at, supplier_id, suppliers(name))")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    // 2. Salidas: sale_items (ventas POS)
    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("*, sales(created_at, id)")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    // 3. Combinar y ordenar cronológicamente
    const entries: Movement[] = (purchaseItems || []).map((pi: any) => ({
      date: pi.purchases?.created_at || pi.created_at,
      type: "entrada",
      origin: `Compra — ${pi.purchases?.suppliers?.name || "Proveedor desconocido"}`,
      qty: Number(pi.quantity),
      unit_price: Number(pi.unit_cost || 0),
      balance_after: 0, // se calculará después
      ref_id: pi.id,
    }));

    const exits: Movement[] = (saleItems || []).map((si: any) => ({
      date: si.sales?.created_at || si.created_at,
      type: "salida",
      origin: `Venta #${(si.sales?.id || "").slice(0, 8).toUpperCase()}`,
      qty: Number(si.quantity),
      unit_price: Number(si.unit_price || 0),
      balance_after: 0,
      ref_id: si.id,
    }));

    const all = [...entries, ...exits].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 4. Calcular saldo acumulado (Kardex)
    // Punto de partida: saldo actual del producto + salidas - entradas (retrocalculamos)
    // Más simple: empezamos en 0 y acumulamos. El saldo final debe coincidir con product.stock.
    let running = 0;
    const withBalance = all.map((m) => {
      if (m.type === "entrada") running += m.qty;
      else running -= m.qty;
      return { ...m, balance_after: running };
    });

    setMovements(withBalance);
    setLoadingMovements(false);
  };

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
          (p.barcode || "").includes(searchProduct)
      ),
    [products, searchProduct]
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const totalEntradas = movements
    .filter((m) => m.type === "entrada")
    .reduce((s, m) => s + m.qty, 0);

  const totalSalidas = movements
    .filter((m) => m.type === "salida")
    .reduce((s, m) => s + m.qty, 0);

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50/50">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/reportes"
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-500" />
            Movimiento de Producto (Kardex)
          </h1>
          <p className="text-slate-500 mt-1">
            Selecciona un producto para ver su historial completo de entradas y salidas.
          </p>
        </div>
      </div>

      {/* Selector de Producto */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <label className="block text-sm font-bold text-slate-700 mb-3">
          1. Selecciona el Producto a Auditar
        </label>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o código de barras..."
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {loadingProducts ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin w-6 h-6 text-indigo-400" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-56 overflow-y-auto pr-1">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                className={`text-left border rounded-xl px-4 py-3 transition-all text-sm font-semibold ${
                  selectedProductId === p.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-800 shadow-md ring-1 ring-indigo-400"
                    : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
              >
                <p className="truncate font-bold">{p.name}</p>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Stock: <strong className="text-slate-700">{p.stock}</strong>
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resultado */}
      {!selectedProductId ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-semibold">Selecciona un producto arriba para ver su Kardex</p>
        </div>
      ) : (
        <>
          {/* Stats del producto */}
          {selectedProduct && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800 text-white rounded-2xl p-5 shadow-lg flex flex-col justify-between md:col-span-1">
                <Package className="w-7 h-7 text-slate-400 mb-3" />
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase">Producto</p>
                  <p className="text-lg font-black leading-tight mt-1">{selectedProduct.name}</p>
                  <p className="text-xs font-mono text-slate-500 mt-1">
                    {selectedProduct.barcode || "Sin código"}
                  </p>
                </div>
              </div>

              <div className="bg-emerald-500 text-white rounded-2xl p-5 shadow-lg">
                <ArrowUpCircle className="w-7 h-7 text-emerald-200 mb-3" />
                <p className="text-xs font-semibold text-emerald-100 uppercase">Total Entradas</p>
                <p className="text-3xl font-black">+{totalEntradas}</p>
                <p className="text-sm text-emerald-100 mt-1">unidades ingresadas</p>
              </div>

              <div className="bg-rose-500 text-white rounded-2xl p-5 shadow-lg">
                <ArrowDownCircle className="w-7 h-7 text-rose-200 mb-3" />
                <p className="text-xs font-semibold text-rose-100 uppercase">Total Salidas</p>
                <p className="text-3xl font-black">-{totalSalidas}</p>
                <p className="text-sm text-rose-100 mt-1">unidades vendidas</p>
              </div>

              <div className="bg-indigo-600 text-white rounded-2xl p-5 shadow-lg">
                <TrendingUp className="w-7 h-7 text-indigo-200 mb-3" />
                <p className="text-xs font-semibold text-indigo-200 uppercase">Saldo Actual</p>
                <p className="text-3xl font-black">{selectedProduct.stock}</p>
                <p className="text-sm text-indigo-200 mt-1">en inventario ahora</p>
              </div>
            </div>
          )}

          {/* Tabla Kardex */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-500" />
                Cronología de Movimientos
              </h3>
            </div>
            <div className="overflow-x-auto">
              {loadingMovements ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="animate-spin w-8 h-8 text-indigo-400" />
                </div>
              ) : movements.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-semibold">
                    No hay movimientos registrados para este producto.
                  </p>
                  <p className="text-sm mt-1">
                    Registra una compra a proveedor o realiza una venta desde el POS.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-4 font-semibold">Fecha y Hora</th>
                      <th className="px-6 py-4 font-semibold">Tipo</th>
                      <th className="px-6 py-4 font-semibold">Origen / Referencia</th>
                      <th className="px-6 py-4 font-semibold text-right">Cantidad</th>
                      <th className="px-6 py-4 font-semibold text-right">Precio Unit.</th>
                      <th className="px-6 py-4 font-semibold text-right bg-indigo-50/50">
                        Saldo Acum.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m, idx) => (
                      <tr key={m.ref_id + idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                          {formatDate(m.date)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${
                              m.type === "entrada"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {m.type === "entrada" ? (
                              <ArrowUpCircle className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownCircle className="w-3.5 h-3.5" />
                            )}
                            {m.type === "entrada" ? "Entrada" : "Salida"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                          {m.origin}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`font-black text-base ${
                              m.type === "entrada" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {m.type === "entrada" ? "+" : "-"}
                            {m.qty}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 text-sm font-medium">
                          {m.unit_price > 0 ? COP(m.unit_price) : "—"}
                        </td>
                        <td className="px-6 py-4 text-right bg-indigo-50/40 border-l border-indigo-100">
                          <span className="font-black text-indigo-800 text-lg">
                            {m.balance_after}
                          </span>
                          <span className="text-xs text-indigo-400 ml-1">unds</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
