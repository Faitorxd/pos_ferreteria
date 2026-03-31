"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Printer, Calendar, DollarSign, Wallet, MinusCircle, FileText, CheckCircle, Loader2 } from "lucide-react";

const supabase = createClient();

export default function CajaPage() {
  const [activeTab, setActiveTab] = useState<'arqueo' | 'egresos'>('arqueo');
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("empleado");

  // FECHA DEL ARQUEO
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // ESTADOS DEL ARQUEO
  const [sales, setSales] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  // ESTADOS NUEVO EGRESO
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
    amount: "0",
    category: "other",
    description: "",
  });

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Auth & Session
    const { data: authData } = await supabase.auth.getUser();
    let currentBranch = null;
    let userId = null;

    if (authData?.user) {
      userId = authData.user.id;
      const { data: profile } = await supabase.from('profiles').select('branch_id, role').eq('id', userId).single();
      if (profile) {
        currentBranch = profile.branch_id;
        setBranchId(currentBranch);
        setUserRole(profile.role);
      }
    }

    // Calcular inicio y fin del día seleccionado localmente
    // Para no lidiar con zonas horarias complicadas, buscamos todo lo que empiece por la fecha
    const startOfDay = new Date(`${selectedDate}T00:00:00.000`).toISOString();
    const endOfDay = new Date(`${selectedDate}T23:59:59.999`).toISOString();

    // 2. Traer Ventas (Solo completed, ignoramos las creadas como 'credit' puro para el flujo físico a menos que queramos mostrarlas. 
    // Wait: Las facturadas como 'credit' son ventas fiadas, igual hay que sumarlas en el reporte Z como "Ventas a Crédito" para control fiscal.)
    const { data: qSales } = await supabase
      .from('sales')
      .select('id, total, payment_method, status')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);
    
    // 3. Traer Abonos de Cartera (Siempre suman dinero físico, usualmente 'cash' o 'transfer')
    const { data: qReceipts } = await supabase
      .from('payment_receipts')
      .select('id, amount, payment_method')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    // 4. Traer Egresos
    const { data: qExpenses } = await supabase
      .from('expenses')
      .select('id, amount, category, description, created_at')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false });

    setSales(qSales || []);
    setReceipts(qReceipts || []);
    setExpenses(qExpenses || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // CALCULO DEL ARQUEO
  const report = useMemo(() => {
    // Inicializar contenedores
    const methodTotals: Record<string, number> = { cash: 0, nequi: 0, debit_card: 0, credit_card: 0, transfer: 0, credit: 0 };
    
    // 1. Sumar Ventas
    let totalFacturado = 0;
    sales.forEach(sale => {
      totalFacturado += sale.total;
      const method = sale.payment_method || 'cash';
      if (methodTotals[method] !== undefined) {
         methodTotals[method] += sale.total;
      }
    });

    // 2. Sumar Entradas por Abonos de Cartera a los métodos de pago
    let totalAbonos = 0;
    receipts.forEach(rec => {
      totalAbonos += rec.amount;
      const method = rec.payment_method || 'cash';
      if (methodTotals[method] !== undefined) {
         methodTotals[method] += rec.amount;
      }
    });

    // 3. Sumar Egresos de Caja Menor (Usualmente afectan al EFECTIVO físico)
    let totalEgresos = 0;
    expenses.forEach(exp => {
       totalEgresos += exp.amount;
    });

    // TOTAL EN CAJA FISICA (Efectivo) = Ventas Efectivo + Abonos Efectivo - Egresos
    const cashNeto = methodTotals['cash'] - totalEgresos;

    return {
      totalFacturado,
      totalAbonos,
      totalEgresos,
      cashNeto,
      methodTotals
    };
  }, [sales, receipts, expenses]);

  const mapPaymentName = (key: string) => {
     const names: any = {
        'cash': 'Efectivo',
        'nequi': 'Nequi',
        'debit_card': 'Tarj. Débito',
        'credit_card': 'Tarj. Crédito',
        'transfer': 'Transferencia Bancaria',
        'credit': 'Fiado a Carteras (CxC)'
     };
     return names[key] || key;
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingExpense(true);
    
    try {
      const amount = Number(newExpense.amount);
      if (amount <= 0) throw new Error("El egreso debe ser mayor a 0.");
      if (!newExpense.description.trim()) throw new Error("Debes justificar el gasto con una descripción.");
      
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('expenses').insert([{
        branch_id: branchId,
        user_id: user?.id,
        amount: amount,
        category: newExpense.category,
        description: newExpense.description
      }]);

      if (error) throw error;
      
      alert("¡Gasto registrado con éxito! Se descontará el valor del Efectivo en el Arqueo.");
      setNewExpense({ amount: "0", category: "other", description: "" });
      fetchData(); // Refrescar reporte diario

    } catch (err: any) {
      alert("Error al registrar egreso: " + err.message);
    } finally {
      setIsSavingExpense(false);
    }
  };

  return (
    <div className="p-8 h-full relative overflow-y-auto print:p-0 print:bg-white">
      
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Caja y Arqueo</h1>
          <p className="text-slate-500 mt-2">Controla los gastos de caja menor y genera el Cierre "Z" Diario.</p>
        </div>
      </div>

      {/* PESTAÑAS (NO IMPRIMIBLES) */}
      <div className="flex gap-2 mb-8 border-b border-slate-200 print:hidden">
        <button 
          onClick={() => setActiveTab('arqueo')}
          className={`px-6 py-3 font-bold border-b-2 transition-all ${activeTab === 'arqueo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Wallet className="w-5 h-5 inline-block mr-2 -mt-1"/> Arqueo Diario (Reporte Z)
        </button>
        <button 
          onClick={() => setActiveTab('egresos')}
          className={`px-6 py-3 font-bold border-b-2 transition-all ${activeTab === 'egresos' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <MinusCircle className="w-5 h-5 inline-block mr-2 -mt-1"/> Caja Menor (Egresos)
        </button>
      </div>

      {/* =========================================
          PESTAÑA 1: ARQUEO DIARIO (REPORTE Z) 
          ========================================= */}
      {activeTab === 'arqueo' && (
         <div className="max-w-3xl mx-auto">
            
            {/* HERRAMIENTAS DE FILTRO - NO IMPRIMIBLES */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex justify-between items-center print:hidden">
               <div className="flex items-center gap-3">
                  <Calendar className="text-slate-400" />
                  <input 
                     type="date" 
                     value={selectedDate} 
                     onChange={(e) => setSelectedDate(e.target.value)}
                     className="border border-slate-300 rounded-lg px-4 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
               </div>
               <button 
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-md"
               >
                  <Printer size={18} /> Imprimir Reporte Z
               </button>
            </div>

            {loading ? (
               <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : (
               /* REPORTE Z (ESTA PARTE ES LA QUE SE IMPRIME USANDO print: ESTILOS NATIVOS) */
               <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 text-slate-800" style={{ fontFamily: 'monospace' }}>
                  
                  <div className="text-center mb-6 border-b-2 border-dashed border-slate-300 print:border-black pb-6">
                     <h2 className="text-2xl font-black uppercase tracking-widest">REPORTE Z - CIERRE DE CAJA</h2>
                     <p className="text-sm mt-2 text-slate-500 print:text-black">Fecha Emitida: {new Date(selectedDate).toLocaleDateString()}</p>
                     <p className="text-sm text-slate-500 print:text-black">Operaciones Procesadas: {sales.length + receipts.length}</p>
                  </div>

                  {/* RESUMEN GLOBAL */}
                  <div className="mb-8">
                     <h3 className="font-bold uppercase mb-3 border-b border-slate-200 print:border-black pb-1 bg-slate-50 print:bg-white">1. Movimientos Brutos (Consolidado)</h3>
                     <div className="flex justify-between items-center mb-2">
                        <span>Total Facturado (Ventas Hoy)</span>
                        <span className="font-bold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(report.totalFacturado)}</span>
                     </div>
                     <div className="flex justify-between items-center mb-2">
                        <span>(+) Recaudos Cartera (Abonos)</span>
                        <span className="font-bold text-blue-600 print:text-black">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(report.totalAbonos)}</span>
                     </div>
                     <div className="flex justify-between items-center mb-2">
                        <span>(-) Salidas de Caja Menor (Egresos)</span>
                        <span className="font-bold text-red-600 print:text-black">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(report.totalEgresos)}</span>
                     </div>
                  </div>

                  {/* DESGLOSE DE DINERO Y CUENTAS CONTABLES */}
                  <div className="mb-8">
                     <h3 className="font-bold uppercase mb-3 border-b border-slate-200 print:border-black pb-1 bg-slate-50 print:bg-white">2. Dinero Físico en Cajón</h3>
                     <div className="flex justify-between items-center mb-2 text-slate-500 print:text-black">
                        <span>Ingresos en Efectivo (Ventas y Abonos)</span>
                        <span>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(report.methodTotals['cash'] || 0)}</span>
                     </div>
                     <div className="flex justify-between items-center mb-2 text-slate-500 print:text-black">
                        <span>Salidas en Efectivo (Egresos físicos)</span>
                        <span>- {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(report.totalEgresos)}</span>
                     </div>
                     
                     <div className="bg-green-50 print:bg-white p-3 rounded-lg border border-green-200 print:border-black mt-3 flex justify-between items-center font-black text-lg text-green-800 print:text-black">
                        <span>EFECTIVO NETO A ENTREGAR:</span>
                        <span>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(report.cashNeto)}</span>
                     </div>
                  </div>

                  <div className="mb-8">
                     <h3 className="font-bold uppercase mb-3 border-b border-slate-200 print:border-black pb-1 bg-slate-50 print:bg-white">3. Ingresos Virtuales (Bancos / Tarjetas)</h3>
                     {['nequi', 'transfer', 'debit_card', 'credit_card'].map(method => (
                        <div key={method} className="flex justify-between items-center mb-2">
                           <span>{mapPaymentName(method)}</span>
                           <span className="font-bold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(report.methodTotals[method] || 0)}</span>
                        </div>
                     ))}
                  </div>

                  <div className="mb-8 border-t-2 border-black pt-4">
                     <h3 className="font-bold uppercase mb-3 text-purple-700 print:text-black">4. Mercancía Fiada (Cuentas por Cobrar generadas hoy)</h3>
                     <div className="flex justify-between items-center bg-purple-50 print:bg-white p-3 rounded-xl border border-purple-100 print:border-black">
                        <span className="font-bold">Total Fiado (Status Crédito)</span>
                        <span className="font-black text-lg">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(report.methodTotals['credit'] || 0)}</span>
                     </div>
                     <p className="text-xs text-slate-400 print:text-black mt-2">Esta mercancía salió del inventario pero no aportó dinero a la sucursal el día de hoy. Debe ser cobrada mediante el módulo de Cartera eventualmente.</p>
                  </div>

                  <div className="mt-16 text-center text-sm pt-8">
                     <p>_____________________________________</p>
                     <p className="mt-2 font-bold">Firma Administrador / Auditor</p>
                     <p className="mt-4 text-xs">Impreso desde POS Ferretería ERP.</p>
                  </div>

               </div>
            )}
         </div>
      )}

      {/* =========================================
          PESTAÑA 2: CAJA MENOR (EGRESOS)
          ========================================= */}
      {activeTab === 'egresos' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:hidden">
            
            {/* PANEL CREAR EGRESO */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 bg-red-50 border-b border-red-100">
                  <h3 className="text-xl font-black text-red-800 flex items-center gap-2"><MinusCircle /> Justificar Salida de Efectivo</h3>
                  <p className="text-red-700 mt-1 text-sm">El monto registrado aquí cruzará directamente en el Reporte Z y restará del cajón físico.</p>
               </div>
               
               <form onSubmit={handleCreateExpense} className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Monto a Retirar del Cajón ($)</label>
                    <input 
                      required 
                      type="text" 
                      value={newExpense.amount ? new Intl.NumberFormat('es-CO').format(Number(newExpense.amount)) : "0"} 
                      onChange={e => {
                        const rawValue = e.target.value.replace(/\D/g, "");
                        setNewExpense({...newExpense, amount: rawValue || "0"});
                      }} 
                      className="block w-full pl-4 pr-4 py-4 text-2xl font-black text-slate-800 border-2 border-slate-200 focus:border-red-400 rounded-xl focus:outline-none" 
                    />
                  </div>

                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">Categoría del Gasto</label>
                     <select 
                        required
                        value={newExpense.category}
                        onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                        className="w-full p-3 border-2 border-slate-200 focus:border-red-400 rounded-xl font-bold bg-white"
                     >
                        <option value="other">Otro (Ajuste de caja, Almuerzos)</option>
                        <option value="services">Servicios Públicos locales</option>
                        <option value="payroll">Adelanto de Nómina / Pago</option>
                        <option value="inventory">Compras Inmediatas a Proveedores Locales</option>
                     </select>
                  </div>

                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">Motivo / Factura Legal</label>
                     <textarea 
                        required
                        placeholder="Ej: Pago de almuerzos o Recarga de minutos..."
                        value={newExpense.description}
                        onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                        className="w-full p-3 border-2 border-slate-200 focus:border-red-400 rounded-xl min-h-[100px]"
                     />
                  </div>

                  <button 
                     type="submit"
                     disabled={isSavingExpense}
                     className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-lg transition-all flex justify-center gap-2"
                  >
                     {isSavingExpense ? <Loader2 className="animate-spin" /> : "Extraer Dinero Oficialmente"}
                  </button>
               </form>
            </div>

            {/* LISTA DE EGRESOS DEL DÍA SELECCIONADO */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
               <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Egresos del día {new Date(selectedDate).toLocaleDateString()}</h3>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {expenses.length === 0 ? (
                     <p className="text-center text-slate-400 py-10">No hubo gastos ni retiros en esta fecha.</p>
                  ) : (
                     expenses.map(e => (
                        <div key={e.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex flex-col gap-2">
                           <div className="flex justify-between items-start">
                              <span className="font-black text-red-600">
                                - {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(e.amount)}
                              </span>
                              <span className="text-xs px-2 py-1 bg-white border border-slate-200 rounded font-bold uppercase">{e.category}</span>
                           </div>
                           <p className="text-sm text-slate-600">{e.description}</p>
                           <p className="text-xs text-slate-400 font-mono text-right">{new Date(e.created_at).toLocaleTimeString()}</p>
                        </div>
                     ))
                  )}
               </div>
            </div>

         </div>
      )}

    </div>
  );
}
