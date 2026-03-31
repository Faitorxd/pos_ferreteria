"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Plus, Users, Edit, Trash2, X, Loader2 } from "lucide-react";

const supabase = createClient();

export default function ClientesPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  
  // Datos del form
  const [newCustomer, setNewCustomer] = useState({
    document_id: "",
    name: "",
    email: "",
    phone: "",
    credit_limit: "0",
  });

  const fetchCustomers = async () => {
    // 1. Obtener Sede
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', authData.user.id).single();
      if (profile?.branch_id) setBranchId(profile.branch_id);
    }

    // 2. Traer Clientes
    const { data } = await supabase.from('customers').select('*').order('name', { ascending: true });
    if (data) setCustomers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar al cliente "${name}"? Si tiene facturas asociadas a su nombre, no se podrá borrar.`)) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      fetchCustomers();
    } catch (err: any) {
      alert("Error al eliminar (Puede que el cliente tenga reportes/ventas atadas a su nombre): " + err.message);
    }
  };

  const openEditModal = (c: any) => {
    setEditingId(c.id);
    setNewCustomer({
      document_id: c.document_id || "",
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      credit_limit: c.credit_limit.toString(),
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingId(null);
    setNewCustomer({ document_id: "", name: "", email: "", phone: "", credit_limit: "0" });
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (!branchId && !editingId) {
        throw new Error("No se ha podido detectar a qué Sede perteneces.");
      }

      const payload: any = {
        document_id: newCustomer.document_id,
        name: newCustomer.name,
        email: newCustomer.email || null,
        phone: newCustomer.phone || null,
        credit_limit: Number(newCustomer.credit_limit),
      };

      if (!editingId) {
        payload.branch_id = branchId;
      }

      let dbError;
      if (editingId) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingId);
        dbError = error;
      } else {
        const { error } = await supabase.from('customers').insert([payload]);
        dbError = error;
      }

      if (dbError) throw dbError;

      alert(editingId ? "¡Cliente actualizado!" : "¡Cliente registrado!");
      setIsModalOpen(false);
      fetchCustomers();
    } catch (error: any) {
      alert("Error al guardar cliente. Verifique que la cédula no esté repetida. " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 h-full relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Clientes</h1>
          <p className="text-slate-500 mt-2">Directorio de terceros y asignación de cupos de crédito.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="Buscar cliente por nombre o NIT..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">Cédula / NIT</th>
                <th className="px-6 py-4 font-semibold">Nombre / Razón Social</th>
                <th className="px-6 py-4 font-semibold">Contacto</th>
                <th className="px-6 py-4 font-semibold">Cupo de Crédito</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Cargando base de datos...</td></tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    No hay clientes registrados en esta sede.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono text-sm bg-slate-50 rounded-md w-max m-3">{c.document_id}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{c.name}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {c.phone ? <span>☎ {c.phone}<br/></span> : null}
                      {c.email ? <span>✉ {c.email}</span> : null}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full font-bold text-xs ${c.credit_limit > 0 ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'}`}>
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(c.credit_limit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 text-slate-400">
                        <button onClick={() => openEditModal(c)} className="hover:text-blue-600 transition-colors"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(c.id, c.name)} className="hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-blue-600" /> {editingId ? "Editar Cliente" : "Registrar Nuevo Cliente"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Cédula o NIT *</label>
                  <input required value={newCustomer.document_id} onChange={e => setNewCustomer({...newCustomer, document_id: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Nombre Completo / Razón *</label>
                  <input required value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Teléfono</label>
                  <input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Correo Electrónico</label>
                  <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>

                <div className="col-span-2 bg-purple-50 p-4 rounded-xl border border-purple-100 mt-2">
                  <label className="block text-sm font-bold text-purple-800 mb-2">Cupo de Crédito Permitido (COP) *</label>
                  <p className="text-xs text-purple-600 mb-3">Establece el monto máximo que este cliente puede quedar debiendo. Si es 0, no podrá comprar fiado.</p>
                  <input 
                    required 
                    type="text" 
                    value={newCustomer.credit_limit ? new Intl.NumberFormat('es-CO').format(Number(newCustomer.credit_limit)) : "0"} 
                    onChange={e => {
                      const rawValue = e.target.value.replace(/\D/g, "");
                      setNewCustomer({...newCustomer, credit_limit: rawValue || "0"});
                    }} 
                    className="w-full border border-purple-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold text-lg text-purple-900 bg-white" 
                  />
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md transition-all flex items-center gap-2">
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
