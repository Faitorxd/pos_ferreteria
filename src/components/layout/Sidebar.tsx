"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Copyleft as CashRegister, Search, FileText, LogOut, MapPin, Users, BookOpenCheck, Wallet, Truck, ShoppingCart, Building2 } from "lucide-react";
import { logout } from "@/app/login/actions";
import { createClient } from "@/utils/supabase/client";

export function Sidebar() {
  const pathname = usePathname();
  const [branchName, setBranchName] = useState("Cargando Sede...");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchBranch = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('branch_id, role').eq('id', user.id).single();
        if (profile?.role === 'admin') setIsAdmin(true);
        if (profile?.branch_id) {
          const { data: branch } = await supabase.from('branches').select('name').eq('id', profile.branch_id).single();
          if (branch) setBranchName(branch.name);
          else setBranchName("Sede Desconocida");
        } else {
          setBranchName("Sin Sede Asignada");
        }
      }
    };
    if (!pathname.startsWith('/login')) {
      fetchBranch();
    }
  }, [pathname]);

  if (pathname.startsWith('/login')) return null;

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
          <span>POS</span> Ferretería
        </h1>
        <div className="mt-4 bg-slate-800/50 py-2 px-3 rounded-lg border border-slate-700/50 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-300">{branchName}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        <Link
          href="/pos"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <CashRegister className="w-5 h-5" />
          <span>Caja (POS)</span>
        </Link>
        <Link
          href="/inventario"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Search className="w-5 h-5" />
          <span>Inventario</span>
        </Link>
        <Link
          href="/clientes"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Users className="w-5 h-5" />
          <span>Clientes</span>
        </Link>
        <Link
          href="/compras"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ShoppingCart className="w-5 h-5 text-indigo-400" />
          <span className="text-indigo-50 font-semibold">Compras a Proveedor</span>
        </Link>
        <Link
          href="/cuentas-pagar"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Building2 className="w-5 h-5 text-rose-400" />
          <span className="text-rose-50 font-semibold">Cuentas por Pagar</span>
        </Link>
        <Link
          href="/cartera"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <BookOpenCheck className="w-5 h-5" />
          <span>Cartera (CxC)</span>
        </Link>
        <Link
          href="/caja"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Wallet className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-50 font-semibold">Caja y Arqueo</span>
        </Link>
        <Link
          href="/reportes"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <FileText className="w-5 h-5" />
          <span>Reportes</span>
        </Link>
        {isAdmin && (
          <div className="pt-4 pb-2">
            <div className="text-xs font-bold text-slate-500 uppercase px-4 mb-2">Administración</div>
            <Link
              href="/proveedores"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Truck className="w-5 h-5" />
              <span>Directorio Proveedores</span>
            </Link>
            <Link
              href="/admin/sedes"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors border border-blue-900/50 bg-slate-800/20 mt-1"
            >
              <MapPin className="w-5 h-5 text-blue-400" />
              <span className="text-blue-300 font-semibold">Sedes y Cajeros</span>
            </Link>
          </div>
        )}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800">
        <button 
          onClick={async () => await logout()}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
