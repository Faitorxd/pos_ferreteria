"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ShoppingCart, Trash2, Plus, Minus, Loader2, Truck, FileText } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export default function ComprasPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  
  // Proveedores y Referencias
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [purchaseType, setPurchaseType] = useState<string>("contado");
  const [invoiceRef, setInvoiceRef] = useState<string>("");

  useEffect(() => {
    const initData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', authData.user.id).single();
        if (profile?.branch_id) setBranchId(profile.branch_id);
      }

      const { data: prods } = await supabase.from('products').select('*');
      if (prods) setProducts(prods);

      const { data: sups } = await supabase.from('suppliers').select('*').order('name');
      if (sups) setSuppliers(sups);
      
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
        return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prevCart, { ...product, quantity: 1, unit_cost: product.price * 0.7 }]; // Costo default sugerido (30% margen)
      }
    });
  };

  const removeFromCart = (productId: string) => setCart(prevCart => prevCart.filter(item => item.id !== productId));

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty < 1) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateUnitCost = (productId: string, costStr: string) => {
    const rawValue = costStr.replace(/\D/g, "");
    setCart(prevCart => prevCart.map(item => 
       item.id === productId ? { ...item, unit_cost: Number(rawValue) } : item
    ));
  };

  const total = useMemo(() => cart.reduce((sum, item) => sum + (item.unit_cost * item.quantity), 0), [cart]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);

    try {
      if (!branchId) throw new Error("Error de sesión: Sede no encontrada.");

      if (purchaseType !== 'traslado' && !selectedSupplierId) {
         throw new Error("Debe seleccionar un Proveedor para compras oficiales.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      // 1. Crear Compra (Cabecera)
      const { data: purchaseData, error: purchaseError } = await supabase.from('purchases').insert([{ 
        total, 
        type: purchaseType, 
        user_id: userId, 
        branch_id: branchId,
        supplier_id: purchaseType === 'traslado' ? null : selectedSupplierId,
        invoice_ref: invoiceRef || (purchaseType === 'traslado' ? 'TRASLADO-INTERNO' : null)
      }]).select().single();
      
      if (purchaseError) throw purchaseError;

      // 2. Crear Detalle de Compra
      const itemsData = cart.map(item => ({
        branch_id: branchId,
        purchase_id: purchaseData.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        subtotal: item.unit_cost * item.quantity,
      }));
      const { error: itemsError } = await supabase.from('purchase_items').insert(itemsData);
      if (itemsError) throw itemsError;

      // 3. AUMENTAR STOCK (KARDEX)
      for (const item of cart) {
        const originalProduct = products.find(p => p.id === item.id);
        const newStock = (originalProduct?.stock || 0) + item.quantity;
        await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
      }

      // 4. REGISTROS FINANCIEROS DERIVADOS
      if (purchaseType === 'contado') {
         // Restar plata del cajón generando un Egreso
         const selSup = suppliers.find(s=>s.id === selectedSupplierId);
         await supabase.from('expenses').insert([{
            branch_id: branchId,
            user_id: userId,
            amount: total,
            category: 'inventory',
            description: `Pago de factura de compra ${invoiceRef} a proveedor ${selSup?.name || 'Varios'}`
         }]);
      } else if (purchaseType === 'credito') {
         // Generar una Cuenta por Pagar
         await supabase.from('accounts_payable').insert([{
            branch_id: branchId,
            supplier_id: selectedSupplierId,
            purchase_id: purchaseData.id,
            total_amount: total,
            paid_amount: 0,
            status: 'pending'
         }]);
      }

      alert("¡Ingreso al inventario registrado correctamente!");
      
      // Reset form
      setCart([]);
      setInvoiceRef("");
      setPurchaseType("contado");
      
      // Reload products
      const { data: updatedProducts } = await supabase.from('products').select('*');
      if (updatedProducts) setProducts(updatedProducts);

    } catch (err: any) {
      alert(err.message || "Error al procesar el ingreso de inventario");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <header className="mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-slate-800">Ingreso de Mercancía / Compras</h2>
          <p className="text-slate-500 mt-1">Suma al inventario mediante compras oficiales o traslados.</p>
        </header>

        <div className="relative mb-6 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-4 border border-slate-200 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500 text-lg"
            placeholder="Buscar producto a ingresar..."
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
                  <div key={product.id} onClick={() => addToCart(product)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all active:scale-95 flex flex-col h-full opacity-90">
                     <div className="h-24 bg-slate-50 flex items-center justify-center rounded-lg mb-3 overflow-hidden">
                        {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-2 mix-blend-darken" /> : <span className="text-xs text-slate-400">Sin imagen</span>}
                     </div>
                     <h3 className="font-bold text-slate-700 leading-tight mb-auto text-sm">{product.name}</h3>
                     <div className="flex justify-between items-center mt-4 border-t border-slate-100 pt-2">
                        <span className="text-xs text-slate-400">PVP: {new Intl.NumberFormat('es-CO').format(product.price)}</span>
                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Stock Físico: {product.stock}</span>
                     </div>
                  </div>
               ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-[480px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-xl z-10">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50 text-emerald-900">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            <h3 className="text-lg font-black">Factura de Compra / Entrada</h3>
          </div>
        </div>
        
        <div className="flex-1 p-3 overflow-y-auto border-b border-slate-100 bg-slate-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-70">
              <p>Selecciona productos para darles ingreso.</p>
            </div>
          ) : (
            <div className="space-y-3"> 
              {cart.map(item => (
                <div key={item.id} className="flex flex-col p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-slate-800 text-sm pe-4">{item.name}</h4>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex justify-between items-center text-sm gap-4">
                    
                    {/* Controles de Cantidad */}
                    <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CANTIDAD QUE ENTRA</span>
                       <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                         <button onClick={() => updateQuantity(item.id, -1)} className="px-3 py-2 hover:bg-slate-200 active:bg-slate-300"><Minus size={14} /></button>
                         <span className="px-4 font-black text-lg bg-white">{item.quantity}</span>
                         <button onClick={() => updateQuantity(item.id, +1)} className="px-3 py-2 hover:bg-slate-200 active:bg-slate-300"><Plus size={14} /></button>
                       </div>
                    </div>

                    {/* Controles de Costo */}
                    <div className="flex flex-col flex-1">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-right">COSTO UNITARIO ($)</span>
                       <input 
                         type="text" 
                         value={item.unit_cost ? new Intl.NumberFormat('es-CO').format(item.unit_cost) : "0"} 
                         onChange={e => updateUnitCost(item.id, e.target.value)}
                         className="w-full text-right font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                       />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-white">
          
          <div className="grid grid-cols-2 gap-3 mb-4">
             <div className="col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><FileText size={16}/> Comprobante / Origen</label>
                <select 
                   value={purchaseType}
                   onChange={e => setPurchaseType(e.target.value)}
                   className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 bg-white"
                >
                   <option value="contado">Compra de Contado (Resta de Caja Física)</option>
                   <option value="credito">Compra Fiada / Crédito (Genera CxP)</option>
                   <option value="traslado">Traslado / Ajuste / Jefe (Entrada sin costo)</option>
                </select>
             </div>

             {purchaseType !== 'traslado' && (
                <>
                   <div className="col-span-2 mt-2">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1"><Truck size={16}/> Proveedor</label>
                      <select 
                         value={selectedSupplierId}
                         onChange={e => setSelectedSupplierId(e.target.value)}
                         className="w-full border-2 border-slate-200 p-2 rounded-lg font-semibold text-slate-700 bg-slate-50"
                      >
                         <option value="" disabled>Seleccionar proveedor...</option>
                         {suppliers.map(s => (
                           <option key={s.id} value={s.id}>{s.name} - {s.document_id}</option>
                         ))}
                      </select>
                   </div>
                   <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase mt-2 mb-1 block">Remisión / # Factura Física</label>
                      <input 
                         type="text" 
                         value={invoiceRef} 
                         onChange={e => setInvoiceRef(e.target.value)}
                         placeholder="Ej. FEV-99201" 
                         className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50" 
                      />
                   </div>
                </>
             )}
          </div>

          <div className="flex justify-between items-center mb-6 pt-4 border-t border-slate-100">
            <span className="text-slate-500 font-bold">TOTAL A PAGAR:</span>
            <span className="text-3xl font-black text-emerald-600">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(purchaseType === 'traslado' ? 0 : total)}
            </span>
          </div>
          
          <button 
             disabled={cart.length === 0 || processing || (purchaseType !== 'traslado' && !selectedSupplierId)}
             onClick={handleCheckout}
             className="w-full bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200 text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2"
          >
             {processing ? <Loader2 className="animate-spin w-6 h-6" /> : "Finalizar Ingreso al Kardex"}
          </button>

        </div>
      </div>
    </div>
  );
}
