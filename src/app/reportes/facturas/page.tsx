"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  ArrowLeft, Search, FileText, X, ShoppingBag,
  Calendar, CreditCard, User, Loader2, ChevronRight, Package
} from "lucide-react";
import Link from "next/link";

const supabase = createClient();

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const formatDate = (d: string) =>
  new Date(d).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  nequi: "Nequi",
  debit_card: "Tarjeta Débito",
  credit_card: "Tarjeta Crédito",
  transfer: "Transferencia",
  credit: "Crédito / Fiado",
};

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  credit: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-700",
};

export default function FacturasPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    let query = supabase
      .from("sales")
      .select("*, customers(name, document_id), profiles(email)")
      .order("created_at", { ascending: false });

    if (dateFilter === "today") {
      const today = new Date().toISOString().split("T")[0];
      query = query.gte("created_at", today + "T00:00:00Z");
    } else if (dateFilter === "this_month") {
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      query = query.gte("created_at", firstDay);
    }

    const { data } = await query;
    if (data) setSales(data);
    setLoading(false);
  };

  useEffect(() => { fetchSales(); }, [dateFilter]);

  const openDetail = async (sale: any) => {
    setSelectedSale(sale);
    setLoadingItems(true);
    const { data } = await supabase
      .from("sale_items")
      .select("*, products(name, barcode, image_url)")
      .eq("sale_id", sale.id);
    setSaleItems(data || []);
    setLoadingItems(false);
  };

  const filtered = sales.filter((s) => {
    const term = search.toLowerCase();
    return (
      s.id.includes(term) ||
      (s.customers?.name || "").toLowerCase().includes(term) ||
      (s.profiles?.email || "").toLowerCase().includes(term)
    );
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + Number(s.total), 0);

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
            <FileText className="w-8 h-8 text-blue-500" /> Historial de Facturas
          </h1>
          <p className="text-slate-500 mt-1">
            Consulta, busca y revisa el detalle de cada venta registrada.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Facturas</p>
            <p className="text-2xl font-black text-slate-900">{filtered.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4 md:col-span-2">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Recaudado</p>
            <p className="text-2xl font-black text-slate-900">{COP(totalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, cajero o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { key: "all", label: "Todas" },
            { key: "today", label: "Hoy" },
            { key: "this_month", label: "Este Mes" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                dateFilter === f.key
                  ? "bg-white shadow text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">ID Factura</th>
                <th className="px-6 py-4 font-semibold">Fecha</th>
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Cajero</th>
                <th className="px-6 py-4 font-semibold">Método</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
                <th className="px-6 py-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <Loader2 className="animate-spin w-8 h-8 mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    No hay facturas que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                    onClick={() => openDetail(sale)}
                  >
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      #{sale.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(sale.created_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 text-sm">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {sale.customers?.name || "Consumidor Final"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-blue-600 font-medium">
                      {sale.profiles?.email || "—"}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wide">
                      {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs ${
                          STATUS_STYLE[sale.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {sale.status === "completed"
                          ? "Pagada"
                          : sale.status === "credit"
                          ? "Crédito"
                          : sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-right text-slate-900">
                      {COP(Number(sale.total))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 hover:text-blue-500 transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLE DE FACTURA */}
      {selectedSale && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-blue-500" />
                  Factura #{selectedSale.id.slice(0, 8).toUpperCase()}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {formatDate(selectedSale.created_at)}
                </p>
              </div>
              <button
                onClick={() => { setSelectedSale(null); setSaleItems([]); }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-500 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Rápida */}
            <div className="grid grid-cols-3 gap-0 border-b border-slate-100">
              <div className="px-6 py-3 border-r border-slate-100">
                <p className="text-xs text-slate-400 font-semibold uppercase">Cliente</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {selectedSale.customers?.name || "Consumidor Final"}
                </p>
              </div>
              <div className="px-6 py-3 border-r border-slate-100">
                <p className="text-xs text-slate-400 font-semibold uppercase">Método de Pago</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {PAYMENT_LABELS[selectedSale.payment_method] || selectedSale.payment_method}
                </p>
              </div>
              <div className="px-6 py-3">
                <p className="text-xs text-slate-400 font-semibold uppercase">Estado</p>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs mt-0.5 ${
                    STATUS_STYLE[selectedSale.status] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {selectedSale.status === "completed"
                    ? "Pagada"
                    : selectedSale.status === "credit"
                    ? "Crédito"
                    : selectedSale.status}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              {loadingItems ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
                </div>
              ) : saleItems.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  No se encontraron ítems para esta factura.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                      <th className="px-6 py-3 font-semibold">Producto</th>
                      <th className="px-6 py-3 font-semibold text-center">Cantidad</th>
                      <th className="px-6 py-3 font-semibold text-right">P. Unitario</th>
                      <th className="px-6 py-3 font-semibold text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {saleItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 flex items-center gap-3">
                          {item.products?.image_url ? (
                            <img
                              src={item.products.image_url}
                              alt={item.products?.name}
                              className="w-10 h-10 object-contain rounded-lg border border-slate-100 bg-white p-1"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-800 text-sm">
                              {item.products?.name || "Producto eliminado"}
                            </p>
                            <p className="text-xs font-mono text-slate-400">
                              {item.products?.barcode || "—"}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-blue-100 text-blue-800 font-black text-sm px-3 py-1 rounded-full">
                            x{item.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 font-medium text-sm">
                          {COP(Number(item.unit_price))}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">
                          {COP(Number(item.subtotal))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Total Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-500">
                {saleItems.length} artículo(s) en esta factura
              </span>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-semibold uppercase">Total Factura</p>
                <p className="text-2xl font-black text-slate-900">{COP(Number(selectedSale.total))}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
