"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Loader2, Package, TrendingUp, Search } from "lucide-react";
import Link from "next/link";

const supabase = createClient();

export default function InventarioSaldosReport() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // 1. Fetch products
    supabase.from('products').select('*').order('name').then(({ data: prods }) => {
       if (prods) {
          // As stated before, if we don't track dynamic unit_cost in the product table, 
          // we mock current cost as 70% of price (or average from purchases if we had complex SQL).
          // For ERP Phase 6, we will estimate cost = price * 0.7 for simplicity if not available.
          const enriched = prods.map(p => ({
             ...p,
             estimated_cost: p.price * 0.7,
          }));
          setProducts(enriched);
       }
       setLoading(false);
    });
  }, []);

  const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  const totalPhysicalItems = filtered.reduce((acc, p) => acc + p.stock, 0);
  const totalValuation = filtered.reduce((acc, p) => acc + (p.stock * p.estimated_cost), 0);
  const totalExpectedRetail = filtered.reduce((acc, p) => acc + (p.stock * p.price), 0);

  return (
    <div className="p-8 h-full relative overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/reportes" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-slate-800">Saldos de Inventario (Kardex Valorizado)</h1>
          <p className="text-slate-500 mt-1">Conoce el dinero real que tienes parqueado físicamente en las repisas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg border border-slate-700 text-white flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4 text-slate-300">
               <Package className="w-8 h-8 opacity-50" />
               <span className="text-sm font-bold bg-slate-700/50 px-3 py-1 rounded-full">TOTAL UNIDADES</span>
            </div>
            <div>
               <h3 className="text-4xl font-black">{new Intl.NumberFormat('es-CO').format(totalPhysicalItems)} <span className="text-lg text-slate-400 font-medium">ítems</span></h3>
            </div>
         </div>

         <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-2xl shadow-lg border border-blue-500 text-white flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4 text-blue-200">
               <TrendingUp className="w-8 h-8 opacity-50" />
               <span className="text-sm font-bold bg-blue-500/50 px-3 py-1 rounded-full">INVERSIÓN (COSTO)</span>
            </div>
            <div>
               <h3 className="text-4xl font-black">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalValuation)}
               </h3>
               <p className="text-blue-200 text-sm mt-1">Plata real invertida en estanterías</p>
            </div>
         </div>

         <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-2xl shadow-lg border border-emerald-400 text-white flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4 text-emerald-100">
               <TrendingUp className="w-8 h-8 opacity-50" />
               <span className="text-sm font-bold bg-emerald-400/50 px-3 py-1 rounded-full">PROYECCIÓN VENTAS</span>
            </div>
            <div>
               <h3 className="text-4xl font-black">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalExpectedRetail)}
               </h3>
               <p className="text-emerald-100 text-sm mt-1">Si vendieras todo el stock hoy al detal</p>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
           <div className="relative w-80">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                 type="text" 
                 placeholder="Buscar producto a auditar..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
              />
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Producto y Ref</th>
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right">Existencias</th>
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right bg-blue-50/30">Costo Unitario (Est.)</th>
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right bg-emerald-50/30">Valor Venta (PVP)</th>
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right bg-slate-50">Costo Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr><td colSpan={5} className="p-10 text-center text-slate-400"><Loader2 className="animate-spin w-8 h-8 mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                 <tr><td colSpan={5} className="p-10 text-center font-semibold text-slate-500">No hay productos en tu inventario local.</td></tr>
              ) : (
                 filtered.map(p => (
                   <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                         <div className="font-bold text-slate-800">{p.name}</div>
                         <div className="text-xs font-mono text-slate-400">REF: {p.barcode || 'S/N'}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className={`px-2 py-1 rounded text-sm font-bold ${p.stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-800'}`}>
                            {p.stock} unds
                         </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-500 text-right bg-blue-50/30 border-l border-r border-slate-100">
                         {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.estimated_cost)}
                      </td>
                      <td className="px-6 py-4 font-medium text-emerald-600 text-right bg-emerald-50/30 border-r border-slate-100">
                         {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.price)}
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800 text-right bg-slate-50">
                         {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.stock * p.estimated_cost)}
                      </td>
                   </tr>
                 ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
