"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, DollarSign, Clock, CheckCircle, HandCoins, Building2, Truck } from "lucide-react";

const supabase = createClient();

export default function CuentasPorPagarPage() {
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);

  // Modal de Abono
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("transfer");

  const fetchDebts = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    let currentBranch = null;

    if (authData?.user) {
      const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', authData.user.id).single();
      if (profile?.branch_id) {
        currentBranch = profile.branch_id;
        setBranchId(currentBranch);
      }
    }

    // Traer las facturas por pagar y cruzar con la info del Proveedor
    const { data } = await supabase
      .from('accounts_payable')
      .select('*, suppliers(name, phone, document_id), purchases(invoice_ref, created_at)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (data) setDebts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDebts();
  }, []);

  const openPaymentModal = (debt: any) => {
    setSelectedDebt(debt);
    const pendingAmount = debt.total_amount - debt.paid_amount;
    setPaymentAmount(pendingAmount.toString());
    setIsModalOpen(true);
  };

  const processPayment = async () => {
    if (!selectedDebt || !branchId) return;
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const amountToPay = Number(paymentAmount.replace(/\D/g, ""));
      const currentDebt = selectedDebt.total_amount - selectedDebt.paid_amount;

      if (amountToPay <= 0) throw new Error("El abono debe ser mayor a cero.");
      if (amountToPay > currentDebt) throw new Error("El abono no puede superar la deuda actual.");

      const newPaidAmount = selectedDebt.paid_amount + amountToPay;
      const newStatus = newPaidAmount >= selectedDebt.total_amount ? 'paid' : 'pending';

      // 1. Actualizar CxP
      const { error: updateError } = await supabase
        .from('accounts_payable')
        .update({ paid_amount: newPaidAmount, status: newStatus })
        .eq('id', selectedDebt.id);

      if (updateError) throw updateError;

      // 2. Si se paga con Efectivo de la Caja registradora, generar un Egreso
      if (paymentMethod === 'cash') {
         await supabase.from('expenses').insert([{
            branch_id: branchId,
            user_id: user?.id,
            amount: amountToPay,
            category: 'inventory',
            description: `Abono a Factura Prov. #${selectedDebt.purchases?.invoice_ref || 'N/A'} - Proveedor: ${selectedDebt.suppliers?.name}`
         }]);
      }

      alert("¡Abono al proveedor registrado exitosamente!");
      setIsModalOpen(false);
      fetchDebts();

    } catch (err: any) {
      alert("Error procesando abono: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 h-full relative overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-rose-800 flex items-center gap-3">
             <Building2 className="text-rose-500" /> Cuentas por Pagar (CxP)
          </h1>
          <p className="text-slate-500 mt-2">Facturas de compra que la ferretería le está debiendo a los proveedores.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-rose-500" /></div>
        ) : debts.length === 0 ? (
          <div className="col-span-full bg-rose-50/50 border-2 border-dashed border-rose-200 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
            <CheckCircle className="w-16 h-16 text-rose-300 mb-4" />
            <h2 className="text-2xl font-black text-rose-800 mb-2">Paz y Salvo</h2>
            <p className="text-rose-600 font-medium">No le debemos plata a ningún proveedor actualmente en esta sede.</p>
          </div>
        ) : (
          debts.map((debt) => {
            const pending = debt.total_amount - debt.paid_amount;
            const progress = (debt.paid_amount / debt.total_amount) * 100;
            const isOverdue = debt.due_date && new Date(debt.due_date) < new Date();

            return (
              <div key={debt.id} className={`bg-white rounded-2xl shadow-sm border ${isOverdue ? 'border-red-300 shadow-red-100' : 'border-slate-200'} overflow-hidden flex flex-col`}>
                <div className={`p-5 flex justify-between items-start border-b ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Truck size={16}/> {debt.suppliers?.name}</h3>
                    <div className="text-xs font-mono text-slate-500 mt-1">Factura/Ref: {debt.purchases?.invoice_ref || 'S/N'}</div>
                  </div>
                  {isOverdue && <span className="bg-red-100 text-red-700 text-xs font-black px-2 py-1 rounded-md uppercase">Vencida</span>}
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-4">
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Deuda Pendiente</div>
                    <div className="text-4xl font-black text-rose-600">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(pending)}
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                       <span>Total Factura: {new Intl.NumberFormat('es-CO').format(debt.total_amount)}</span>
                       <span>Abonado: {new Intl.NumberFormat('es-CO').format(debt.paid_amount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                      <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                    </div>

                    <button 
                      onClick={() => openPaymentModal(debt)}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm shadow-rose-200 flex items-center justify-center gap-2"
                    >
                      <HandCoins size={18} /> Efectuar Pago a Proveedor
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && selectedDebt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-start gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-rose-500 shrink-0">
                <HandCoins size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">Cruce de Cuentas: Pagar</h3>
                <p className="text-slate-500 text-sm font-medium">Abonando a {selectedDebt.suppliers?.name}</p>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
                <div className="text-sm text-slate-500 font-semibold mb-1">Saldo Actual Adeudado</div>
                <div className="text-2xl font-black text-slate-800">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(selectedDebt.total_amount - selectedDebt.paid_amount)}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">Método por donde salió el dinero</label>
                  <select 
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full p-3 rounded-xl font-bold border-2 border-slate-200 focus:border-rose-500 bg-white"
                  >
                    <option value="transfer">Transferencia Bancaria / App</option>
                    <option value="cash">Efectivo de la Caja Registradora</option>
                    <option value="cheque">Cheque</option>
                  </select>
                  {paymentMethod === 'cash' && (
                     <p className="text-xs font-bold text-red-500 mt-2">⚠️ Advertencia: Si usas esta opción, el Reporte Z de hoy se le restará esta cantidad en billetes.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">¿Cuánto dinero le enviamos?</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input 
                      type="text" 
                      value={paymentAmount ? new Intl.NumberFormat('es-CO').format(Number(paymentAmount.replace(/\D/g, ""))) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setPaymentAmount(raw);
                      }}
                      className="w-full pl-8 pr-4 py-4 text-xl font-black text-slate-800 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100" 
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  disabled={isProcessing}
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  disabled={isProcessing}
                  onClick={processPayment} 
                  className="flex-[2] bg-rose-600 hover:bg-rose-700 text-white py-3 px-4 rounded-xl font-black shadow-lg shadow-rose-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Salida de Dinero"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
