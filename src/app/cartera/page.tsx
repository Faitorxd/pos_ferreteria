"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, MapPin, CheckCircle, FileText, Banknote, Printer, X, Loader2, DollarSign } from "lucide-react";

const supabase = createClient();

export default function CarteraPage() {
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);

  // Estados Abono Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");

  // Estado Recibo de Caja (Impresión)
  const [receiptData, setReceiptData] = useState<any>(null);

  const fetchDebts = async () => {
    setLoading(true);
    // 1. Obtener Sede actual
    const { data: authData } = await supabase.auth.getUser();
    let currentBranch = null;
    if (authData?.user) {
      const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', authData.user.id).single();
      if (profile?.branch_id) currentBranch = profile.branch_id;
      setBranchId(currentBranch);
    }

    // 2. Traer Deudas (Cuentas por Cobrar) que pertenezcan a mi sede, incluyendo datos del cliente
    // Dado que el "join" en select() de supabase usa la relación de FK, 'customers(name, document_id)'
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select(`
        id, total_amount, paid_amount, status, created_at,
        customers ( id, name, document_id )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setDebts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDebts();
  }, []);

  const openPaymentModal = (debt: any) => {
    setSelectedDebt(debt);
    const balance = debt.total_amount - debt.paid_amount;
    setPaymentAmount(balance.toString()); // Sugerir pago total por defecto
    setIsModalOpen(true);
    setReceiptData(null); // Ocultar recibo previo si lo hay
  };

  const processPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;
    setIsProcessing(true);

    try {
      const amountToPay = Number(paymentAmount);
      const currentBalance = selectedDebt.total_amount - selectedDebt.paid_amount;
      
      if (amountToPay <= 0) throw new Error("El abono debe ser mayor a cero.");
      if (amountToPay > currentBalance) throw new Error("No puedes abonar más del saldo pendiente.");

      const { data: { user } } = await supabase.auth.getUser();

      // 1. Insertar Recibo de Caja (Historial)
      const { data: receiptInsert, error: receiptError } = await supabase
        .from('payment_receipts')
        .insert([{
          branch_id: branchId,
          account_receivable_id: selectedDebt.id,
          user_id: user?.id,
          amount: amountToPay,
          payment_method: paymentMethod
        }])
        .select()
        .single();
        
      if (receiptError) throw receiptError;

      // 2. Actualizar Deuda Principal (Saldo y Estado)
      const newPaidAmount = selectedDebt.paid_amount + amountToPay;
      const newStatus = newPaidAmount >= selectedDebt.total_amount ? 'paid' : 'pending';

      const { error: debtError } = await supabase
        .from('accounts_receivable')
        .update({ paid_amount: newPaidAmount, status: newStatus })
        .eq('id', selectedDebt.id);

      if (debtError) throw debtError;

      alert(`¡Abono de $${amountToPay} registrado correctamente!`);
      
      // Preparar data para el "Recibo de Impresión - PDF"
      setReceiptData({
        receiptId: receiptInsert.id,
        date: new Date().toLocaleString(),
        customerName: selectedDebt.customers.name,
        customerRef: selectedDebt.customers.document_id,
        paid: amountToPay,
        oldBalance: currentBalance,
        newBalance: currentBalance - amountToPay,
      });

      // Cerramos modal y recargamos vista, PERO MANTENEMOS EL RECIBO ACTIVO PARA IMPRIMIR
      setIsModalOpen(false);
      fetchDebts();

    } catch (err: any) {
      alert(err.message || "Ocurrió un error al procesar el pago");
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <>
      <div className="p-8 h-full relative print:hidden">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800">Cartera (Cuentas por Cobrar)</h1>
            <p className="text-slate-500 mt-2">Gestiona los saldos pendientes de tus clientes (Fiados / Créditos).</p>
          </div>
        </div>

        {/* ALERTA / RECIBO DE CAJA LISTO PARA IMPRIMIR */}
        {receiptData && (
          <div className="mb-8 bg-green-50 border border-green-200 rounded-xl p-6 flex justify-between items-center shadow-sm">
            <div>
              <h3 className="text-green-800 font-bold text-lg flex items-center gap-2"><CheckCircle /> Abono Registrado con Éxito</h3>
              <p className="text-green-700 mt-1 text-sm">El recibo de caja de <strong>{receiptData.customerName}</strong> está listo para ser guardado en PDF o impreso.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setReceiptData(null)} className="px-4 py-2 bg-white text-slate-600 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">Cerrar</button>
              <button 
                onClick={() => window.print()} 
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md flex items-center gap-2"
              >
                <Printer size={18} /> Imprimir Recibo PDF
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder="Buscar por número de factura o cliente..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold">Factura (Deuda)</th>
                  <th className="px-6 py-4 font-semibold">Total Crédito</th>
                  <th className="px-6 py-4 font-semibold">Total Pagado</th>
                  <th className="px-6 py-4 font-semibold">Saldo Pendiente</th>
                  <th className="px-6 py-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">Cargando cartera activa...</td></tr>
                ) : debts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      ¡Excelente! No tienes cuentas por cobrar pendientes. No hay clientes con deudas activas.
                    </td>
                  </tr>
                ) : (
                  debts.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{d.customers?.name || 'Cliente desconocido'}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">CC {d.customers?.document_id}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm font-mono">
                        {d.id.split('-')[0].toUpperCase()}
                        <div className="text-xs text-slate-400 mt-1">{new Date(d.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(d.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-green-600 font-medium">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(d.paid_amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-3 py-1 rounded-full font-bold text-sm bg-red-100 text-red-700">
                          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(d.total_amount - d.paid_amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => openPaymentModal(d)}
                          className="bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm inline-flex items-center gap-2"
                        >
                          <Banknote size={16} /> Recibir Abono
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL PARA PROCESAR EL ABONO */}
        {isModalOpen && selectedDebt && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
                <h3 className="text-xl font-black text-blue-900 flex items-center gap-2"><DollarSign /> Recibir Abono de Cartera</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-blue-400 hover:text-blue-600 bg-white rounded-full p-1"><X size={20} /></button>
              </div>

              <form onSubmit={processPayment} className="p-6">
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                  <div className="text-sm text-slate-500 mb-1">Cliente</div>
                  <div className="font-bold text-slate-800 text-lg">{selectedDebt.customers?.name}</div>
                  <hr className="my-3 border-slate-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-600">Saldo Pendiente (Deuda Actual):</span>
                    <span className="text-xl font-black text-red-600">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(selectedDebt.total_amount - selectedDebt.paid_amount)}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-black text-slate-700 mb-2">Forma de Pago</label>
                  <select 
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full p-3 rounded-xl font-bold border-2 border-slate-200 focus:border-blue-500 bg-white"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="nequi">Nequi</option>
                    <option value="debit_card">Tarjeta Débito</option>
                    <option value="credit_card">Tarjeta Crédito</option>
                    <option value="transfer">Pago por Cuenta Bancaria</option>
                  </select>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-black text-slate-700 mb-2">¿Cuánto dinero entrega el cliente?</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-slate-400 font-bold">$</span>
                    </div>
                    <input 
                      required 
                      type="text" 
                      value={paymentAmount ? new Intl.NumberFormat('es-CO').format(Number(paymentAmount)) : ""} 
                      onChange={e => {
                        const rawValue = e.target.value.replace(/\D/g, "");
                        setPaymentAmount(rawValue);
                      }} 
                      className="block w-full pl-8 pr-4 py-4 text-2xl font-black text-slate-800 border-2 border-slate-200 focus:border-blue-500 rounded-xl focus:outline-none" 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isProcessing} 
                  className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : "Confirmar e Imprimir Recibo"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* VISTA PARA IMPRESIÓN (PDF PDF NATIVO DEL NAVEGADOR)        */}
      {/* ========================================================= */}
      {receiptData && (
        <div className="hidden print:block absolute inset-0 bg-white p-8 text-black" style={{ fontFamily: 'monospace', maxWidth: '80mm', margin: '0 auto' }}>
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold uppercase border-b-2 border-black pb-2 mb-2">Recibo de Caja</h1>
            <p className="text-sm font-bold">POS FERRETERIA</p>
            <p className="text-xs">COMPROBANTE DE PAGO (ABONO)</p>
          </div>

          <div className="mb-4 text-sm">
            <p><strong>FECHA:</strong> {receiptData.date}</p>
            <p><strong>RECIBO NRO:</strong> {receiptData.receiptId.split('-')[0].toUpperCase()}</p>
            <p className="mt-2"><strong>CLIENTE:</strong> {receiptData.customerName}</p>
            <p><strong>CC/NIT:</strong> {receiptData.customerRef}</p>
          </div>
          
          <hr className="border-t-2 border-dashed border-black my-4" />

          <div className="text-sm mb-4">
            <div className="flex justify-between mb-1">
              <span>Saldo Anterior:</span>
              <span>{new Intl.NumberFormat('es-CO').format(receiptData.oldBalance)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg mb-1">
              <span>VALOR ABONO:</span>
              <span>{new Intl.NumberFormat('es-CO').format(receiptData.paid)}</span>
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-black">
              <span>Nuevo Saldo a Pagar:</span>
              <span>{new Intl.NumberFormat('es-CO').format(receiptData.newBalance)}</span>
            </div>
          </div>

          <div className="text-center mt-12 text-xs">
            <p>___________________________________</p>
            <p className="mt-1">FIRMA CLIENTE ACEPTA</p>
            <p className="mt-4">=== ¡Gracias por tu pago! ===</p>
          </div>
        </div>
      )}
    </>
  );
}
