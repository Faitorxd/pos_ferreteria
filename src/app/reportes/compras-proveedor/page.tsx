"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Loader2, Truck, CreditCard, Filter } from "lucide-react";
import Link from "next/link";

const supabase = createClient();

export default function ComprasProveedorReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch suppliers and their purchases
    const fetchData = async () => {
       const { data: purchasesData } = await supabase
         .from('purchases')
         .select('*, suppliers(id, name, nit, category)');
       
       if (purchasesData) {
          // Agrupar por proveedor
          const grouped = purchasesData.reduce((acc, curr) => {
             const suppId = curr.supplier_id;
             if (!acc[suppId]) {
                acc[suppId] = {
                   supplier: curr.suppliers || { name: 'Proveedor Desconocido o Eliminado' },
                   totalBuys: 0,
                   totalAmount: 0,
                   totalPaid: 0,
                   purchases: []
                };
             }
             acc[suppId].totalBuys += 1;
             acc[suppId].totalAmount += Number(curr.total_amount);
             acc[suppId].totalPaid += Number(curr.amount_paid);
             acc[suppId].purchases.push(curr);
             return acc;
          }, {});

          setData(Object.values(grouped));
       }
       setLoading(false);
    };

    fetchData();
  }, []);

  const totalGlobalAmount = data.reduce((acc, obj) => acc + obj.totalAmount, 0);
  const totalGlobalDebt = data.reduce((acc, obj) => acc + (obj.totalAmount - obj.totalPaid), 0);

  return (
    <div className="p-8 h-full relative overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/reportes" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-slate-800">Compras Consolidadas por Proveedor</h1>
          <p className="text-slate-500 mt-1">Acumulado histórico de adquisición de mercancía B2B.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
         <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-2xl shadow-lg border border-indigo-500 text-white flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4 text-indigo-200">
               <Truck className="w-8 h-8 opacity-50" />
               <span className="text-sm font-bold bg-indigo-500/50 px-3 py-1 rounded-full">TOTAL COMPRADO (HISTÓRICO)</span>
            </div>
            <div>
               <h3 className="text-4xl font-black">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalGlobalAmount)}
               </h3>
               <p className="text-indigo-200 text-sm mt-1">Suma de todas las facturas de ingreso registradas</p>
            </div>
         </div>

         <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-6 rounded-2xl shadow-lg border border-rose-400 text-white flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4 text-rose-200">
               <CreditCard className="w-8 h-8 opacity-50" />
               <span className="text-sm font-bold bg-rose-400/50 px-3 py-1 rounded-full">DEUDA ACTUAL CONSOLIDADA</span>
            </div>
            <div>
               <h3 className="text-4xl font-black">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalGlobalDebt)}
               </h3>
               <p className="text-rose-100 text-sm mt-1">Pendiente por Pagar (Cuentas por Pagar Restantes)</p>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
           <h3 className="font-bold text-slate-700 flex items-center gap-2">
             <Filter size={18} />
             Ranking de Proveedores
           </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Proveedor y Detalles</th>
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-center">Facturas</th>
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right">Monto Total Adquirido</th>
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right">Amortizado (Pagado)</th>
                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right bg-rose-50/50 text-rose-600">Saldo Pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr><td colSpan={5} className="p-10 text-center text-slate-400"><Loader2 className="animate-spin w-8 h-8 mx-auto" /></td></tr>
              ) : data.length === 0 ? (
                 <tr><td colSpan={5} className="p-10 text-center font-semibold text-slate-500">Todavía no has registrado compras a proveedores.</td></tr>
              ) : (
                 data.sort((a,b) => b.totalAmount - a.totalAmount).map((prov, idx) => (
                   <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                         <div className="font-bold text-slate-800">{prov.supplier.name}</div>
                         <div className="text-xs font-mono text-slate-400 mt-1">NIT: {prov.supplier.nit || 'GENÉRICO'} • {prov.supplier.category || 'Sin Categoría'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <span className="px-3 py-1 rounded bg-slate-100 text-slate-700 text-sm font-bold">
                            {prov.totalBuys}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700 text-right">
                         {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(prov.totalAmount)}
                      </td>
                      <td className="px-6 py-4 font-medium text-emerald-600 text-right">
                         {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(prov.totalPaid)}
                      </td>
                      <td className="px-6 py-4 font-black text-rose-600 text-right bg-rose-50/20">
                         {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(prov.totalAmount - prov.totalPaid)}
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
