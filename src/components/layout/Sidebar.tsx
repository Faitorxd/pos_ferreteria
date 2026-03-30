"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Copyleft as CashRegister, Search, FileText, LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";

export function Sidebar() {
  const pathname = usePathname();
  if (pathname.startsWith('/login')) return null;

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col min-h-screen">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
          <span>POS</span> Ferretería
        </h1>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
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
          href="/reportes"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <FileText className="w-5 h-5" />
          <span>Reportes</span>
        </Link>
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
