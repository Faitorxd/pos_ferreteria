"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import { MapPin, Users, Plus, Save, Loader2, ShieldAlert, Key, X } from "lucide-react";
import { createEmployeeAccount } from "./actions";

const supabase = createClient();

export default function SedesAdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  const [branches, setBranches] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Branch State
  const [newBranchName, setNewBranchName] = useState("");
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  // New Employee Modal State
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [newEmployee, setNewEmployee] = useState({
    email: "",
    password: "",
    branch_id: ""
  });

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (authData?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
      if (profile?.role === 'admin') {
        setIsAdmin(true);
        await loadAdminData();
      } else {
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
    setLoading(false);
  };

  const loadAdminData = async () => {
    // 1. Cargar todas las Sedes
    const { data: branchesData } = await supabase.from('branches').select('*').order('name');
    if (branchesData) setBranches(branchesData);

    // 2. Cargar todos los Perfiles (Empleados)
    const { data: profilesData } = await supabase.from('profiles').select('*').order('email');
    if (profilesData) setProfiles(profilesData);
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setIsCreatingBranch(true);
    
    try {
      const { error } = await supabase.from('branches').insert([{ name: newBranchName }]);
      if (error) throw error;
      
      setNewBranchName("");
      alert("¡Sede creada exitosamente!");
      await loadAdminData();
    } catch (err: any) {
      alert("Error al crear la sede: " + err.message);
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const handleReassignEmployee = async (employeeId: string, newBranchId: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ branch_id: newBranchId }).eq('id', employeeId);
      if (error) throw error;
      alert("¡Sede de empleado actualizada exitosamente!");
      await loadAdminData();
    } catch (err: any) {
       // Si muestra error en RLS es porque el RLS 'Admins gestionan perfiles' debe ser re-creado/corregido en SQL,
       // pero la lógica TypeScript ya está bien montada.
      alert("No se pudo actualizar. Asegúrate de tener permisos Super Admin completos. Error: " + err.message);
    }
  };


  const handleNewEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.email || !newEmployee.password || !newEmployee.branch_id) {
       alert("Error: Correo, Contraseña y Sede son obligatorios.");
       return;
    }
    
    // Server action form data submission
    const formData = new FormData();
    formData.append("email", newEmployee.email);
    formData.append("password", newEmployee.password);
    formData.append("branch_id", newEmployee.branch_id);

    startTransition(async () => {
       const res = await createEmployeeAccount(formData);
       if (res.success) {
          alert("¡Cajero creado exitosamente y asignado a su sede!");
          setIsEmployeeModalOpen(false);
          setNewEmployee({ email: "", password: "", branch_id: "" });
          loadAdminData(); // Refrescar lista de empleados
       } else {
          alert("Error: " + res.error);
       }
    });
  };

  if (loading) {
     return <div className="p-10 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  if (isAdmin === false) {
     return (
        <div className="flex flex-col h-full bg-slate-50 items-center justify-center p-8 text-center bg-white rounded-xl shadow-sm border border-slate-200 h-96 m-10">
           <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
           <h2 className="text-2xl font-black text-slate-800 mb-2">Acceso Restringido</h2>
           <p className="text-slate-500">Esta pantalla es exclusiva para el Súper Administrador del sistema.<br/>Si eres administrador, verifica que tu "role" en la base de datos sea 'admin'.</p>
        </div>
     );
  }

  return (
    <div className="p-8 h-full relative overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
           <MapPin className="text-blue-600" /> Administración: Sedes Funcionales
        </h1>
        <p className="text-slate-500 mt-2">Crea múltiples sucursales físicas y asigna cajeros para garantizar el aislamiento del Cierre de Caja e Inventario por Sede.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* PANEL 1: CREAR Y LISTAR SEDES */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800">Catálogo de Sedes</h3>
          </div>
          <div className="p-5 border-b border-slate-100">
             <form onSubmit={handleCreateBranch} className="flex gap-2">
                <input 
                   required
                   value={newBranchName}
                   onChange={e => setNewBranchName(e.target.value)}
                   placeholder="Ej: Ferretería Norte..." 
                   className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                />
                <button 
                  type="submit" 
                  disabled={isCreatingBranch}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2"
                >
                   {isCreatingBranch ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4" />} Crear
                </button>
             </form>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
             <ul className="divide-y divide-slate-100">
                {branches.map(b => (
                   <li key={b.id} className="p-3 flex items-center justify-between hover:bg-slate-50 rounded-lg">
                      <span className="font-bold text-slate-700">{b.name}</span>
                      <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">ID: ...{b.id.split('-')[0]}</span>
                   </li>
                ))}
             </ul>
          </div>
        </div>

        {/* PANEL 2: ASIGNACIÓN DE CAJEROS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-blue-500"/> Empleados / Cajeros</h3>
            <button 
              onClick={() => setIsEmployeeModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1 transition-all"
            >
              <Plus className="w-4 h-4" /> Nuevo 
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
             <div className="space-y-4">
                {profiles.map(p => (
                   <div key={p.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                      <div className="flex justify-between items-start mb-3">
                         <div>
                           <div className="font-bold text-slate-800">{p.email || 'Usuario sin Correo'}</div>
                           <div className="text-xs font-semibold px-2 py-0.5 mt-1 rounded bg-slate-200 text-slate-600 inline-block uppercase tracking-wider">{p.role}</div>
                         </div>
                      </div>
                      
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Asignado a Sede:</label>
                      <div className="flex gap-2">
                        <select
                           defaultValue={p.branch_id || ""}
                           onChange={(e) => handleReassignEmployee(p.id, e.target.value)}
                           className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                           <option value="" disabled>Sin Sede</option>
                           {branches.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                           ))}
                        </select>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>

      </div>

      {/* MODAL PARA CREAR NUEVO CAJERO */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <Key className="text-blue-600 w-5 h-5" /> Alta de Empleado Oficial
              </h3>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleNewEmployeeSubmit} className="p-6">
               <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Correo (Usuario de Login) *</label>
                    <input type="email" required placeholder="cajero1@ferreteria.com" value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Contraseña *</label>
                    <input type="text" required placeholder="Ej: F3rret3ria123" value={newEmployee.password} onChange={e => setNewEmployee({...newEmployee, password: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Obligatorio: Sede asignada *</label>
                    <select required value={newEmployee.branch_id} onChange={e => setNewEmployee({...newEmployee, branch_id: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
                       <option value="" disabled>Selecciona la sede del cajero</option>
                       {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                       ))}
                    </select>
                  </div>
               </div>

               <div className="mt-8">
                 <button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2">
                   {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Crear Cajero Silenciosamente"}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
