"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Plus, Truck, Edit, Trash2, X, Loader2 } from "lucide-react";

const supabase = createClient();

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  
  // Datos del form
  const [newSupplier, setNewSupplier] = useState({
    document_id: "",
    name: "",
    email: "",
    phone: "",
  });

  const fetchSuppliers = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', authData.user.id).single();
      if (profile?.branch_id) setBranchId(profile.branch_id);
    }

    const { data } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
    if (data) setSuppliers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar al proveedor "${name}"? Si tiene compras atadas, no se podrá borrar.`)) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      fetchSuppliers();
    } catch (err: any) {
      alert("Error al eliminar (Puede que tenga compras/facturas atadas a su nombre): " + err.message);
    }
  };

  const openEditModal = (s: any) => {
    setEditingId(s.id);
    setNewSupplier({
      document_id: s.document_id || "",
      name: s.name || "",
      email: s.email || "",
      phone: s.phone || "",
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingId(null);
    setNewSupplier({ document_id: "", name: "", email: "", phone: "" });
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (!branchId && !editingId) {
        throw new Error("No se ha podido detectar a qué Sede perteneces.");
      }

      const payload: any = {
        document_id: newSupplier.document_id,
        name: newSupplier.name,
        email: newSupplier.email || null,
        phone: newSupplier.phone || null,
      };

      if (!editingId) {
        payload.branch_id = branchId;
      }

      let dbError;
      if (editingId) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', editingId);
        dbError = error;
      } else {
        const { error } = await supabase.from('suppliers').insert([payload]);
        dbError = error;
      }

      if (dbError) throw dbError;

      alert(editingId ? "¡Proveedor actualizado!" : "¡Proveedor registrado!");
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      alert("Error al guardar proveedor. Verifique que el NIT no esté repetido. " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 h-full relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Proveedores</h1>
          <p className="text-slate-500 mt-2">Directorio de mayoristas, despachadores y empresas suministrantes.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuevo Proveedor
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="Buscar proveedor por nombre o NIT..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">NIT / Documento</th>
                <th className="px-6 py-4 font-semibold">Razón Social</th>
                <th className="px-6 py-4 font-semibold">Contacto</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Cargando proveedores...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    <Truck className="w-12 h-12 mx-auto mb-3 opacity-50 text-blue-400" />
                    No hay proveedores registrados en esta sede.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono text-sm bg-slate-50 rounded-md w-max m-3">{s.document_id}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{s.name}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {s.phone ? <span>☎ {s.phone}<br/></span> : null}
                      {s.email ? <span>✉ {s.email}</span> : null}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 text-slate-400">
                        <button onClick={() => openEditModal(s)} className="hover:text-blue-600 transition-colors"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(s.id, s.name)} className="hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Truck className="text-blue-600" /> {editingId ? "Editar Proveedor" : "Registrar Proveedor"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Cédula o NIT *</label>
                  <input required value={newSupplier.document_id} onChange={e => setNewSupplier({...newSupplier, document_id: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Empresa / Razón Social *</label>
                  <input required value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Teléfono</label>
                  <input value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Correo Electrónico</label>
                  <input type="email" value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md transition-all flex items-center gap-2">
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
