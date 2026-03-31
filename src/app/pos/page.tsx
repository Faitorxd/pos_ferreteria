"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ShoppingCart, Trash2, Plus, Minus, Loader2, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export default function POSPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("cash");

  useEffect(() => {
    const initData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', authData.user.id).single();
        if (profile?.branch_id) setBranchId(profile.branch_id);
      }

      const { data: prods } = await supabase.from('products').select('*');
      if (prods) setProducts(prods);

      const { data: custs } = await supabase.from('customers').select('*').order('name');
      if (custs) {
        setCustomers(custs);
        const defaultCust = custs.find(c => c.name === 'Consumidor Final');
        if (defaultCust) setSelectedCustomerId(defaultCust.id);
      }
      
      setLoading(false);
    };

    initData();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode === searchTerm
  );

  const addToCart = (product: any) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          alert("¡Stock insuficiente!");
          return prevCart;
        }
        return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        if (product.stock < 1) {
          alert("No hay stock disponible");
          return prevCart;
        }
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (productId: string) => setCart(prevCart => prevCart.filter(item => item.id !== productId));

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty < 1) return item;
        if (newQty > item.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);

  const handleCheckout = async (paymentMethodType: string) => {
    if (cart.length === 0) return;
    setProcessing(true);

    try {
      if (!branchId) throw new Error("Error de sesión: Sede no encontrada.");

      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      
      // ===== REGLAS DE NEGOCIO ERP =====
      if (paymentMethodType === 'credit') {
         if (!selectedCustomer || selectedCustomer.name === 'Consumidor Final') {
           throw new Error("No puedes fiarle a 'Consumidor Final'. Selecciona o registra un cliente real.");
         }
         
         const { data: debts } = await supabase
           .from('accounts_receivable')
           .select('total_amount, paid_amount')
           .eq('customer_id', selectedCustomerId)
           .eq('status', 'pending');
         
         const currentDebt = debts?.reduce((acc, curr) => acc + (curr.total_amount - curr.paid_amount), 0) || 0;
         
         if ((currentDebt + total) > selectedCustomer.credit_limit) {
           throw new Error(`¡Venta Bloqueada! El cliente ${selectedCustomer.name} superó su cupo de crédito.\nDeuda actual: \$${currentDebt}\nIntenta fiar: \$${total}\nCupo Máximo: \$${selectedCustomer.credit_limit}`);
         }
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      // 1. Crear Venta
      const { data: saleData, error: saleError } = await supabase.from('sales').insert([{ 
        total, 
        status: paymentMethodType === 'credit' ? 'credit' : 'completed', 
        payment_method: paymentMethodType, 
        user_id: userId, 
        branch_id: branchId,
        customer_id: selectedCustomerId || null
      }]).select().single();
      
      if (saleError) throw saleError;

      // 2. Crear Detalle
      const saleItemsData = cart.map(item => ({
        branch_id: branchId,
        sale_id: saleData.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
      }));
      const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);
      if (itemsError) throw itemsError;

      // 3. Descontar Stock
      for (const item of cart) {
        await supabase.from('products').update({ stock: item.stock - item.quantity }).eq('id', item.id);
      }

      // 4. Si es a crédito, registrar en Cartera (CxC) automáticamente
      if (paymentMethodType === 'credit') {
         await supabase.from('accounts_receivable').insert([{
            branch_id: branchId,
            customer_id: selectedCustomerId,
            sale_id: saleData.id,
            total_amount: total,
            paid_amount: 0,
            status: 'pending'
         }]);
      }

      alert(paymentMethodType === 'credit' ? "¡Venta a Crédito (Fiada) procesada!" : "¡Venta de Contado completada!");
      setCart([]);
      
      const { data: updatedProducts } = await supabase.from('products').select('*');
      if (updatedProducts) setProducts(updatedProducts);

    } catch (err: any) {
      alert(err.message || "Error al procesar el pago");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <header className="mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-slate-800">Caja Registradora</h2>
        </header>

        <div className="relative mb-6 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            autoFocus
            className="block w-full pl-11 pr-4 py-4 border border-slate-200 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500 text-lg"
            placeholder="Buscar producto o escanear código de barras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} onClick={() => addToCart(product)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition-all active:scale-95 flex flex-col h-full">
                  <div className="h-24 bg-slate-50 flex items-center justify-center rounded-lg mb-3 overflow-hidden">
                    {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-2 mix-blend-darken" /> : <span className="text-xs text-slate-400">Sin imagen</span>}
                  </div>
                  <h3 className="font-bold text-slate-700 leading-tight mb-auto text-sm">{product.name}</h3>
                  <div className="flex justify-between items-end mt-4">
                    <span className="text-blue-600 font-bold text-lg">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">Stock: {product.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-[420px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-xl z-10">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-800">Ticket Actual</h3>
          </div>
        </div>
        
        <div className="flex-1 p-3 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-70">
              <p>El ticket está vacío.</p>
            </div>
          ) : (
            <div className="space-y-3"> 
              {cart.map(item => (
                <div key={item.id} className="flex flex-col p-3 border border-slate-100 rounded-xl bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-700 text-sm pe-4">{item.name}</h4>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <button onClick={() => updateQuantity(item.id, -1)} className="px-2 py-1 hover:bg-slate-200 active:bg-slate-300"><Minus size={14} /></button>
                      <span className="px-3 font-bold bg-white">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, +1)} className="px-2 py-1 hover:bg-slate-200 active:bg-slate-300"><Plus size={14} /></button>
                    </div>
                    <span className="font-bold text-slate-800">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200">
          
          <div className="mb-6 flex flex-col gap-2 relative">
             <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Users size={16}/> Cliente Asignado</label>
             <select 
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="w-full border border-slate-300 p-2 rounded-lg font-bold text-slate-700 bg-white"
             >
                <option value="" disabled>Seleccionar un cliente...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.document_id}</option>
                ))}
             </select>
          </div>

          <div className="flex justify-between items-center mb-6">
            <span className="text-slate-500 font-bold">TOTAL:</span>
            <span className="text-3xl font-black text-slate-900">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total)}
            </span>
          </div>

          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">Método de Pago</label>
            <select 
              value={selectedPaymentMethod}
              onChange={e => setSelectedPaymentMethod(e.target.value)}
              className={`w-full p-3 rounded-xl font-bold border-2 focus:outline-none transition-colors ${
                selectedPaymentMethod === 'credit' 
                  ? 'border-purple-400 bg-purple-50 text-purple-900' 
                  : 'border-blue-400 bg-blue-50 text-blue-900'
              }`}
            >
              <option value="cash">Efectivo</option>
              <option value="nequi">Nequi</option>
              <option value="debit_card">Tarjeta Débito</option>
              <option value="credit_card">Tarjeta Crédito</option>
              <option value="transfer">Pago por Cuenta Bancaria</option>
              <option value="credit" className="font-black text-purple-600">Crédito (Cartera / Fiado)</option>
            </select>
          </div>
          
          <button 
             disabled={cart.length === 0 || processing}
             onClick={() => handleCheckout(selectedPaymentMethod)}
             className={`w-full text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2 ${
               selectedPaymentMethod === 'credit' 
                 ? 'bg-purple-600 hover:bg-purple-700 focus:ring-4 focus:ring-purple-200' 
                 : 'bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-200'
             }`}
          >
             {processing ? <Loader2 className="animate-spin w-6 h-6" /> : (selectedPaymentMethod === 'credit' ? "Procesar Venta a Crédito" : "Facturar Compra")}
          </button>

        </div>
      </div>
    </div>
  );
}
